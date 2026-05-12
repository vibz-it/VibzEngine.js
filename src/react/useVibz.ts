import { useContext } from 'react';
import { VibzContext, type VibzContextValue } from './VibzProvider.js';

/**
 * Hook for top-level Vibz device control. Returns connection status,
 * connect/disconnect actions, and the underlying controller for escape-hatch
 * use. Must be used inside a `<VibzProvider>`.
 */
export function useVibz(): VibzContextValue {
  const ctx = useContext(VibzContext);
  if (!ctx) {
    throw new Error('useVibz() must be used inside a <VibzProvider>.');
  }
  return ctx;
}
