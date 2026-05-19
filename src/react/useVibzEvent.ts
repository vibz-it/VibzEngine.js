import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useVibz } from './useVibz.js';
import { buildEvent, type EventDescriptor } from './event-builder.js';

export interface UseVibzEventOptions {
  /** Effect/layer descriptor. Read on each play() call, so inline objects are fine. */
  event: EventDescriptor;
  /** Stable id used by the controller. Auto-generated if omitted. */
  eventId?: string;
}

export interface UseVibzEventReturn {
  /** Start the event. Idempotent if already active. No-op if not connected. */
  play: () => void;
  /** Stop the event. No-op if not active or not connected. */
  stop: () => void;
  /** True between the last play() and the next stop(). */
  active: boolean;
  /** Mirrors useVibz().status === 'connected'. */
  connected: boolean;
}

/**
 * Headless primitive for one named event. Exposes `play`/`stop` you can bind
 * to any interaction — hover, click, scroll-trigger, gesture, etc. Lower-level
 * than `useVibzButton` (no press-source tracking, no DOM handlers).
 *
 * @example
 * const wave = useVibzEvent({
 *   event: { effect: { style: Styles.Wave, color: [0, 120, 255] } },
 * });
 * <div onMouseEnter={wave.play} onMouseLeave={wave.stop} />
 */
export function useVibzEvent(options: UseVibzEventOptions): UseVibzEventReturn {
  const { controller, status } = useVibz();
  const autoId = useId();
  const eventId = options.eventId ?? `vibz-event-${autoId}`;
  const connected = status === 'connected';

  const descRef = useRef(options.event);
  descRef.current = options.event;
  const activeRef = useRef(false);

  const [active, setActive] = useState(false);

  const play = useCallback(() => {
    if (!connected) return;
    try {
      controller.playEvent(eventId, buildEvent(descRef.current));
      activeRef.current = true;
      setActive(true);
    } catch {
      /* fire-and-forget */
    }
  }, [controller, eventId, connected]);

  const stop = useCallback(() => {
    if (!activeRef.current) return;
    void controller.stopEvent(eventId).catch(() => {});
    activeRef.current = false;
    setActive(false);
  }, [controller, eventId]);

  // Always stop on unmount.
  useEffect(() => {
    return () => {
      if (activeRef.current) {
        void controller.stopEvent(eventId).catch(() => {});
        activeRef.current = false;
      }
    };
  }, [controller, eventId]);

  // Clear local active state if we got disconnected mid-play.
  useEffect(() => {
    if (!connected && activeRef.current) {
      activeRef.current = false;
      setActive(false);
    }
  }, [connected]);

  return { play, stop, active, connected };
}
