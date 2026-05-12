import type { ReactNode } from 'react';
import {
  useVibzButton,
  type UseVibzButtonOptions,
  type UseVibzButtonReturn,
} from './useVibzButton.js';

export interface VibzButtonProps extends UseVibzButtonOptions {
  /**
   * Render-prop. Receives the full hook return so you can spread `handlers`,
   * attach `ref`, and react to `state`.
   */
  children: (api: UseVibzButtonReturn) => ReactNode;
}

/**
 * Headless component for a press-to-light button. The library owns behavior
 * (mouse / touch / keyboard handling, frame send/stop, connection state);
 * the consumer owns rendering and styling.
 *
 * @example
 * <VibzButton event={{ effect: { style: Styles.Pulse, color: [255, 49, 75] } }}>
 *   {({ ref, handlers, state }) => (
 *     <button ref={ref} {...handlers} disabled={!state.connected}>
 *       {state.pressed ? 'Pulsing…' : 'Press me'}
 *     </button>
 *   )}
 * </VibzButton>
 */
export function VibzButton({ children, ...options }: VibzButtonProps) {
  const api = useVibzButton(options);
  return <>{children(api)}</>;
}
