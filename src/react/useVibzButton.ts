import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type PointerEventHandler,
} from 'react';
import { useVibz } from './useVibz.js';
import { buildEvent, type EventDescriptor } from './event-builder.js';

export interface VibzButtonState {
  /** True while at least one input source is pressing. */
  pressed: boolean;
  /** True between mouse-enter and mouse-leave. */
  hovering: boolean;
  /** True between focus and blur. */
  focused: boolean;
  /** True when the device is connected and ready to receive events. */
  connected: boolean;
  /** True when the consumer (or this hook) is disabled. */
  disabled: boolean;
}

export interface VibzButtonHandlers {
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
  onPointerLeave: PointerEventHandler<HTMLElement>;
  onMouseEnter: MouseEventHandler<HTMLElement>;
  onMouseLeave: MouseEventHandler<HTMLElement>;
  onKeyDown: KeyboardEventHandler<HTMLElement>;
  onKeyUp: KeyboardEventHandler<HTMLElement>;
  onFocus: FocusEventHandler<HTMLElement>;
  onBlur: FocusEventHandler<HTMLElement>;
}

export interface UseVibzButtonOptions {
  /** Effect/layer descriptor sent on press. Read on each press, so inline objects are fine. */
  event: EventDescriptor;
  /** Stable id used by the controller to track this event. Auto-generated if omitted. */
  eventId?: string;
  /** Skip sending frames while true (still tracks pressed state for UI). */
  disabled?: boolean;
  /** Called when the first press source activates and the play frame is sent. */
  onPlay?: () => void;
  /** Called when the last press source releases and the stop frame is sent. */
  onStop?: () => void;
}

export interface UseVibzButtonReturn {
  ref: (node: HTMLElement | null) => void;
  handlers: VibzButtonHandlers;
  state: VibzButtonState;
  /** Imperatively start the effect (e.g. to drive it from non-press UI). */
  play: () => void;
  /** Imperatively stop the effect. */
  stop: () => void;
}

const PRESS_KEYS = new Set([' ', 'Spacebar', 'Enter']);

/**
 * Headless behavior for a "press-to-light" button. Wraps the controller's
 * `playEvent`/`stopEvent` with multi-input press tracking (pointer + keyboard).
 * Rendering is entirely delegated to the consumer via the returned handlers.
 */
export function useVibzButton(options: UseVibzButtonOptions): UseVibzButtonReturn {
  const { controller, status } = useVibz();
  const autoId = useId();
  const eventId = options.eventId ?? `vibz-button-${autoId}`;
  const disabled = options.disabled ?? false;
  const connected = status === 'connected';

  // Latest descriptor & callbacks — read in handlers without re-binding handlers.
  const descRef = useRef(options.event);
  descRef.current = options.event;
  const onPlayRef = useRef(options.onPlay);
  onPlayRef.current = options.onPlay;
  const onStopRef = useRef(options.onStop);
  onStopRef.current = options.onStop;

  // Press sources currently active. Multi-source so a key press while the
  // mouse is held doesn't double-stop. Values are arbitrary tags.
  const sourcesRef = useRef<Set<string>>(new Set());
  const elementRef = useRef<HTMLElement | null>(null);

  const [pressed, setPressed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);

  const play = useCallback(() => {
    if (disabled || !connected) return;
    try {
      controller.playEvent(eventId, buildEvent(descRef.current));
      onPlayRef.current?.();
    } catch {
      // Swallow: playEvent is fire-and-forget per the core's design.
    }
  }, [controller, eventId, disabled, connected]);

  const stop = useCallback(() => {
    if (!connected) return;
    void controller.stopEvent(eventId).catch(() => {});
    onStopRef.current?.();
  }, [controller, eventId, connected]);

  const acquire = useCallback(
    (source: string) => {
      const wasEmpty = sourcesRef.current.size === 0;
      sourcesRef.current.add(source);
      if (wasEmpty) {
        setPressed(true);
        play();
      }
    },
    [play]
  );

  const release = useCallback(
    (source: string) => {
      if (!sourcesRef.current.delete(source)) return;
      if (sourcesRef.current.size === 0) {
        setPressed(false);
        stop();
      }
    },
    [stop]
  );

  // Stop the running event if the component unmounts while pressed,
  // or if the consumer disables/disconnects mid-press.
  useEffect(() => {
    return () => {
      if (sourcesRef.current.size > 0) {
        sourcesRef.current.clear();
        try {
          void controller.stopEvent(eventId).catch(() => {});
        } catch {
          /* noop */
        }
      }
    };
  }, [controller, eventId]);

  useEffect(() => {
    if ((disabled || !connected) && sourcesRef.current.size > 0) {
      sourcesRef.current.clear();
      setPressed(false);
      void controller.stopEvent(eventId).catch(() => {});
    }
  }, [disabled, connected, controller, eventId]);

  const ref = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
  }, []);

  const handlers = useMemo<VibzButtonHandlers>(() => {
    return {
      onPointerDown: (e) => {
        if (disabled) return;
        // Primary button only (left click / touch / pen).
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* not all browsers/elements support capture */
        }
        acquire(`pointer:${e.pointerId}`);
      },
      onPointerUp: (e) => {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        release(`pointer:${e.pointerId}`);
      },
      onPointerCancel: (e) => {
        release(`pointer:${e.pointerId}`);
      },
      onPointerLeave: (e) => {
        // With pointer capture, leave still fires but up will follow on the
        // captured target. Do nothing here — release happens on up/cancel.
        if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          release(`pointer:${e.pointerId}`);
        }
      },
      onMouseEnter: () => setHovering(true),
      onMouseLeave: () => setHovering(false),
      onKeyDown: (e) => {
        if (disabled) return;
        if (!PRESS_KEYS.has(e.key)) return;
        if (e.repeat) return;
        e.preventDefault();
        acquire('keyboard');
      },
      onKeyUp: (e) => {
        if (!PRESS_KEYS.has(e.key)) return;
        e.preventDefault();
        release('keyboard');
      },
      onFocus: () => setFocused(true),
      onBlur: () => {
        setFocused(false);
        // Releasing focus while a key was held: drop the keyboard source.
        release('keyboard');
      },
    };
  }, [disabled, acquire, release]);

  const state = useMemo<VibzButtonState>(
    () => ({ pressed, hovering, focused, connected, disabled }),
    [pressed, hovering, focused, connected, disabled]
  );

  return { ref, handlers, state, play, stop };
}
