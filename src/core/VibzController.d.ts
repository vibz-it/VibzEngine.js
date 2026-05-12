import type { Event } from '../protocol/BinaryTypes.js';

export class VibzController {
  constructor();
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  setOnDisconnect(callback: (() => void) | null): void;
  playEvent(id: string, event: Event): void;
  stopEvent(id: string): Promise<void>;
  setLogLevel(level: number): void;
}
