/**
 * choreography.ts
 *
 * Pure (framework-free) model + parser for Vibz light scripts, and the math
 * that drives time-synchronised playback. The React binding lives in
 * `useVibzChoreography.ts`; everything here is testable in isolation.
 *
 * Two on-disk formats are accepted by {@link normalizeScript}:
 *  - **v2** (current): grouped `effect`/`layer`, enum names allowed, intensity
 *    as a scalar or a keyframe envelope.
 *  - **legacy** (the vibz.it editor export): flat fields, numeric enums,
 *    `intensityStart/End` + `envelopePoint1X/2X` envelope. Auto-detected by the
 *    absence of `version` so existing scripts keep working unconverted.
 */

import { buildEvent, buildStripEvent } from './event-builder.js';
import { Event as VibzEvent, EventStrip } from '../protocol/BinaryTypes.js';
import { Styles, BlendingModes, StripStyles } from '../protocol/Identifiers.js';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export interface IntensityKeyframe {
  /** Position within the event, 0 (start) … 1 (end). */
  at: number;
  /** 0–255. */
  value: number;
  /** Interpolation from this keyframe to the next. Default `'linear'`. */
  easing?: 'linear' | 'hold';
}

/** A constant level, or an envelope of ≥2 keyframes sorted by `at`. */
export type Intensity = number | IntensityKeyframe[];

export interface ChoreographyEffect {
  style: number;
  frequency: number;
  /** Effect-duration byte (0–255), style-dependent meaning. */
  duration: number;
  /** [r, g, b, w, vib], each 0–255. */
  color: [number, number, number, number, number];
  intensity: Intensity;
}

export interface ChoreographyLayer {
  nbr: number;
  opacity: number;
  blendingMode: number;
}

/** Effect for the addressable LED strip (object 0x0110). */
export interface ChoreographyStripEffect {
  /** StripStyles value. */
  style: number;
  /** 8 generic params (0–255), meaning depends on `style`. */
  params: number[];
}

interface ChoreographyEventBase {
  /** Stable id, used as the controller event key. */
  id: string;
  /** Seconds, on the media timeline. */
  start: number;
  /** Seconds. */
  duration: number;
  mask: number;
  layer: ChoreographyLayer;
}

/** A regular light event (the device's main RGBWV LEDs). */
export interface ChoreographyEffectEvent extends ChoreographyEventBase {
  /** Discriminant. Omitted/`'effect'` for regular events. */
  kind?: 'effect';
  effect: ChoreographyEffect;
}

/** An addressable LED-strip event (WS2812B). */
export interface ChoreographyStripEvent extends ChoreographyEventBase {
  kind: 'strip';
  strip: ChoreographyStripEffect;
}

export type ChoreographyEvent = ChoreographyEffectEvent | ChoreographyStripEvent;

/** Narrow a choreography event to the LED-strip variant. */
export function isStripEvent(e: ChoreographyEvent): e is ChoreographyStripEvent {
  return e.kind === 'strip';
}

/**
 * The media a script is authored against. Lets a single `.json` carry the
 * track/clip it was choreographed to, so a player can reload both at once.
 *  - `spotify`: a Spotify track URI (`spotify:track:…`), played via the Web
 *    Playback SDK. Requires a Premium listener.
 *  - `video` / `audio`: a same-origin or absolute media URL.
 */
export type ChoreographyMedia =
  | { type: 'spotify'; uri: string; title?: string }
  | { type: 'video'; src: string }
  | { type: 'audio'; src: string };

/**
 * Optional beat grid the editor uses to align events to a song's rhythm. Stored
 * so reopening a script keeps the calibration. Playback is unaffected by it.
 */
export interface ChoreographyGrid {
  /** Beats per minute. */
  bpm: number;
  /** Seconds offset of the first downbeat (phase). */
  offset: number;
  /** Beats per bar — a downbeat (strong line) every N beats. */
  beatsPerBar: number;
  /** Grid lines per beat: 1, 2, or 4. */
  subdivision: number;
}

export interface Choreography {
  version: 2;
  name?: string;
  /** Indicative media duration (seconds). Playback follows the bound media. */
  duration?: number;
  /** Optional bound media (e.g. the Spotify track this script was built for). */
  media?: ChoreographyMedia;
  /** Optional beat grid for the editor (BPM/offset/bar/subdivision). */
  grid?: ChoreographyGrid;
  loop: boolean;
  events: ChoreographyEvent[];
}

/**
 * Coerce a Spotify track reference into a canonical `spotify:track:<id>` URI.
 * Accepts an already-canonical URI or an `open.spotify.com/track/<id>` URL
 * (with or without query/locale segments). Returns `null` if unrecognised.
 */
export function spotifyUriFromInput(input: string): string | null {
  const s = input.trim();
  const uri = /^spotify:track:([A-Za-z0-9]+)$/.exec(s);
  if (uri) return `spotify:track:${uri[1]}`;
  const url = /open\.spotify\.com\/(?:[a-z-]+\/)?track\/([A-Za-z0-9]+)/.exec(s);
  if (url) return `spotify:track:${url[1]}`;
  return null;
}

function normalizeMedia(raw: unknown): ChoreographyMedia | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (r.type === 'spotify' && typeof r.uri === 'string') {
    const uri = spotifyUriFromInput(r.uri) ?? r.uri;
    return { type: 'spotify', uri, ...(typeof r.title === 'string' ? { title: r.title } : {}) };
  }
  if ((r.type === 'video' || r.type === 'audio') && typeof r.src === 'string') {
    return { type: r.type, src: r.src };
  }
  return undefined;
}

function normalizeGrid(raw: unknown): ChoreographyGrid | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const bpm = Number(r.bpm);
  if (!Number.isFinite(bpm) || bpm <= 0) return undefined;
  const sub = Number(r.subdivision);
  const offset = Number(r.offset);
  const bpb = Number(r.beatsPerBar);
  return {
    bpm: Math.max(20, Math.min(400, bpm)),
    offset: Number.isFinite(offset) ? offset : 0,
    beatsPerBar: Number.isFinite(bpb) ? Math.max(1, Math.round(bpb)) : 4,
    subdivision: sub === 2 || sub === 4 ? sub : 1,
  };
}

// ---------------------------------------------------------------------------
// Enum name resolution (case-insensitive; accepts numbers as-is)
// ---------------------------------------------------------------------------

function buildNameIndex(enumObj: Record<string, number>): Map<string, number> {
  const m = new Map<string, number>();
  for (const [k, v] of Object.entries(enumObj)) m.set(k.toLowerCase(), v);
  return m;
}
function buildNumberIndex(enumObj: Record<string, number>): Map<number, string> {
  const m = new Map<number, string>();
  for (const [k, v] of Object.entries(enumObj)) if (!m.has(v)) m.set(v, k);
  return m;
}
const STYLE_BY_NAME = buildNameIndex(Styles as unknown as Record<string, number>);
const BLEND_BY_NAME = buildNameIndex(BlendingModes as unknown as Record<string, number>);
const STRIP_STYLE_BY_NAME = buildNameIndex(StripStyles as unknown as Record<string, number>);
const STYLE_NAME = buildNumberIndex(Styles as unknown as Record<string, number>);
const BLEND_NAME = buildNumberIndex(BlendingModes as unknown as Record<string, number>);
const STRIP_STYLE_NAME = buildNumberIndex(StripStyles as unknown as Record<string, number>);

/** Human style name for a protocol number, or the number itself if unnamed. */
export function styleName(value: number): string | number {
  return STYLE_NAME.get(value) ?? value;
}
/** Human blending-mode name for a protocol number, or the number if unnamed. */
export function blendingModeName(value: number): string | number {
  return BLEND_NAME.get(value) ?? value;
}
/** Human strip-style name for a protocol number, or the number if unnamed. */
export function stripStyleName(value: number): string | number {
  return STRIP_STYLE_NAME.get(value) ?? value;
}

function resolveEnum(
  value: unknown,
  byName: Map<string, number>,
  fallback: number
): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const hit = byName.get(value.trim().toLowerCase());
    if (hit !== undefined) return hit;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function clampByte(n: unknown, fallback = 0): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(255, Math.round(v)));
}

function toColor5(input: unknown): [number, number, number, number, number] {
  const arr = Array.isArray(input) ? input : [];
  return [
    clampByte(arr[0]),
    clampByte(arr[1]),
    clampByte(arr[2]),
    clampByte(arr[3]),
    clampByte(arr[4]),
  ];
}

// ---------------------------------------------------------------------------
// Intensity normalisation + sampling
// ---------------------------------------------------------------------------

function normalizeIntensity(raw: unknown, fallback: number): Intensity {
  if (typeof raw === 'number') return clampByte(raw, fallback);
  if (Array.isArray(raw) && raw.length > 0) {
    const kfs: IntensityKeyframe[] = raw
      .map((k) => ({
        at: Math.max(0, Math.min(1, Number((k as IntensityKeyframe).at) || 0)),
        value: clampByte((k as IntensityKeyframe).value, fallback),
        easing:
          (k as IntensityKeyframe).easing === 'hold' ? ('hold' as const) : ('linear' as const),
      }))
      .sort((a, b) => a.at - b.at);
    // Collapse to a scalar if every keyframe carries the same value.
    if (kfs.every((k) => k.value === kfs[0].value)) return kfs[0].value;
    return kfs;
  }
  return clampByte(fallback, 0);
}

/**
 * Translate the legacy 2-point envelope into keyframes. Mirrors the segment
 * logic of the vibz.it editor: hold `start` until point 1, ramp to point 2,
 * then hold `end`.
 */
function legacyEnvelopeToIntensity(e: Record<string, unknown>): Intensity {
  const base = clampByte(e.intensity, 255);
  const start = e.intensityStart !== undefined ? clampByte(e.intensityStart, base) : base;
  const end = e.intensityEnd !== undefined ? clampByte(e.intensityEnd, base) : base;
  if (start === end) return start;
  const c01 = (n: number) => Math.max(0, Math.min(1, n));
  const p1 = c01((Number(e.envelopePoint1X) || 0) / 100);
  const p2 = Math.max(
    p1,
    c01(e.envelopePoint2X !== undefined ? Number(e.envelopePoint2X) / 100 : 1)
  );
  // Plateau at `start` until p1, linear ramp to `end` at p2, then plateau.
  const kfs: IntensityKeyframe[] = [
    { at: 0, value: start, easing: p1 > 0 ? 'hold' : 'linear' },
  ];
  if (p1 > 0) kfs.push({ at: p1, value: start, easing: 'linear' });
  kfs.push({ at: p2, value: end, easing: 'hold' });
  if (p2 < 1) kfs.push({ at: 1, value: end, easing: 'linear' });
  return kfs;
}

/** True when the intensity envelope is not constant (drives faster refresh). */
export function hasIntensityVariation(event: ChoreographyEvent): boolean {
  return !isStripEvent(event) && Array.isArray(event.effect.intensity);
}

/** Sample the intensity at `progress` (0…1) within an event. Returns 0–255. */
export function intensityAt(intensity: Intensity, progress: number): number {
  if (typeof intensity === 'number') return intensity;
  const kfs = intensity;
  const p = Math.max(0, Math.min(1, progress));
  if (p <= kfs[0].at) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (p >= last.at) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const k0 = kfs[i];
    const k1 = kfs[i + 1];
    if (p >= k0.at && p <= k1.at) {
      if (k0.easing === 'hold' || k1.at === k0.at) return k0.value;
      const seg = (p - k0.at) / (k1.at - k0.at);
      return Math.round(k0.value + (k1.value - k0.value) * seg);
    }
  }
  return last.value;
}

// ---------------------------------------------------------------------------
// Parsing / normalisation
// ---------------------------------------------------------------------------

function normalizeStripEffect(raw: unknown): ChoreographyStripEffect {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const params = Array.isArray(r.params) ? r.params : [];
  return {
    style: resolveEnum(r.style, STRIP_STYLE_BY_NAME, StripStyles.Off),
    params: Array.from({ length: 8 }, (_, i) => clampByte(params[i], 0)),
  };
}

function normalizeEvent(raw: Record<string, unknown>, index: number): ChoreographyEvent {
  const layerRaw = (raw.layer as Record<string, unknown>) ?? {};

  const id =
    raw.id !== undefined && raw.id !== null
      ? String(raw.id)
      : `evt-${index}`;

  const mask = clampByte(raw.mask, 0);
  const layer: ChoreographyLayer = {
    nbr: clampByte(layerRaw.nbr, 0),
    opacity: clampByte(layerRaw.opacity, 255),
    blendingMode: resolveEnum(
      layerRaw.blendingMode ?? layerRaw.blending_mode,
      BLEND_BY_NAME,
      BlendingModes.Add
    ),
  };

  // Addressable LED-strip event — always v2 (no legacy form).
  if (raw.kind === 'strip' || raw.strip !== undefined) {
    return {
      kind: 'strip',
      id,
      start: Number(raw.start) || 0,
      duration: Math.max(0.001, Number(raw.duration) || 0),
      mask,
      layer,
      strip: normalizeStripEffect(raw.strip ?? raw),
    };
  }

  // Regular light event (legacy flat form or grouped v2).
  const isLegacy = raw.effect === undefined; // v2 always groups under `effect`
  const fxRaw = (isLegacy ? raw : (raw.effect as Record<string, unknown>)) ?? {};
  const intensity = isLegacy
    ? legacyEnvelopeToIntensity(raw)
    : normalizeIntensity((fxRaw as Record<string, unknown>).intensity, 255);

  return {
    kind: 'effect',
    id,
    start: Number(isLegacy ? raw.startTime : raw.start) || 0,
    duration: Math.max(0.001, Number(raw.duration) || 0),
    mask,
    layer,
    effect: {
      style: resolveEnum((fxRaw as Record<string, unknown>).style, STYLE_BY_NAME, Styles.On),
      frequency: clampByte((fxRaw as Record<string, unknown>).frequency, 0),
      duration: clampByte(
        (fxRaw as Record<string, unknown>).duration ??
          (raw as Record<string, unknown>).effectDuration,
        100
      ),
      color: toColor5((fxRaw as Record<string, unknown>).color ?? raw.colors),
      intensity,
    },
  };
}

/**
 * Parse either format into a normalised {@link Choreography}. Accepts a parsed
 * object or a JSON string. Throws only on structurally invalid input (no
 * `events` array); unknown fields are ignored.
 */
export function normalizeScript(input: unknown): Choreography {
  const raw: Record<string, unknown> =
    typeof input === 'string' ? JSON.parse(input) : (input as Record<string, unknown>);
  if (!raw || !Array.isArray(raw.events)) {
    throw new Error('Invalid choreography: expected an `events` array.');
  }
  return {
    version: 2,
    name: typeof raw.name === 'string' ? raw.name : undefined,
    duration:
      typeof raw.duration === 'number'
        ? raw.duration
        : typeof raw.videoDuration === 'number'
          ? (raw.videoDuration as number)
          : undefined,
    media: normalizeMedia(raw.media),
    grid: normalizeGrid(raw.grid),
    loop: raw.loop === true,
    events: (raw.events as Record<string, unknown>[]).map((e, i) => normalizeEvent(e, i + 1)),
  };
}

// ---------------------------------------------------------------------------
// Event construction for the controller
// ---------------------------------------------------------------------------

export interface BuiltEventTiming {
  /** Relative start time (ms) on the device clock. */
  startTimeMs: number;
  /** Relative stop time (ms). */
  stopTimeMs: number;
  /** Sampled intensity, 0–255. */
  intensity: number;
}

/**
 * Build a protocol `Event` for one choreography event at a given moment.
 * `startTimeMs` is kept stable across refreshes by the caller so phase-based
 * styles (Wave…) stay aligned to the media timeline.
 */
export function buildChoreographyEvent(
  event: ChoreographyEvent,
  timing: BuiltEventTiming
): VibzEvent | EventStrip {
  if (isStripEvent(event)) {
    return buildStripEvent({
      mask: event.mask,
      layer: {
        nbr: event.layer.nbr,
        opacity: event.layer.opacity,
        blendingMode: event.layer.blendingMode,
      },
      effect: { style: event.strip.style, params: event.strip.params },
      startTime: timing.startTimeMs,
      stopTime: timing.stopTimeMs,
      autoExtend: false,
    });
  }
  return buildEvent({
    mask: event.mask,
    layer: {
      nbr: event.layer.nbr,
      opacity: event.layer.opacity,
      blendingMode: event.layer.blendingMode,
    },
    effect: {
      style: event.effect.style,
      frequency: event.effect.frequency,
      duration: event.effect.duration,
      color: event.effect.color,
      intensity: timing.intensity,
    },
    startTime: timing.startTimeMs,
    stopTime: timing.stopTimeMs,
    // The choreography engine owns the stop time (min(eventStop, now+watchdog)),
    // so the device keep-alive loop must not extend it — this lets the device
    // self-stop at the real end even if the explicit stop frame is lost.
    autoExtend: false,
  });
}

/**
 * Inverse of {@link normalizeScript}: produce a clean, human-readable v2
 * document. Enum values are written as names when known; `mask` is omitted
 * when 0. Round-trips through `normalizeScript` losslessly.
 */
export function serializeChoreography(c: Choreography): Record<string, unknown> {
  return {
    version: 2,
    ...(c.name ? { name: c.name } : {}),
    ...(c.duration !== undefined ? { duration: c.duration } : {}),
    ...(c.media ? { media: c.media } : {}),
    ...(c.grid ? { grid: c.grid } : {}),
    loop: c.loop,
    events: c.events.map((e) => {
      const base = {
        id: e.id,
        start: round3(e.start),
        duration: round3(e.duration),
        ...(e.mask ? { mask: e.mask } : {}),
        layer: {
          nbr: e.layer.nbr,
          opacity: e.layer.opacity,
          blendingMode: blendingModeName(e.layer.blendingMode),
        },
      };
      if (isStripEvent(e)) {
        return {
          ...base,
          kind: 'strip',
          strip: { style: stripStyleName(e.strip.style), params: e.strip.params },
        };
      }
      return {
        ...base,
        effect: {
          style: styleName(e.effect.style),
          frequency: e.effect.frequency,
          duration: e.effect.duration,
          color: e.effect.color,
          intensity: Array.isArray(e.effect.intensity)
            ? e.effect.intensity.map((k) => ({
                at: round3(k.at),
                value: k.value,
                ...(k.easing === 'hold' ? { easing: 'hold' } : {}),
              }))
            : e.effect.intensity,
        },
      };
    }),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
