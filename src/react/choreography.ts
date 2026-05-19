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

import { buildEvent } from './event-builder.js';
import { Event as VibzEvent } from '../protocol/BinaryTypes.js';
import { Styles, BlendingModes } from '../protocol/Identifiers.js';

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

export interface ChoreographyEvent {
  /** Stable id, used as the controller event key. */
  id: string;
  /** Seconds, on the media timeline. */
  start: number;
  /** Seconds. */
  duration: number;
  mask: number;
  layer: ChoreographyLayer;
  effect: ChoreographyEffect;
}

export interface Choreography {
  version: 2;
  name?: string;
  /** Indicative media duration (seconds). Playback follows the bound media. */
  duration?: number;
  loop: boolean;
  events: ChoreographyEvent[];
}

// ---------------------------------------------------------------------------
// Enum name resolution (case-insensitive; accepts numbers as-is)
// ---------------------------------------------------------------------------

function buildNameIndex(enumObj: Record<string, number>): Map<string, number> {
  const m = new Map<string, number>();
  for (const [k, v] of Object.entries(enumObj)) m.set(k.toLowerCase(), v);
  return m;
}
const STYLE_BY_NAME = buildNameIndex(Styles as unknown as Record<string, number>);
const BLEND_BY_NAME = buildNameIndex(BlendingModes as unknown as Record<string, number>);

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
  return Array.isArray(event.effect.intensity);
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

function normalizeEvent(raw: Record<string, unknown>, index: number): ChoreographyEvent {
  const isLegacy = raw.effect === undefined; // v2 always groups under `effect`
  const layerRaw = (raw.layer as Record<string, unknown>) ?? {};
  const fxRaw = (isLegacy ? raw : (raw.effect as Record<string, unknown>)) ?? {};

  const id =
    raw.id !== undefined && raw.id !== null
      ? String(raw.id)
      : `evt-${index}`;

  const start = Number(isLegacy ? raw.startTime : raw.start) || 0;
  const duration = Math.max(0.001, Number(raw.duration) || 0);

  const intensity = isLegacy
    ? legacyEnvelopeToIntensity(raw)
    : normalizeIntensity((fxRaw as Record<string, unknown>).intensity, 255);

  return {
    id,
    start,
    duration,
    mask: clampByte(raw.mask, 0),
    layer: {
      nbr: clampByte(layerRaw.nbr, 0),
      opacity: clampByte(layerRaw.opacity, 255),
      blendingMode: resolveEnum(
        layerRaw.blendingMode ?? layerRaw.blending_mode,
        BLEND_BY_NAME,
        BlendingModes.Add
      ),
    },
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
): VibzEvent {
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
  });
}
