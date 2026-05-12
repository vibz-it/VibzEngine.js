export class BufferBuilder {
  buffer: number[];
  appendUint8(value: number): void;
  appendInt8(value: number): void;
  appendUint16(value: number): void;
  appendInt16(value: number): void;
  appendUint32(value: number): void;
  appendInt32(value: number): void;
  appendUint64(value: bigint | number): void;
  appendArray(array: ArrayLike<number>): void;
  getBuffer(): Uint8Array;
}

export class Layer {
  nbr: number;
  opacity: number;
  blendingMode: number;
  constructor(nbr?: number, opacity?: number, blendingMode?: number);
}

export class Effect {
  style: number;
  frequency: number;
  duration: number;
  intensity: number;
  /** [R, G, B, W, Vib] */
  color: [number, number, number, number, number];
}

export class Localization {
  zoom: number;
  focus: number;
  goboType: number;
  mapId: number;
  lat: number;
  lon: number;
}

export class Event {
  id: number;
  mask: number;
  targetUid: bigint;
  /** Relative time in ms (int32) */
  startTime: number;
  /** Relative time in ms (int32) */
  stopTime: number;
  layer: Layer;
  effect: Effect;
  localization: Localization;
  encode(): Uint8Array;
}

export class AbsoluteTime {
  timeUs: bigint;
  constructor(microseconds?: bigint | number);
  encode(): Uint8Array;
}

export class RelativeTimeReference {
  timeUs: bigint;
  constructor(microseconds?: bigint | number);
  encode(): Uint8Array;
}
