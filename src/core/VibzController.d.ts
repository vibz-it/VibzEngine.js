import type { Event } from '../protocol/BinaryTypes.js';

export class VibzController {
  constructor();
  /** Device reference time (ms). Relative event times are `Date.now() - referenceTime`. */
  get referenceTime(): number;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  setOnDisconnect(callback: (() => void) | null): void;
  playEvent(id: string, event: Event): void;
  stopEvent(id: string): Promise<void>;
  setLogLevel(level: number): void;
}
