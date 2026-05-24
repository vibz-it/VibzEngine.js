import type { Event, EventStrip } from '../protocol/BinaryTypes.js';

export class VibzController {
  constructor();
  /** Device reference time (ms). Relative event times are `Date.now() - referenceTime`. */
  get referenceTime(): number;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  setOnDisconnect(callback: (() => void) | null): void;
  /** Schedule/refresh an event. Accepts a regular Event or a strip EventStrip. */
  playEvent(id: string, event: Event | EventStrip): void;
  stopEvent(id: string): Promise<void>;
  setLogLevel(level: number): void;
}
