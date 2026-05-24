import { useEffect, useRef, useState, type RefObject } from 'react';
import { useVibz } from './useVibz.js';
import {
  normalizeScript,
  buildChoreographyEvent,
  hasIntensityVariation,
  intensityAt,
  isStripEvent,
  type Choreography,
} from './choreography.js';

/** Minimal slice of HTMLMediaElement the sync loop reads. */
export interface MediaClock {
  currentTime: number;
  duration: number;
  paused: boolean;
}

export interface UseVibzChoreographyOptions {
  /**
   * The script: a URL string (fetched as JSON), a parsed object, or an
   * already-normalised {@link Choreography}. Legacy and v2 formats both work.
   */
  script: string | object;
  /** Ref to the media element (or any object exposing {@link MediaClock}). */
  media: RefObject<MediaClock | null>;
  /** Gate playback (e.g. bind to hover). Default `true`. */
  enabled?: boolean;
  /** Watchdog window in ms — device stops an event if not refreshed. Default 1000. */
  watchdogMs?: number;
  /** Refresh cadence for intensity-varying events (ms). Default 50. */
  fastRefreshMs?: number;
  /** Refresh cadence for constant-intensity events (ms). Default 250. */
  slowRefreshMs?: number;
  /**
   * Pre-roll lead time (ms): start sending an event's packet this long *before*
   * its start time. The device schedules on the synced clock (the `startTimeMs`
   * sent is its true, still-future start), so pre-rolling guarantees the packet
   * is already on the device and the effect fires exactly on time despite
   * transport latency. Default 250.
   */
  preRollMs?: number;
}

export interface UseVibzChoreographyReturn {
  /** True while the sync loop is actively driving the device. */
  playing: boolean;
  /** Mirrors useVibz().status === 'connected'. */
  connected: boolean;
  /** True once the script has parsed successfully. */
  ready: boolean;
  /** Set if the script failed to load/parse. */
  error: Error | null;
}

/** Per-event state held across refreshes to keep phase alignment stable. */
interface TrackEntry {
  /** Relative start time (ms) — recomputed only on pause/seek drift. */
  tstartMs: number;
  /** Date.now() of the last frame actually sent. */
  lastSendMs: number;
}

/**
 * Drives a Vibz light script in lock-step with a media element. While
 * `enabled` and connected, it follows `media.currentTime`: each event's packet
 * is sent repeatedly from `preRollMs` before its start until its end, the device
 * start time is held stable (recomputed only on pause/seek so phase-based styles
 * stay aligned), the stop time is clamped to `now + watchdogMs` (so the device
 * self-stops shortly after playback halts), and intensity envelopes are sampled
 * host-side and re-sent at ~20 Hz.
 *
 * Headless: no DOM, no rendering. Bind `enabled` to a hover/visibility state
 * and pass a `<video>` ref.
 *
 * @example
 * const videoRef = useRef(null);
 * const [hover, setHover] = useState(false);
 * useVibzChoreography({ script: '/scripts/section1.json', media: videoRef, enabled: hover });
 * <video ref={videoRef} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} />
 */
export function useVibzChoreography(
  options: UseVibzChoreographyOptions
): UseVibzChoreographyReturn {
  const { controller, status } = useVibz();
  const connected = status === 'connected';

  const {
    script,
    media,
    enabled = true,
    watchdogMs = 1000,
    fastRefreshMs = 50,
    slowRefreshMs = 250,
    preRollMs = 250,
  } = options;

  const [choreo, setChoreo] = useState<Choreography | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Load / parse the script. Re-runs only when the script input identity
  // changes (callers should pass a stable URL string or memoised object).
  useEffect(() => {
    let cancelled = false;
    setError(null);
    const apply = (raw: unknown) => {
      if (cancelled) return;
      try {
        setChoreo(normalizeScript(raw));
      } catch (e) {
        setChoreo(null);
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    };
    if (typeof script === 'string') {
      setChoreo(null);
      fetch(script)
        .then((r) => {
          if (!r.ok) throw new Error(`Failed to load script: ${r.status}`);
          return r.json();
        })
        .then(apply)
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
        });
    } else {
      apply(script);
    }
    return () => {
      cancelled = true;
    };
  }, [script]);

  const ready = choreo !== null;
  const playing = ready && connected && enabled;

  // Keep loop dependencies in refs so the rAF body never goes stale and the
  // effect doesn't re-subscribe every frame.
  const choreoRef = useRef(choreo);
  choreoRef.current = choreo;
  const optsRef = useRef({ watchdogMs, fastRefreshMs, slowRefreshMs, preRollMs });
  optsRef.current = { watchdogMs, fastRefreshMs, slowRefreshMs, preRollMs };

  useEffect(() => {
    if (!playing) return;
    const mediaEl = media;
    const tracking = new Map<string, TrackEntry>();
    let lastTime = -1;
    let rafId = 0;
    let stopped = false;

    const stopAll = () => {
      for (const id of tracking.keys()) {
        void controller.stopEvent(id).catch(() => {});
      }
      tracking.clear();
    };

    const frame = () => {
      if (stopped) return;
      const m = mediaEl.current;
      const cho = choreoRef.current;
      if (m && cho) {
        const { watchdogMs: wd, fastRefreshMs: fast, slowRefreshMs: slow, preRollMs: preMs } =
          optsRef.current;
        const preRoll = preMs / 1000;
        const t = m.currentTime;
        const nowMs = Date.now();
        const relNowMs = nowMs - controller.referenceTime;

        // Seek-back or loop wrap: drop tracked events now in the future so
        // they re-arm cleanly when the playhead reaches them again.
        if (lastTime >= 0 && t < lastTime - 0.5) {
          for (const [id, _] of tracking) {
            const ev = cho.events.find((e) => e.id === id);
            if (!ev || ev.start > t) {
              void controller.stopEvent(id).catch(() => {});
              tracking.delete(id);
            }
          }
        }
        lastTime = t;

        // Active = inside the event window OR within the pre-roll lead before it.
        // During pre-roll `t < e.start`, so `elapsedMs` below is negative and the
        // computed `startTimeMs` is the event's true (future) start on the device.
        const active = cho.events.filter(
          (e) => t >= e.start - preRoll && t <= e.start + e.duration
        );
        const activeIds = new Set(active.map((e) => e.id));

        // Events that fell out of their window: stop them.
        for (const id of [...tracking.keys()]) {
          if (!activeIds.has(id)) {
            void controller.stopEvent(id).catch(() => {});
            tracking.delete(id);
          }
        }

        for (const ev of active) {
          const elapsedMs = (t - ev.start) * 1000;
          const theoreticalTstart = Math.round(relNowMs - elapsedMs);

          let entry = tracking.get(ev.id);
          let forceSend = false;
          if (!entry) {
            entry = { tstartMs: theoreticalTstart, lastSendMs: 0 };
            tracking.set(ev.id, entry);
            forceSend = true;
          } else if (Math.abs(theoreticalTstart - entry.tstartMs) > 50) {
            // Pause/seek detected — re-anchor to stay in sync.
            entry.tstartMs = theoreticalTstart;
            forceSend = true;
          }

          const varies = hasIntensityVariation(ev);
          const refreshMs = varies ? fast : slow;
          if (!forceSend && nowMs - entry.lastSendMs < refreshMs) continue;

          // Strip events carry no intensity envelope (static params).
          const intensity = isStripEvent(ev)
            ? 255
            : intensityAt(ev.effect.intensity, (t - ev.start) / ev.duration);
          const durationMs = ev.duration * 1000;
          const stopMs = Math.min(
            entry.tstartMs + durationMs,
            relNowMs + wd
          );

          try {
            controller.playEvent(
              ev.id,
              buildChoreographyEvent(ev, {
                startTimeMs: entry.tstartMs,
                stopTimeMs: stopMs,
                intensity,
              })
            );
            entry.lastSendMs = nowMs;
          } catch {
            /* fire-and-forget, matches controller design */
          }
        }
      }
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      stopAll();
    };
  }, [playing, controller, media]);

  return { playing, connected, ready, error };
}
