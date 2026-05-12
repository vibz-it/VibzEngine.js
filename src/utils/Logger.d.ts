export class Logger {
  static LEVEL: {
    DEBUG: 0;
    INFO: 1;
    WARN: 2;
    ERROR: 3;
    NONE: 4;
  };
  level: number;
  customOutput: ((message: string, level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') => void) | null;
  setLevel(level: number): void;
  setCustomOutput(cb: (message: string, level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') => void): void;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export const logger: Logger;
