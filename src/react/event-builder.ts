import { Event as VibzEvent } from '../protocol/BinaryTypes.js';

export type ColorRGB = readonly [r: number, g: number, b: number];
export type ColorRGBW = readonly [r: number, g: number, b: number, w: number];
export type ColorRGBWV = readonly [r: number, g: number, b: number, w: number, vib: number];
export type Color = ColorRGB | ColorRGBW | ColorRGBWV;

export interface EffectDescriptor {
  /** Style id from `Styles` (e.g. Styles.Pulse). */
  style?: number;
  /** Color tuple. Missing channels default to 0. */
  color?: Color;
  /** 0–255. Defaults to 255 (full). */
  intensity?: number;
  /** 0–255. Style-dependent meaning (Hz-like). */
  frequency?: number;
  /** 0–255. Style-dependent meaning. */
  duration?: number;
}

export interface LayerDescriptor {
  /** Layer index (0–3 typically). */
  nbr?: number;
  /** 0–255. Defaults to 255. */
  opacity?: number;
  /** BlendingModes value. Defaults to Normal (0). */
  blendingMode?: number;
}

export interface EventDescriptor {
  effect: EffectDescriptor;
  layer?: LayerDescriptor;
  /** Routing mask. */
  mask?: number;
  /** Target a specific device UID; 0n broadcasts to all. */
  targetUid?: bigint;
  /**
   * Relative start time in ms (device clock = Date.now() - referenceTime).
   * Leave unset for "start now" — the controller fills it in. Set explicitly
   * to phase-align an effect to an external timeline (see useVibzChoreography).
   */
  startTime?: number;
  /** Relative stop time in ms. Pair with `startTime` for scheduled playback. */
  stopTime?: number;
}

/**
 * Build a `VibzEvent` instance from a plain descriptor. Pure function — safe
 * to call on every press. Defaults: intensity=255, opacity=255.
 */
export function buildEvent(desc: EventDescriptor): VibzEvent {
  const evt = new VibzEvent();

  if (desc.mask !== undefined) evt.mask = desc.mask;
  if (desc.targetUid !== undefined) evt.targetUid = desc.targetUid;
  if (desc.startTime !== undefined) evt.startTime = desc.startTime;
  if (desc.stopTime !== undefined) evt.stopTime = desc.stopTime;

  const fx = desc.effect;
  if (fx.style !== undefined) evt.effect.style = fx.style;
  evt.effect.intensity = fx.intensity ?? 255;
  if (fx.frequency !== undefined) evt.effect.frequency = fx.frequency;
  if (fx.duration !== undefined) evt.effect.duration = fx.duration;
  if (fx.color) {
    const [r, g, b, w = 0, vib = 0] = fx.color;
    evt.effect.color = [r, g, b, w, vib];
  }

  if (desc.layer) {
    if (desc.layer.nbr !== undefined) evt.layer.nbr = desc.layer.nbr;
    if (desc.layer.opacity !== undefined) evt.layer.opacity = desc.layer.opacity;
    if (desc.layer.blendingMode !== undefined) evt.layer.blendingMode = desc.layer.blendingMode;
  }

  return evt;
}
