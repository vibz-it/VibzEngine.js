import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { VibzController } from '../core/VibzController.js';

export type VibzStatus =
  | 'unsupported'
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export interface VibzContextValue {
  controller: VibzController;
  status: VibzStatus;
  error: Error | null;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
}

export const VibzContext = createContext<VibzContextValue | null>(null);

export interface VibzProviderProps {
  children: ReactNode;
  /** Log level forwarded to the underlying controller (0=debug ... 4=none). */
  logLevel?: number;
  /** Inject an existing controller instead of creating one (testing). */
  controller?: VibzController;
}

function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export function VibzProvider({ children, logLevel, controller: injected }: VibzProviderProps) {
  const controllerRef = useRef<VibzController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = injected ?? new VibzController();
  }
  const controller = controllerRef.current;

  const [status, setStatus] = useState<VibzStatus>(() =>
    isWebSerialSupported() ? 'idle' : 'unsupported'
  );
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (logLevel !== undefined) controller.setLogLevel(logLevel);
  }, [controller, logLevel]);

  useEffect(() => {
    controller.setOnDisconnect(() => {
      setStatus('idle');
    });
    return () => {
      controller.setOnDisconnect(null);
      controller.disconnect().catch(() => {});
    };
  }, [controller]);

  const connect = useCallback(async (): Promise<boolean> => {
    if (!isWebSerialSupported()) {
      setStatus('unsupported');
      return false;
    }
    setError(null);
    setStatus('connecting');
    try {
      const ok = await controller.connect();
      setStatus(ok ? 'connected' : 'idle');
      return ok;
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setStatus('error');
      return false;
    }
  }, [controller]);

  const disconnect = useCallback(async (): Promise<void> => {
    setStatus('disconnecting');
    try {
      await controller.disconnect();
    } finally {
      setStatus('idle');
    }
  }, [controller]);

  const value = useMemo<VibzContextValue>(
    () => ({ controller, status, error, connect, disconnect }),
    [controller, status, error, connect, disconnect]
  );

  return <VibzContext.Provider value={value}>{children}</VibzContext.Provider>;
}
