export { VibzProvider, VibzContext } from './VibzProvider.js';
export type { VibzContextValue, VibzProviderProps, VibzStatus } from './VibzProvider.js';

export { useVibz } from './useVibz.js';

export { useVibzEvent } from './useVibzEvent.js';
export type { UseVibzEventOptions, UseVibzEventReturn } from './useVibzEvent.js';

export { useVibzButton } from './useVibzButton.js';
export type {
  UseVibzButtonOptions,
  UseVibzButtonReturn,
  VibzButtonHandlers,
  VibzButtonState,
} from './useVibzButton.js';

export { VibzButton } from './VibzButton.js';
export type { VibzButtonProps } from './VibzButton.js';

export { useVibzChoreography } from './useVibzChoreography.js';
export type {
  UseVibzChoreographyOptions,
  UseVibzChoreographyReturn,
  MediaClock,
} from './useVibzChoreography.js';

export {
  normalizeScript,
  intensityAt,
  hasIntensityVariation,
  buildChoreographyEvent,
} from './choreography.js';
export type {
  Choreography,
  ChoreographyEvent,
  ChoreographyEffect,
  ChoreographyLayer,
  Intensity,
  IntensityKeyframe,
} from './choreography.js';

export { buildEvent } from './event-builder.js';
export type {
  EventDescriptor,
  EffectDescriptor,
  LayerDescriptor,
  Color,
  ColorRGB,
  ColorRGBW,
  ColorRGBWV,
} from './event-builder.js';

// Re-export the protocol enums so consumers don't need a separate import.
export { Styles, BlendingModes, GoboTypes, Identifiers } from '../protocol/Identifiers.js';
