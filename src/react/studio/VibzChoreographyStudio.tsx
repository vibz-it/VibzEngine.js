import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type RefObject,
} from 'react';
import { useVibz } from '../useVibz.js';
import { useVibzChoreography, type MediaClock } from '../useVibzChoreography.js';
import {
  normalizeScript,
  serializeChoreography,
  spotifyUriFromInput,
  intensityAt,
  isStripEvent,
  type Choreography,
  type ChoreographyEvent,
  type ChoreographyEffect,
  type ChoreographyEffectEvent,
  type ChoreographyStripEvent,
  type ChoreographyGrid,
  type IntensityKeyframe,
} from '../choreography.js';
import { useSpotifyOptional } from '../spotify/index.js';
import { Styles, StripStyles } from '../../protocol/Identifiers.js';
import { useStudioStyles } from './styles.js';

// React's type export name differs across setups; alias the few we use.
const useCb = useCallback;

export interface VibzChoreographyStudioProps {
  /** Dismiss the overlay. */
  onClose?: () => void;
  /** Optional ready-made video the "Use site video" button loads. */
  siteVideoSrc?: string;
  /** Optional initial script (URL string or object) to open with. */
  initialScript?: string | object;
  /**
   * Spotify app Client ID. When set, the editor can author against a Spotify
   * track (Web Playback SDK) instead of a video file. Requires the editor
   * user to have Spotify Premium and to log in.
   */
  spotifyClientId?: string;
}

// Available effects, derived from the firmware `Style` enum (Identifiers.Styles,
// itself a mirror of wristband_objects/Event.h) so the picker can never drift
// from what the device actually supports. Sorted by style id.
const STYLE_OPTIONS: Array<[number, string]> = (
  Object.entries(Styles) as Array<[string, number]>
)
  .map(([name, value]): [number, string] => [value, name])
  .sort((a, b) => a[0] - b[0]);
const BLEND_OPTIONS: Array<[number, string]> = [
  [0, 'Normal'], [1, 'Add'], [2, 'And'], [3, 'Subtract'], [4, 'Multiply'], [5, 'Divide'],
];

// Addressable LED-strip effect styles, derived from StripStyles (mirror of the
// firmware `Style_strip` enum). Sorted by id.
const STRIP_STYLE_OPTIONS: Array<[number, string]> = (
  Object.entries(StripStyles) as Array<[string, number]>
)
  .map(([name, value]): [number, string] => [value, name])
  .sort((a, b) => a[0] - b[0]);

/**
 * Per-style layout of an `EffectStrip`'s 8 generic params, from the firmware
 * doc (wristband_firmware/Doc/strip_effects.md). `color` groups an R,G,B triplet
 * into one picker; `num` is a single 0–255 byte. Params not listed default to 0.
 */
type StripParamSpec =
  | { kind: 'color'; label: string; idx: readonly [number, number, number] }
  | { kind: 'num'; label: string; idx: number };

const STRIP_PARAM_SPECS: Record<number, StripParamSpec[]> = {
  [StripStyles.Off]: [],
  [StripStyles.ColorSweep]: [
    { kind: 'color', label: 'Left color', idx: [0, 1, 2] },
    { kind: 'color', label: 'Right color', idx: [3, 4, 5] },
    { kind: 'num', label: 'Intensity', idx: 6 },
    { kind: 'num', label: 'Speed', idx: 7 },
  ],
  [StripStyles.Comet]: [
    { kind: 'color', label: 'Color', idx: [0, 1, 2] },
    { kind: 'num', label: 'Intensity', idx: 3 },
    { kind: 'num', label: 'Speed', idx: 4 },
    { kind: 'num', label: 'Trail length (1–26)', idx: 5 },
  ],
  [StripStyles.DoubleSpin]: [
    { kind: 'color', label: 'Point 1', idx: [0, 1, 2] },
    { kind: 'color', label: 'Point 2', idx: [3, 4, 5] },
    { kind: 'num', label: 'Intensity', idx: 6 },
    { kind: 'num', label: 'Speed', idx: 7 },
  ],
  [StripStyles.ImpactWave]: [
    { kind: 'color', label: 'Color', idx: [0, 1, 2] },
    { kind: 'num', label: 'Intensity', idx: 3 },
    { kind: 'num', label: 'Speed', idx: 4 },
    { kind: 'num', label: 'Kick duration (×10ms)', idx: 5 },
  ],
  [StripStyles.KittWide]: [
    { kind: 'color', label: 'Beam color', idx: [0, 1, 2] },
    { kind: 'num', label: 'Intensity', idx: 3 },
    { kind: 'num', label: 'Speed', idx: 4 },
    { kind: 'num', label: 'Beam width', idx: 5 },
  ],
  [StripStyles.PulseBeat]: [
    { kind: 'color', label: 'Flash 1', idx: [0, 1, 2] },
    { kind: 'color', label: 'Flash 2', idx: [3, 4, 5] },
    { kind: 'num', label: 'Intensity', idx: 6 },
    { kind: 'num', label: 'Speed (BPM)', idx: 7 },
  ],
  [StripStyles.RainbowComet]: [
    { kind: 'num', label: 'Intensity', idx: 0 },
    { kind: 'num', label: 'Speed', idx: 1 },
    { kind: 'num', label: 'Trail length (1–26)', idx: 2 },
    { kind: 'num', label: 'Color speed', idx: 3 },
  ],
  [StripStyles.Shimmer]: [
    { kind: 'color', label: 'Background', idx: [0, 1, 2] },
    { kind: 'color', label: 'Sparkle', idx: [3, 4, 5] },
    { kind: 'num', label: 'Intensity', idx: 6 },
    { kind: 'num', label: 'Chance', idx: 7 },
  ],
  [StripStyles.VuMeter]: [
    { kind: 'color', label: 'Peak color (reserved)', idx: [0, 1, 2] },
    { kind: 'num', label: 'Intensity', idx: 3 },
    { kind: 'num', label: 'Left level', idx: 4 },
    { kind: 'num', label: 'Right level', idx: 5 },
  ],
  [StripStyles.VuMeterPeak]: [
    { kind: 'color', label: 'Peak color', idx: [0, 1, 2] },
    { kind: 'num', label: 'Intensity', idx: 3 },
    { kind: 'num', label: 'Left level', idx: 4 },
    { kind: 'num', label: 'Right level', idx: 5 },
  ],
  [StripStyles.Direction]: [
    { kind: 'color', label: 'Center color', idx: [0, 1, 2] },
    { kind: 'num', label: 'Intensity', idx: 3 },
    { kind: 'num', label: 'Direction (0–25)', idx: 4 },
    { kind: 'num', label: 'Beam width', idx: 5 },
    { kind: 'num', label: 'Edge R', idx: 6 },
    { kind: 'num', label: 'Edge G', idx: 7 },
  ],
  [StripStyles.DirectionDyn]: [
    { kind: 'color', label: 'Particle 1', idx: [0, 1, 2] },
    { kind: 'color', label: 'Particle 2', idx: [3, 4, 5] },
    { kind: 'num', label: 'Intensity', idx: 6 },
    { kind: 'num', label: 'Direction (0–25)', idx: 7 },
  ],
  [StripStyles.Battery]: [
    { kind: 'num', label: 'Intensity', idx: 0 },
    { kind: 'num', label: 'Battery level', idx: 1 },
  ],
};

const fmtTime = (s: number) => {
  if (!Number.isFinite(s)) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
};
const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const snap = (s: number) => Math.round(s * 20) / 20; // 0.05 s grid
const round3 = (n: number) => Math.round(n * 1000) / 1000; // ms precision for time fields
const num = (v: string) => Number(v) || 0;

/**
 * True when an [r,g,b,…] block colour is dark enough that black text/strokes
 * would be unreadable — callers flip to a light foreground. Uses perceived
 * (sRGB-weighted) luminance.
 */
function isDarkBg(color: number[]): boolean {
  const [r = 0, g = 0, b = 0] = color;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

function emptyModel(): Choreography {
  return { version: 2, name: 'Untitled', loop: true, events: [] };
}

function newEvent(id: string, start: number): ChoreographyEvent {
  return {
    kind: 'effect',
    id,
    start, // caller snaps (grid-aware) before constructing
    duration: 1,
    mask: 0,
    layer: { nbr: 0, opacity: 255, blendingMode: 1 },
    effect: { style: Styles.Sparkle, frequency: 10, duration: 100, color: [255, 0, 0, 0, 0], intensity: 255 },
  };
}

function newStripEvent(id: string, start: number): ChoreographyEvent {
  return {
    kind: 'strip',
    id,
    start, // caller snaps (grid-aware) before constructing
    duration: 1,
    mask: 0,
    layer: { nbr: 0, opacity: 255, blendingMode: 1 },
    // Default to a visible Comet (white, mid speed, trail 10).
    strip: { style: StripStyles.Comet, params: [255, 255, 255, 255, 4, 10, 0, 0] },
  };
}

/** Promote a constant intensity to a 2-point envelope so points can be edited. */
function asKeyframes(i: ChoreographyEffect['intensity']): IntensityKeyframe[] {
  if (Array.isArray(i)) return i;
  return [{ at: 0, value: i }, { at: 1, value: i }];
}

let pasteSeq = 0;

export function VibzChoreographyStudio(props: VibzChoreographyStudioProps) {
  useStudioStyles();
  const { status, connect, disconnect } = useVibz();
  const connected = status === 'connected';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoFileRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDur, setVideoDur] = useState(0);
  const [now, setNow] = useState(0);
  const [loop, setLoop] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const [model, setModel] = useState<Choreography>(emptyModel);
  const [selId, setSelId] = useState<string | null>(null);
  const [pps, setPps] = useState(80);
  const [toast, setToast] = useState<string | null>(null);
  const idSeq = useRef(1);

  // ---- media source: video (default) or Spotify ----------------------------
  const [mediaMode, setMediaMode] = useState<'video' | 'spotify'>('video');
  const [spotifyUri, setSpotifyUri] = useState('');
  // Shared player from <SpotifyProvider> — never our own instance (the Web
  // Playback SDK allows only one player per page).
  const spotify = useSpotifyOptional();
  // Refs so timeline/keyboard handlers read the live source without re-binding.
  const modeRef = useRef(mediaMode);
  modeRef.current = mediaMode;
  const spotifyRef = useRef(spotify);
  spotifyRef.current = spotify;

  // The clock the preview engine + timeline follow, per active source. A
  // <video> element and the Spotify clock both satisfy MediaClock.
  const activeClockRef = (
    mediaMode === 'spotify' ? spotify.player.clockRef : videoRef
  ) as RefObject<MediaClock | null>;

  const flash = useCb((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  // Switch to Spotify mode + prefill the URI when a loaded script is bound to
  // a Spotify track.
  const applyMediaFromModel = useCb((m: Choreography) => {
    if (m.media?.type === 'spotify') {
      setMediaMode('spotify');
      setSpotifyUri(m.media.uri);
    } else if (m.media?.type === 'video' || m.media?.type === 'audio') {
      setMediaMode('video');
      // Auto-reload only real (loadable) URLs/paths. A bare local filename
      // can't be reopened by the browser, so leave the drop zone + a hint.
      if (/^(https?:|\/|\.\/|blob:)/.test(m.media.src)) {
        setVideoUrl(m.media.src);
      } else {
        flash(`This script was made with "${m.media.src}" — drop that file to preview.`);
      }
    }
  }, [flash]);

  // Start the entered Spotify track and remember it on the model (so export
  // carries `media`).
  const loadSpotifyTrack = useCb(async () => {
    const uri = spotifyUriFromInput(spotifyUri);
    if (!uri) {
      flash('Lien/URI Spotify invalide');
      return;
    }
    try {
      await spotifyRef.current.player.playTrack(uri);
      const title = spotifyRef.current.player.track?.title;
      setModel((m) => ({
        ...m,
        media: { type: 'spotify', uri, ...(title ? { title } : {}) },
      }));
    } catch (e) {
      flash((e as Error).message);
    }
  }, [spotifyUri, flash]);

  // ---- unsaved-changes guard -----------------------------------------------
  // "Saved" == exported to a .json (or freshly opened/imported). We keep a
  // snapshot of the clean serialized model and flag the studio dirty when it
  // diverges, then warn before the tab unloads or the overlay is closed.
  const cleanRef = useRef<string>(JSON.stringify(serializeChoreography(emptyModel())));
  const currentSnapshot = useMemo(
    () => JSON.stringify(serializeChoreography(model)),
    [model]
  );
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setDirty(currentSnapshot !== cleanRef.current);
  }, [currentSnapshot]);
  const markCleanWith = useCb((m: Choreography) => {
    cleanRef.current = JSON.stringify(serializeChoreography(m));
    setDirty(false);
  }, []);

  // Native "leave site?" prompt on refresh / tab close / navigation.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // ---- beat grid -----------------------------------------------------------
  const [gBpm, setGBpm] = useState(120);
  const [gOffsetSec, setGOffsetSec] = useState(0);
  const [gBeatsPerBar, setGBeatsPerBar] = useState(4);
  const [gSub, setGSub] = useState(1); // grid lines per beat: 1 | 2 | 4
  const [gridEnabled, setGridEnabled] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Live mirror so timeline/keyboard/metronome read current grid without rebind.
  const gridRef = useRef({ gBpm, gOffsetSec, gBeatsPerBar, gSub, gridEnabled, snapEnabled });
  gridRef.current = { gBpm, gOffsetSec, gBeatsPerBar, gSub, gridEnabled, snapEnabled };
  const nowRef = useRef(now);
  nowRef.current = now;

  // Persist the grid into the model (so Export + the dirty-diff catch it), but
  // never for the untracked default — keeps a fresh studio non-dirty.
  useEffect(() => {
    setModel((m) => {
      const next: ChoreographyGrid | undefined =
        gridEnabled || gBpm !== 120 || gOffsetSec !== 0 || gBeatsPerBar !== 4 || gSub !== 1
          ? { bpm: gBpm, offset: gOffsetSec, beatsPerBar: gBeatsPerBar, subdivision: gSub }
          : undefined;
      if (JSON.stringify(m.grid) === JSON.stringify(next)) return m; // no-op guard
      return { ...m, grid: next };
    });
  }, [gBpm, gOffsetSec, gBeatsPerBar, gSub, gridEnabled]);

  // Hydrate grid state from a loaded script.
  const applyGridFromModel = useCb((m: Choreography) => {
    if (m.grid) {
      setGBpm(m.grid.bpm);
      setGOffsetSec(m.grid.offset);
      setGBeatsPerBar(m.grid.beatsPerBar);
      setGSub(m.grid.subdivision);
      setGridEnabled(true);
    }
  }, []);

  // Tap-tempo: tap along to the music to calibrate the grid. ALL taps in the
  // burst feed a least-squares fit of playhead-time vs beat-index → average BPM
  // (slope) + phase (intercept). The phase is folded into one period so beat
  // numbering always starts from the beginning of the track, whatever moment
  // tapping began (while staying aligned to the tapped beats). A >2 s gap
  // (wall-clock, so a pause counts) resets the measurement to zero.
  const taps = useRef<{ wall: number; track: number }[]>([]);
  const onTap = useCb(() => {
    const wall = performance.now();
    const arr = taps.current;
    if (arr.length && wall - arr[arr.length - 1].wall > 2000) arr.length = 0;
    arr.push({ wall, track: nowRef.current });
    const n = arr.length;
    if (n < 2) return; // need at least two taps to measure
    // Least-squares regression over every tap: track ≈ phase + k·period.
    const mx = (n - 1) / 2; // mean of indices 0..n-1
    let my = 0;
    for (const t of arr) my += t.track;
    my /= n;
    let sxy = 0;
    let sxx = 0;
    for (let k = 0; k < n; k++) {
      sxy += (k - mx) * (arr[k].track - my);
      sxx += (k - mx) * (k - mx);
    }
    const period = sxx > 0 ? sxy / sxx : 0; // seconds per beat
    if (!(period > 0.1 && period < 3)) return; // sanity: ~20–600 BPM
    const bpm = Math.round((60 / period) * 100) / 100;
    const gridPeriod = 60 / bpm; // keep phase consistent with the stored BPM
    const phase = my - gridPeriod * mx; // playhead time of "beat 0"
    const offset = ((phase % gridPeriod) + gridPeriod) % gridPeriod;
    setGBpm(bpm);
    setGOffsetSec(offset);
    setGridEnabled(true);
  }, []);
  const setDownbeatHere = useCb(() => {
    setGOffsetSec(Math.max(0, nowRef.current));
    setGridEnabled(true);
  }, []);
  const nudgeOffset = useCb((d: number) => setGOffsetSec((o) => Math.max(0, o + d)), []);

  // Magnetic snap: stick to the nearest grid step only within ~8px; Alt bypasses.
  const snapTime = useCb((s: number, alt: boolean): number => {
    const g = gridRef.current;
    if (alt) return Math.max(0, s);
    if (g.gridEnabled && g.snapEnabled && g.gBpm > 0) {
      const step = 60 / g.gBpm / g.gSub;
      const gs = g.gOffsetSec + Math.round((s - g.gOffsetSec) / step) * step;
      if (Math.abs(s - gs) * pps < 8) return Math.max(0, gs);
    }
    return Math.max(0, snap(s));
  }, [pps]);

  // ---- optional initial script ---------------------------------------------
  useEffect(() => {
    const s = props.initialScript;
    if (!s) return;
    const load = (raw: unknown) => {
      try {
        const m = normalizeScript(raw);
        setModel(m);
        applyMediaFromModel(m);
        applyGridFromModel(m);
        markCleanWith(m);
      } catch (e) {
        flash(`Import failed: ${(e as Error).message}`);
      }
    };
    if (typeof s === 'string') {
      fetch(s).then((r) => r.json()).then(load).catch(() => {});
    } else {
      load(s);
    }
  }, [props.initialScript, flash, applyMediaFromModel, applyGridFromModel, markCleanWith]);

  // ---- live preview (reuses the shipped sync engine) -----------------------
  const previewScript = useMemo(() => model, [model]);
  useVibzChoreography({ script: previewScript, media: activeClockRef, enabled: true });

  // ---- video loading -------------------------------------------------------
  const loadFile = useCb((file: File) => {
    if (!file.type.startsWith('video/')) {
      flash('Not a video file');
      return;
    }
    setVideoUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    // Remember which file this script was authored against (the blob URL itself
    // is local/ephemeral, so we store the filename for reference).
    setModel((m) => ({ ...m, media: { type: 'video', src: file.name } }));
  }, [flash]);

  useEffect(() => {
    return () => {
      if (videoUrl?.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // ---- playhead clock ------------------------------------------------------
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t =
        modeRef.current === 'spotify'
          ? spotifyRef.current.player.clockRef.current?.currentTime ?? 0
          : videoRef.current?.currentTime ?? 0;
      setNow(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const spotifyDur = spotify.player.duration;
  const duration =
    (mediaMode === 'spotify' ? spotifyDur : videoDur) || model.duration || 30;
  const trackW = Math.max(600, duration * pps);

  // Beat-grid geometry (seconds → px via pps).
  const beatSec = 60 / gBpm;
  const barSec = beatSec * gBeatsPerBar;

  // Visible scroll window — the grid lines are virtualised to it so each stays
  // a crisp, integer-positioned 1px element (no gradient hairline drift).
  const [view, setView] = useState({ x: 0, w: 0 });
  useEffect(() => {
    const sc = scrollRef.current;
    const update = () => { if (sc) setView({ x: sc.scrollLeft, w: sc.clientWidth }); };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [duration, pps, gridEnabled]);

  const gridLines = useMemo(() => {
    if (!gridEnabled || gBpm <= 0 || view.w <= 0) return [];
    const bSec = 60 / gBpm;
    const subSec = bSec / gSub;
    const barSecL = bSec * gBeatsPerBar;
    // Pick the finest level that won't crowd into mush (≥ ~5–6px apart).
    let unitSec: number;
    if (gSub > 1 && subSec * pps >= 6) unitSec = subSec;
    else if (bSec * pps >= 5) unitSec = bSec;
    else if (barSecL * pps >= 5) unitSec = barSecL;
    else return [];
    const perBeat = unitSec === subSec ? gSub : 1;
    const tStart = view.x / pps;
    const tEnd = (view.x + view.w) / pps;
    const mod = (a: number, n: number) => ((a % n) + n) % n;
    const out: Array<{ x: number; kind: 'sub' | 'beat' | 'bar' }> = [];
    const k0 = Math.floor((tStart - gOffsetSec) / unitSec) - 1;
    const k1 = Math.ceil((tEnd - gOffsetSec) / unitSec) + 1;
    for (let k = k0; k <= k1; k++) {
      const t = gOffsetSec + k * unitSec;
      if (t < 0 || t > duration) continue;
      let kind: 'sub' | 'beat' | 'bar';
      if (unitSec === barSecL) kind = 'bar';
      else if (unitSec === bSec) kind = mod(k, gBeatsPerBar) === 0 ? 'bar' : 'beat';
      else if (mod(k, perBeat) !== 0) kind = 'sub';
      else kind = mod(k / perBeat, gBeatsPerBar) === 0 ? 'bar' : 'beat';
      out.push({ x: Math.round(t * pps), kind });
    }
    return out;
  }, [gridEnabled, gBpm, gOffsetSec, gBeatsPerBar, gSub, pps, view, duration]);

  const fit = useCb(() => {
    const w = scrollRef.current?.clientWidth ?? 900;
    setPps(clampN((w - 24) / Math.max(1, duration), 10, 400));
  }, [duration]);

  // ---- model helpers -------------------------------------------------------
  const patch = useCb(
    (id: string, fn: (e: ChoreographyEvent) => ChoreographyEvent) => {
      setModel((m) => ({
        ...m,
        events: m.events.map((e) => (e.id === id ? fn(e) : e)),
      }));
    },
    []
  );
  const addEvent = useCb(() => {
    const id = `evt-${idSeq.current++}`;
    setModel((m) => ({ ...m, events: [...m.events, newEvent(id, snapTime(now, false))] }));
    setSelId(id);
  }, [now, snapTime]);
  const delEvent = useCb((id: string) => {
    setModel((m) => ({ ...m, events: m.events.filter((e) => e.id !== id) }));
    setSelId((s) => (s === id ? null : s));
  }, []);

  // ---- timeline drag / resize ---------------------------------------------
  const drag = useRef<{
    id: string; mode: 'move' | 'l' | 'r'; x0: number; s0: number; d0: number;
  } | null>(null);

  const onEvPointerDown = useCb(
    (e: RPointerEvent, ev: ChoreographyEvent, mode: 'move' | 'l' | 'r') => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setSelId(ev.id);
      drag.current = { id: ev.id, mode, x0: e.clientX, s0: ev.start, d0: ev.duration };
    },
    []
  );
  const onEvPointerMove = useCb(
    (e: RPointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dt = (e.clientX - d.x0) / pps;
      const alt = e.altKey;
      patch(d.id, (ev) => {
        if (d.mode === 'move') {
          return { ...ev, start: snapTime(Math.max(0, d.s0 + dt), alt) };
        }
        if (d.mode === 'r') {
          // Snap the END edge to the grid, then derive duration.
          const end = snapTime(d.s0 + d.d0 + dt, alt);
          return { ...ev, duration: Math.max(0.1, end - ev.start) };
        }
        // Left resize: snap the START, keep the END (s0+d0) fixed.
        const ns = Math.min(
          snapTime(clampN(d.s0 + dt, 0, d.s0 + d.d0 - 0.1), alt),
          d.s0 + d.d0 - 0.1
        );
        return { ...ev, start: ns, duration: Math.max(0.1, d.s0 + d.d0 - ns) };
      });
    },
    [pps, patch, snapTime]
  );
  const onEvPointerUp = useCb(() => {
    drag.current = null;
  }, []);

  const seek = useCb(
    (clientX: number) => {
      const sc = scrollRef.current;
      if (!sc) return;
      const x = clientX - sc.getBoundingClientRect().left + sc.scrollLeft;
      const target = clampN(x / pps, 0, duration);
      if (modeRef.current === 'spotify') void spotifyRef.current.player.seek(target);
      else if (videoRef.current) videoRef.current.currentTime = target;
    },
    [pps, duration]
  );

  // ---- import / export -----------------------------------------------------
  const fileRef = useRef<HTMLInputElement | null>(null);
  const importJson = useCb(
    (file: File) => {
      file.text().then((txt) => {
        try {
          const m = normalizeScript(txt);
          const maxN = m.events.reduce(
            (a, e) => Math.max(a, Number((e.id.match(/(\d+)$/) || [])[1] ?? 0)),
            0
          );
          idSeq.current = maxN + 1;
          setModel(m);
          setSelId(null);
          applyMediaFromModel(m);
          applyGridFromModel(m);
          markCleanWith(m);
          flash(`Imported ${m.events.length} events`);
        } catch (e) {
          flash(`Import failed: ${(e as Error).message}`);
        }
      });
    },
    [flash, applyMediaFromModel, applyGridFromModel, markCleanWith]
  );
  const exportJson = useCb(() => {
    const json = JSON.stringify(serializeChoreography(model), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(model.name || 'choreography').replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    markCleanWith(model);
    flash('Exported .json — drop it in public/scripts/');
  }, [model, flash, markCleanWith]);
  const copyJson = useCb(() => {
    const json = JSON.stringify(serializeChoreography(model), null, 2);
    navigator.clipboard?.writeText(json).then(
      () => flash('JSON copied to clipboard'),
      () => flash('Clipboard blocked')
    );
  }, [model, flash]);

  const lanes = useMemo(() => {
    const set = new Set(model.events.map((e) => e.layer.nbr));
    return [...set].sort((a, b) => a - b);
  }, [model.events]);

  const sel = model.events.find((e) => e.id === selId) || null;

  // ---- clipboard / context menu / shortcuts --------------------------------
  const modelRef = useRef(model);
  modelRef.current = model;
  const selRef = useRef(selId);
  selRef.current = selId;
  const clip = useRef<ChoreographyEvent | null>(null);
  const [menu, setMenu] = useState<
    { x: number; y: number; evId?: string; time?: number; layer?: number } | null
  >(null);

  const copyEv = useCb(
    (id: string) => {
      const e = modelRef.current.events.find((x) => x.id === id);
      if (!e) return;
      clip.current = JSON.parse(JSON.stringify(e)) as ChoreographyEvent;
      flash('Event copied');
    },
    [flash]
  );
  const pasteAt = useCb(
    (time: number, layer?: number) => {
      const c = clip.current;
      if (!c) return;
      const id = `evt-p${++pasteSeq}-${idSeq.current++}`;
      const ev: ChoreographyEvent = {
        ...(JSON.parse(JSON.stringify(c)) as ChoreographyEvent),
        id,
        start: snapTime(Math.max(0, time), false),
        layer: { ...c.layer, nbr: layer ?? c.layer.nbr },
      };
      setModel((m) => ({ ...m, events: [...m.events, ev] }));
      setSelId(id);
      flash('Pasted');
    },
    [flash, snapTime]
  );
  const duplicateEv = useCb(
    (id: string) => {
      const e = modelRef.current.events.find((x) => x.id === id);
      if (!e) return;
      copyEv(id);
      pasteAt(e.start + e.duration, e.layer.nbr);
    },
    [copyEv, pasteAt]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && /^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'c') {
        if (selRef.current) {
          e.preventDefault();
          copyEv(selRef.current);
        }
      } else if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        const t =
          modeRef.current === 'spotify'
            ? spotifyRef.current.player.clockRef.current?.currentTime ?? 0
            : videoRef.current?.currentTime ?? 0;
        pasteAt(t);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selRef.current) {
          e.preventDefault();
          delEvent(selRef.current);
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        if (modeRef.current === 'spotify') {
          void spotifyRef.current.player.toggle();
        } else {
          const v = videoRef.current;
          if (v) {
            if (v.paused) void v.play();
            else v.pause();
          }
        }
      } else if (e.key === 'Escape') {
        setMenu((m) => (m ? null : m));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [copyEv, pasteAt, delEvent]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  // -------------------------------------------------------------------------
  return (
    <div className="vz-studio">
      <div className="vz-bar">
        <h2>Vibz Choreography Studio</h2>
        <span className={`vz-pill ${connected ? 'on' : 'off'}`}>
          {status === 'unsupported' ? 'Web Serial unsupported' : connected ? 'Connected' : 'Not connected'}
        </span>
        {connected ? (
          <button onClick={() => void disconnect()}>Disconnect</button>
        ) : (
          <button
            className="primary"
            disabled={status === 'unsupported' || status === 'connecting'}
            onClick={() => void connect()}
          >
            {status === 'connecting' ? 'Connecting…' : 'Connect bracelet'}
          </button>
        )}
        <div className="grow" />
        <input
          aria-label="Choreography name"
          style={{ width: 180 }}
          value={model.name ?? ''}
          onChange={(e) => setModel((m) => ({ ...m, name: e.target.value }))}
        />
        {dirty && (
          <span
            className="vz-pill off"
            title="Des modifications ne sont pas exportées"
          >
            ● Unsaved
          </span>
        )}
        <button
          onClick={() => {
            if (
              !dirtyRef.current ||
              window.confirm(
                'Your changes are not exported and will be lost. Close the studio anyway?'
              )
            ) {
              props.onClose?.();
            }
          }}
        >
          ✕ Close
        </button>
      </div>

      <div className="vz-body">
        <div className="vz-left">
          <div className="vz-srcswitch" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button
              className={mediaMode === 'video' ? 'primary' : ''}
              onClick={() => setMediaMode('video')}
            >
              🎬 Video
            </button>
            <button
              className={mediaMode === 'spotify' ? 'primary' : ''}
              onClick={() => setMediaMode('spotify')}
            >
              🎵 Spotify
            </button>
          </div>
          <div className="vz-video-wrap">
            {mediaMode === 'spotify' ? (
              <div className="vz-drop" style={{ display: 'block', textAlign: 'left' }}>
                <p
                  style={{
                    fontSize: 16,
                    marginTop: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  🎵 Spotify
                  <span
                    className={`vz-pill ${spotify.player.ready ? 'on' : 'off'}`}
                    style={{ marginLeft: 'auto' }}
                  >
                    {!props.spotifyClientId
                      ? 'No Client ID'
                      : !spotify.auth.isAuthed
                        ? 'Signed out'
                        : spotify.player.error
                          ? 'Error'
                          : spotify.player.ready
                            ? 'Ready'
                            : 'Connecting…'}
                  </span>
                </p>
                {!props.spotifyClientId ? (
                  <p className="vz-hint">
                    Set <code>VITE_SPOTIFY_CLIENT_ID</code> to author against a
                    Spotify track.
                  </p>
                ) : !spotify.auth.isAuthed ? (
                  <button className="primary" onClick={() => void spotify.auth.login()}>
                    Sign in to Spotify
                  </button>
                ) : (
                  <>
                    <div className="vz-row" style={{ gap: 8 }}>
                      <input
                        style={{ flex: 1 }}
                        placeholder="spotify:track:… or open.spotify.com link"
                        value={spotifyUri}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSpotifyUri(v);
                          // Keep the saved media in sync with the field so Export
                          // always carries the shown track (no need to click Load).
                          setModel((m) => {
                            if (!v.trim()) return m;
                            const title = m.media?.type === 'spotify' ? m.media.title : undefined;
                            const uri = spotifyUriFromInput(v) ?? v.trim();
                            return { ...m, media: { type: 'spotify', uri, ...(title ? { title } : {}) } };
                          });
                        }}
                      />
                      <button
                        className="primary"
                        disabled={!spotify.player.ready}
                        onClick={() => void loadSpotifyTrack()}
                      >
                        Load
                      </button>
                    </div>
                    <div className="vz-vidctl" style={{ marginTop: 10 }}>
                      <button
                        disabled={!spotify.player.ready}
                        onClick={() => void spotify.player.toggle()}
                      >
                        {spotify.player.paused ? '▶ Play' : '⏸ Pause'}
                      </button>
                      <span>
                        {fmtTime(now)} / {fmtTime(duration)}
                      </span>
                      {spotify.player.track && (
                        <span style={{ opacity: 0.8 }}>
                          ♪ {spotify.player.track.title} — {spotify.player.track.artist}
                        </span>
                      )}
                    </div>
                    {spotify.player.error && (
                      <p className="vz-hint" style={{ color: '#ff6b6b' }}>
                        {spotify.player.error.message}
                      </p>
                    )}
                    <p className="vz-hint">
                      Premium required. The track is saved into the script on export.
                    </p>
                  </>
                )}
              </div>
            ) : videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  loop={loop}
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    setVideoDur(d);
                    setModel((m) => ({ ...m, duration: d }));
                    setTimeout(fit, 0);
                  }}
                />
                <div className="vz-vidctl">
                  <span>{fmtTime(now)} / {fmtTime(duration)}</span>
                  <label>
                    <input
                      type="checkbox"
                      style={{ width: 'auto', marginRight: 6 }}
                      checked={loop}
                      onChange={(e) => setLoop(e.target.checked)}
                    />
                    Loop
                  </label>
                  <button onClick={() => setVideoUrl(null)}>Change video</button>
                </div>
              </>
            ) : (
              <div
                className={`vz-drop ${dragOver ? 'drag' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) loadFile(f);
                }}
              >
                <p style={{ fontSize: 16, marginTop: 0 }}>🎬 Drop a video file here</p>
                <p className="vz-hint">It stays in your browser — never uploaded.</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
                  <input
                    ref={videoFileRef}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) loadFile(f);
                      e.target.value = '';
                    }}
                  />
                  <button type="button" onClick={() => videoFileRef.current?.click()}>
                    Choose file…
                  </button>
                  {props.siteVideoSrc && (
                    <button
                      onClick={() => {
                        setVideoUrl(props.siteVideoSrc!);
                        setModel((m) => ({ ...m, media: { type: 'video', src: props.siteVideoSrc! } }));
                      }}
                    >
                      Use site video
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="vz-timeline-tools">
            <button className="primary" onClick={addEvent}>＋ Add event</button>
            <button onClick={() => fileRef.current?.click()}>Import JSON</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = '';
              }}
            />
            <button className={dirty ? 'primary' : ''} onClick={exportJson}>
              Export JSON{dirty ? ' ●' : ''}
            </button>
            <button onClick={copyJson}>Copy JSON</button>
            <div className="grow" />
            <span className="vz-grid-tools">
              <button
                className={gridEnabled ? 'on' : ''}
                onClick={() => setGridEnabled((v) => !v)}
                title="Show the beat grid"
              >
                Grid
              </button>
              <button
                className={snapEnabled ? 'on' : ''}
                onClick={() => setSnapEnabled((v) => !v)}
                title="Snap events to the grid (hold Alt while dragging to bypass)"
              >
                Snap
              </button>
              <label title="Beats per minute">
                BPM
                <input
                  type="number"
                  min={20}
                  max={400}
                  step={0.1}
                  value={gBpm}
                  onChange={(e) => setGBpm(clampN(Number(e.target.value) || 0, 20, 400))}
                />
              </label>
              <button onClick={onTap} title="Tap along to the beat to set tempo + phase">
                Tap
              </button>
              <label title="Beats per bar (accent every N)">
                /bar
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={gBeatsPerBar}
                  onChange={(e) => setGBeatsPerBar(clampN(Math.round(Number(e.target.value) || 1), 1, 16))}
                />
              </label>
              <select
                value={gSub}
                onChange={(e) => setGSub(Number(e.target.value))}
                title="Grid lines per beat"
              >
                <option value={1}>1/1</option>
                <option value={2}>1/2</option>
                <option value={4}>1/4</option>
              </select>
              <button onClick={setDownbeatHere} title="Put the downbeat at the playhead">
                ⊙ 1
              </button>
              <button onClick={() => nudgeOffset(-0.01)} title="Nudge grid −10 ms">◂</button>
              <button onClick={() => nudgeOffset(0.01)} title="Nudge grid +10 ms">▸</button>
            </span>
            <button onClick={() => setPps((p) => clampN(p * 0.8, 10, 400))}>－</button>
            <button onClick={fit}>Fit</button>
            <button onClick={() => setPps((p) => clampN(p * 1.25, 10, 400))}>＋</button>
          </div>

          <div
            className="vz-tl-scroll"
            ref={scrollRef}
            onScroll={(e) => setView({ x: e.currentTarget.scrollLeft, w: e.currentTarget.clientWidth })}
          >
            <div style={{ position: 'relative', width: trackW }}>
              {gridEnabled && gBpm > 0 && (
                <div className="vz-grid" aria-hidden="true">
                  {gridLines.map((l, i) => (
                    <div key={i} className={`vz-gline ${l.kind}`} style={{ left: l.x }} />
                  ))}
                </div>
              )}
              <div
                className="vz-ruler"
                style={{ width: trackW }}
                onPointerDown={(e) => seek(e.clientX)}
              >
                {Array.from({ length: Math.ceil(duration) + 1 }).map((_, s) =>
                  s % (pps < 30 ? 5 : 1) === 0 ? (
                    <span key={s} className="t" style={{ left: s * pps }}>{fmtTime(s)}</span>
                  ) : null
                )}
                {gridEnabled && gBpm > 0 && barSec > 0 &&
                  Array.from({ length: Math.max(0, Math.ceil((duration - gOffsetSec) / barSec)) + 1 }).map((_, b) => {
                    const x = Math.round((gOffsetSec + b * barSec) * pps);
                    if (x < 0 || x > trackW) return null;
                    return (
                      <span key={`bar${b}`} className="t bar" style={{ left: x }}>{b + 1}</span>
                    );
                  })}
              </div>

              {(lanes.length ? lanes : [0]).map((ln) => (
                <div
                  key={ln}
                  className="vz-lane"
                  style={{ height: 64 }}
                  onPointerDown={(e) => {
                    if (e.target === e.currentTarget) seek(e.clientX);
                  }}
                  onContextMenu={(e) => {
                    if (e.target !== e.currentTarget) return;
                    e.preventDefault();
                    const sc = scrollRef.current;
                    const x =
                      e.clientX -
                      (sc?.getBoundingClientRect().left ?? 0) +
                      (sc?.scrollLeft ?? 0);
                    setMenu({
                      x: e.clientX,
                      y: e.clientY,
                      time: Math.max(0, x / pps),
                      layer: ln,
                    });
                  }}
                >
                  <span className="vz-lane-label">Layer {ln}</span>
                  {model.events
                    .filter((ev) => ev.layer.nbr === ln)
                    .map((ev) => {
                      const w = Math.max(6, ev.duration * pps);
                      // Strip events have no single colour — use a fixed accent.
                      const dark = isStripEvent(ev) ? true : isDarkBg(ev.effect.color);
                      const bg = isStripEvent(ev)
                        ? '#3a2f6e'
                        : `rgb(${ev.effect.color[0]},${ev.effect.color[1]},${ev.effect.color[2]})`;
                      const label = isStripEvent(ev)
                        ? `🎏 ${STRIP_STYLE_OPTIONS.find(([v]) => v === ev.strip.style)?.[1] ?? ev.strip.style}`
                        : STYLE_OPTIONS.find(([v]) => v === ev.effect.style)?.[1] ?? ev.effect.style;
                      return (
                        <div
                          key={ev.id}
                          className={`vz-ev ${ev.id === selId ? 'sel' : ''}`}
                          style={{
                            left: ev.start * pps,
                            width: w,
                            background: bg,
                            color: dark ? '#f4f5f7' : '#0a0a0a',
                            borderColor: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)',
                          }}
                          onPointerDown={(e) => onEvPointerDown(e, ev, 'move')}
                          onPointerMove={onEvPointerMove}
                          onPointerUp={onEvPointerUp}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelId(ev.id);
                            setMenu({ x: e.clientX, y: e.clientY, evId: ev.id });
                          }}
                          onDoubleClick={(e) => {
                            if (isStripEvent(ev)) return; // strip has no intensity envelope
                            const r = e.currentTarget.getBoundingClientRect();
                            const at = clampN((e.clientX - r.left) / r.width, 0, 1);
                            const value = Math.round(
                              clampN(255 * (1 - (e.clientY - r.top) / r.height), 0, 255)
                            );
                            patch(ev.id, (x) => {
                              const ex = x as ChoreographyEffectEvent;
                              const ks = asKeyframes(ex.effect.intensity)
                                .concat({ at, value })
                                .sort((a, b) => a.at - b.at);
                              return { ...ex, effect: { ...ex.effect, intensity: ks } };
                            });
                          }}
                        >
                          <span
                            className="grip l"
                            onPointerDown={(e) => onEvPointerDown(e, ev, 'l')}
                            onPointerMove={onEvPointerMove}
                            onPointerUp={onEvPointerUp}
                          />
                          {label}
                          {!isStripEvent(ev) && (
                            <EnvelopeOverlay
                              ev={ev}
                              width={w}
                              stroke={isDarkBg(ev.effect.color) ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.7)'}
                              onChange={(fn) => patch(ev.id, fn)}
                            />
                          )}
                          <span
                            className="grip r"
                            onPointerDown={(e) => onEvPointerDown(e, ev, 'r')}
                            onPointerMove={onEvPointerMove}
                            onPointerUp={onEvPointerUp}
                          />
                        </div>
                      );
                    })}
                </div>
              ))}

              <div
                className="vz-playhead"
                style={{ left: now * pps, height: 24 + 64 * (lanes.length || 1) }}
              />
            </div>
          </div>
        </div>

        {sel ? (
          <EventForm
            key={sel.id}
            ev={sel}
            onChange={(fn) => patch(sel.id, fn)}
            onDelete={() => delEvent(sel.id)}
          />
        ) : (
          <div className="vz-right empty">
            <div>
              <p>No event selected.</p>
              <p className="vz-hint">Add an event or click a block on the timeline.</p>
            </div>
          </div>
        )}
      </div>

      {menu && (
        <div
          className="vz-menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {menu.evId ? (
            <>
              <div onClick={() => { copyEv(menu.evId!); setMenu(null); }}>
                Copy <span style={{ color: '#778' }}>Ctrl+C</span>
              </div>
              <div onClick={() => { duplicateEv(menu.evId!); setMenu(null); }}>
                Duplicate
              </div>
              <div className="sep" />
              <div onClick={() => { delEvent(menu.evId!); setMenu(null); }}>
                Delete <span style={{ color: '#778' }}>Del</span>
              </div>
            </>
          ) : clip.current ? (
            <div
              onClick={() => {
                pasteAt(menu.time ?? 0, menu.layer);
                setMenu(null);
              }}
            >
              Paste here
              {menu.time != null ? ` @ ${menu.time.toFixed(2)}s` : ''}
            </div>
          ) : (
            <div className="dim">Clipboard empty</div>
          )}
        </div>
      )}

      {toast && <div className="vz-toast">{toast}</div>}
    </div>
  );
}

/**
 * Intensity envelope drawn over an event block: a sampled polyline plus
 * draggable keyframe handles. Drag a point to move it (endpoints stay pinned
 * to t=0 / t=1, middles clamp between neighbours); right-click or Alt-click a
 * point to remove it (≥2 kept). Double-click the block adds a point.
 */
function EnvelopeOverlay(props: {
  ev: ChoreographyEffectEvent;
  /** Block pixel width — ties the curve geometry to resizes (see below). */
  width: number;
  /** Curve colour, contrast-matched to the block background by the caller. */
  stroke: string;
  onChange: (fn: (e: ChoreographyEvent) => ChoreographyEvent) => void;
}) {
  const { ev, width, stroke, onChange } = props;
  const intensity = ev.effect.intensity;
  const isArr = Array.isArray(intensity);
  const dragIdx = useRef<number | null>(null);

  // X coordinates are anchored to the block's pixel width so `points` (and the
  // viewBox) change on every resize. Without this, Chrome keeps the stretched
  // SVG's old geometry when only the container resizes and the curve lags
  // behind the (percentage-positioned) keyframe handles.
  const w = Math.max(1, width);
  const line = Array.from({ length: 25 }, (_, i) => {
    const p = i / 24;
    return `${(p * w).toFixed(2)},${(100 - (intensityAt(intensity, p) / 255) * 100).toFixed(2)}`;
  }).join(' ');

  const setKf = (idx: number, at: number, value: number) =>
    onChange((x) => {
      const e = x as ChoreographyEffectEvent;
      const ks = (e.effect.intensity as IntensityKeyframe[]).map((k) => ({ ...k }));
      ks[idx] = { ...ks[idx], at, value };
      return { ...e, effect: { ...e.effect, intensity: ks } };
    });
  const removeKf = (idx: number) =>
    onChange((x) => {
      const e = x as ChoreographyEffectEvent;
      const arr = e.effect.intensity;
      if (!Array.isArray(arr) || arr.length <= 2) return e;
      return { ...e, effect: { ...e.effect, intensity: arr.filter((_, i) => i !== idx) } };
    });

  return (
    <>
      <svg
        className="env"
        viewBox={`0 0 ${w} 100`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
      >
        <polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {isArr &&
        (intensity as IntensityKeyframe[]).map((k, idx, all) => (
          <div
            key={idx}
            className="vz-envpt"
            title="Drag to edit · right/Alt-click to remove"
            style={{ left: `${k.at * 100}%`, top: `${(1 - k.value / 255) * 100}%` }}
            onDoubleClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              removeKf(idx);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (e.altKey) {
                removeKf(idx);
                return;
              }
              (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              dragIdx.current = idx;
            }}
            onPointerMove={(e) => {
              if (dragIdx.current !== idx) return;
              const block = (e.currentTarget as HTMLElement).closest(
                '.vz-ev'
              ) as HTMLElement | null;
              if (!block) return;
              const r = block.getBoundingClientRect();
              const value = Math.round(
                clampN(255 * (1 - (e.clientY - r.top) / r.height), 0, 255)
              );
              let at = clampN((e.clientX - r.left) / r.width, 0, 1);
              if (idx === 0) at = 0;
              else if (idx === all.length - 1) at = 1;
              else
                at = clampN(at, all[idx - 1].at + 0.01, all[idx + 1].at - 0.01);
              setKf(idx, at, value);
            }}
            onPointerUp={(e) => {
              (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
              dragIdx.current = null;
            }}
          />
        ))}
    </>
  );
}

function EventForm(props: {
  ev: ChoreographyEvent;
  onChange: (fn: (e: ChoreographyEvent) => ChoreographyEvent) => void;
  onDelete: () => void;
}) {
  const { ev, onChange } = props;
  const setLayer = (k: string, v: number) =>
    onChange((e) => ({ ...e, layer: { ...e.layer, [k]: v } }));
  // Convert the event in place between a regular effect and an LED-strip effect.
  // Shared fields (start/duration/mask/layer) are kept; the effect/strip payload
  // resets to its type default (the two have different parameter models).
  const convertTo = (target: 'effect' | 'strip') =>
    onChange((x) => {
      const cur = isStripEvent(x) ? 'strip' : 'effect';
      if (cur === target) return x;
      const fresh = target === 'strip' ? newStripEvent(x.id, x.start) : newEvent(x.id, x.start);
      return { ...fresh, duration: x.duration, mask: x.mask, layer: x.layer };
    });

  return (
    <div className="vz-right">
      <div className="vz-row">
        <div className="vz-field">
          <label>Start (s)</label>
          <input type="number" step={0.05} min={0} value={round3(ev.start)}
            onChange={(e) => onChange((x) => ({ ...x, start: round3(num(e.target.value)) }))} />
        </div>
        <div className="vz-field">
          <label>Duration (s)</label>
          <input type="number" step={0.05} min={0.1} value={round3(ev.duration)}
            onChange={(e) => onChange((x) => ({ ...x, duration: Math.max(0.1, round3(num(e.target.value))) }))} />
        </div>
      </div>
      <div className="vz-field">
        <label>Address mask (0 = all)</label>
        <input type="number" min={0} max={255} value={ev.mask}
          onChange={(e) => onChange((x) => ({ ...x, mask: clampN(num(e.target.value), 0, 255) }))} />
      </div>

      <div className="vz-sec">
        <h4>Layer</h4>
        <div className="vz-row">
          <div className="vz-field">
            <label>Number</label>
            <input type="number" min={0} max={255} value={ev.layer.nbr}
              onChange={(e) => setLayer('nbr', clampN(num(e.target.value), 0, 255))} />
          </div>
          <div className="vz-field">
            <label>Opacity {ev.layer.opacity}</label>
            <input type="range" min={0} max={255} value={ev.layer.opacity}
              onChange={(e) => setLayer('opacity', num(e.target.value))} />
          </div>
        </div>
        <div className="vz-field">
          <label>Blending mode</label>
          <select value={ev.layer.blendingMode}
            onChange={(e) => setLayer('blendingMode', num(e.target.value))}>
            {BLEND_OPTIONS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="vz-sec">
        <div className="vz-row vz-sec-head">
          <h4>{isStripEvent(ev) ? 'LED strip effect' : 'Effect'}</h4>
          <span className="vz-evtype" title="Event type">
            <button className={!isStripEvent(ev) ? 'on' : ''} onClick={() => convertTo('effect')}>
              💡 Effect
            </button>
            <button className={isStripEvent(ev) ? 'on' : ''} onClick={() => convertTo('strip')}>
              🎏 Strip
            </button>
          </span>
        </div>
        {isStripEvent(ev) ? (
          <StripSection ev={ev} onChange={onChange} />
        ) : (
          <EffectSection ev={ev} onChange={onChange} />
        )}
      </div>

      <button className="danger" onClick={props.onDelete}>🗑 Delete event</button>
    </div>
  );
}

function EffectSection(props: {
  ev: ChoreographyEffectEvent;
  onChange: (fn: (e: ChoreographyEvent) => ChoreographyEvent) => void;
}) {
  const { ev, onChange } = props;
  const isRamp = Array.isArray(ev.effect.intensity);
  const ramp = isRamp ? (ev.effect.intensity as Array<{ at: number; value: number }>) : null;
  const constVal = isRamp ? 255 : (ev.effect.intensity as number);

  const setFx = (k: string, v: number) =>
    onChange((x) => {
      const e = x as ChoreographyEffectEvent;
      return { ...e, effect: { ...e.effect, [k]: v } };
    });
  const setColor = (i: number, v: number) =>
    onChange((x) => {
      const e = x as ChoreographyEffectEvent;
      const c = [...e.effect.color] as ChoreographyEffect['color'];
      c[i] = clampN(v || 0, 0, 255);
      return { ...e, effect: { ...e.effect, color: c } };
    });
  const hex =
    '#' +
    ev.effect.color
      .slice(0, 3)
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');

  return (
    <>
      <div className="vz-field">
        <label>Style</label>
        <select value={ev.effect.style} onChange={(e) => setFx('style', num(e.target.value))}>
          {STYLE_OPTIONS.map(([v, n]) => <option key={v} value={v}>{n} ({v})</option>)}
        </select>
      </div>
      <div className="vz-row">
        <div className="vz-field">
          <label>Frequency</label>
          <input type="number" min={0} max={255} value={ev.effect.frequency}
            onChange={(e) => setFx('frequency', clampN(num(e.target.value), 0, 255))} />
        </div>
        <div className="vz-field">
          <label>Eff. duration</label>
          <input type="number" min={0} max={255} value={ev.effect.duration}
            onChange={(e) => setFx('duration', clampN(num(e.target.value), 0, 255))} />
        </div>
      </div>

      <div className="vz-field">
        <label>Color</label>
        <div className="vz-color-grid">
          {['R', 'G', 'B', 'W', 'V'].map((n, i) => (
            <div key={n}>
              <label>{n}</label>
              <input type="number" min={0} max={255} value={ev.effect.color[i]}
                onChange={(e) => setColor(i, num(e.target.value))} />
            </div>
          ))}
        </div>
        <div className="vz-row" style={{ alignItems: 'center' }}>
          <input type="color" value={hex}
            onChange={(e) => {
              const v = e.target.value;
              setColor(0, parseInt(v.slice(1, 3), 16));
              setColor(1, parseInt(v.slice(3, 5), 16));
              setColor(2, parseInt(v.slice(5, 7), 16));
            }} />
          <div className="vz-swatch" style={{ background: `rgb(${ev.effect.color.slice(0, 3).join(',')})` }} />
        </div>
      </div>

      <div className="vz-field">
        <label>Intensity</label>
        <div className="vz-row">
          <label><input type="radio" style={{ width: 'auto', marginRight: 6 }}
            checked={!isRamp} onChange={() => setFx('intensity', constVal as number)} />Constant</label>
          <label><input type="radio" style={{ width: 'auto', marginRight: 6 }}
            checked={isRamp}
            onChange={() => onChange((x) => {
              const e = x as ChoreographyEffectEvent;
              return {
                ...e,
                effect: { ...e.effect, intensity: [{ at: 0, value: constVal }, { at: 1, value: 255 }] },
              };
            })} />Ramp</label>
        </div>
        {!isRamp ? (
          <input type="range" min={0} max={255} value={constVal}
            onChange={(e) => setFx('intensity', num(e.target.value))} />
        ) : (
          <>
            <div className="vz-row">
              <div className="vz-field">
                <label>From {ramp![0].value}</label>
                <input type="range" min={0} max={255} value={ramp![0].value}
                  onChange={(e) => onChange((x) => {
                    const en = x as ChoreographyEffectEvent;
                    const ks = (en.effect.intensity as Array<{ at: number; value: number }>).map((k) => ({ ...k }));
                    ks[0] = { ...ks[0], value: num(e.target.value) };
                    return { ...en, effect: { ...en.effect, intensity: ks } };
                  })} />
              </div>
              <div className="vz-field">
                <label>To {ramp![ramp!.length - 1].value}</label>
                <input type="range" min={0} max={255} value={ramp![ramp!.length - 1].value}
                  onChange={(e) => onChange((x) => {
                    const en = x as ChoreographyEffectEvent;
                    const ks = (en.effect.intensity as Array<{ at: number; value: number }>).map((k) => ({ ...k }));
                    ks[ks.length - 1] = { ...ks[ks.length - 1], value: num(e.target.value) };
                    return { ...en, effect: { ...en.effect, intensity: ks } };
                  })} />
              </div>
            </div>
            <p className="vz-hint">
              {ramp!.length} points — drag on the block, double-click to add,
              right/Alt-click to remove.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function StripSection(props: {
  ev: ChoreographyStripEvent;
  onChange: (fn: (e: ChoreographyEvent) => ChoreographyEvent) => void;
}) {
  const { ev, onChange } = props;
  const specs = STRIP_PARAM_SPECS[ev.strip.style] ?? [];

  const setStyle = (style: number) =>
    onChange((x) => {
      const e = x as ChoreographyStripEvent;
      return { ...e, strip: { ...e.strip, style } };
    });
  const setParam = (i: number, v: number) =>
    onChange((x) => {
      const e = x as ChoreographyStripEvent;
      const params = [...e.strip.params];
      params[i] = clampN(v || 0, 0, 255);
      return { ...e, strip: { ...e.strip, params } };
    });
  const setColorParams = (idx: readonly [number, number, number], hexVal: string) =>
    onChange((x) => {
      const e = x as ChoreographyStripEvent;
      const params = [...e.strip.params];
      params[idx[0]] = parseInt(hexVal.slice(1, 3), 16);
      params[idx[1]] = parseInt(hexVal.slice(3, 5), 16);
      params[idx[2]] = parseInt(hexVal.slice(5, 7), 16);
      return { ...e, strip: { ...e.strip, params } };
    });
  const hexOf = (idx: readonly [number, number, number]) =>
    '#' + idx.map((i) => (ev.strip.params[i] ?? 0).toString(16).padStart(2, '0')).join('');

  return (
    <>
      <div className="vz-field">
        <label>Style</label>
        <select value={ev.strip.style} onChange={(e) => setStyle(num(e.target.value))}>
          {STRIP_STYLE_OPTIONS.map(([v, n]) => <option key={v} value={v}>{n} ({v})</option>)}
        </select>
      </div>

      {specs.length === 0 ? (
        <p className="vz-hint">This style reads no parameters.</p>
      ) : (
        specs.map((spec) =>
          spec.kind === 'color' ? (
            <div className="vz-field" key={spec.label}>
              <label>{spec.label}</label>
              <div className="vz-row" style={{ alignItems: 'center' }}>
                <input type="color" value={hexOf(spec.idx)}
                  onChange={(e) => setColorParams(spec.idx, e.target.value)} />
                <div className="vz-swatch" style={{ background: hexOf(spec.idx) }} />
                <span className="vz-hint" style={{ marginLeft: 'auto' }}>
                  {spec.idx.map((i) => ev.strip.params[i] ?? 0).join(', ')}
                </span>
              </div>
            </div>
          ) : (
            <div className="vz-field" key={spec.label}>
              <label>{spec.label} — {ev.strip.params[spec.idx] ?? 0}</label>
              <input type="range" min={0} max={255} value={ev.strip.params[spec.idx] ?? 0}
                onChange={(e) => setParam(spec.idx, num(e.target.value))} />
            </div>
          )
        )
      )}
      <p className="vz-hint">
        Params follow the firmware strip-effects spec; bytes not shown stay 0.
      </p>
    </>
  );
}
