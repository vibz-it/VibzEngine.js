/**
 * useSpotifyPlayer.ts — wraps the Spotify Web Playback SDK as a Vibz media
 * clock. It loads the SDK, creates a player, connects it, and exposes:
 *
 *  - `clockRef`: a stable `{ current: MediaClock }` whose `currentTime` is the
 *    **interpolated** playhead (the SDK only emits position on state changes, so
 *    we extrapolate with `performance.now()` between them). Feed it straight to
 *    `useVibzChoreography({ media: clockRef })` — no engine changes needed.
 *  - controls: `playTrack(uri)`, `toggle()`, `pause()`, `resume()`, `seek(s)`.
 *
 * Requires the listener to have Spotify Premium; free accounts raise an
 * `account_error`.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { MediaClock } from '../useVibzChoreography.js';
import type { SpotifyPlaybackState, SpotifyPlayer } from './spotify-sdk.js';

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';
const API = 'https://api.spotify.com/v1';

let sdkPromise: Promise<void> | null = null;

/** Inject the SDK <script> once; resolves when `window.Spotify` is ready. */
function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Spotify) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load the Spotify SDK'));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export interface SpotifyTrackInfo {
  uri: string;
  title: string;
  artist: string;
  artwork?: string;
}

export interface UseSpotifyPlayerOptions {
  /** Returns a fresh OAuth token — pass `useSpotifyAuth().getToken`. */
  getToken: () => Promise<string | null>;
  /** Gate player creation (e.g. only once authenticated). Default `true`. */
  enabled?: boolean;
  /** Device name shown in Spotify Connect. */
  name?: string;
  /** 0…1. */
  volume?: number;
}

export interface UseSpotifyPlayerReturn {
  /** SDK loaded, player connected and registered as a device. */
  ready: boolean;
  deviceId: string | null;
  /** Live interpolated clock for `useVibzChoreography({ media })`. */
  clockRef: RefObject<MediaClock | null>;
  paused: boolean;
  /** Last reported position (s). For UI; `clockRef` is the smooth source. */
  position: number;
  /** Current track length (s). */
  duration: number;
  track: SpotifyTrackInfo | null;
  error: Error | null;
  /** Start playback of a track URI on this device. */
  playTrack: (uri: string) => Promise<void>;
  toggle: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
}

interface ClockState {
  posMs: number;
  durMs: number;
  paused: boolean;
  /** `performance.now()` when this snapshot was taken. */
  ts: number;
}

export function useSpotifyPlayer(
  options: UseSpotifyPlayerOptions
): UseSpotifyPlayerReturn {
  const { getToken, enabled = true, name = 'Vibz Show', volume = 0.8 } = options;

  const playerRef = useRef<SpotifyPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const clockStateRef = useRef<ClockState>({
    posMs: 0,
    durMs: 0,
    paused: true,
    ts: typeof performance !== 'undefined' ? performance.now() : 0,
  });

  // Stable MediaClock object whose getters interpolate the last SDK snapshot.
  const clockRef = useRef<MediaClock>({
    get currentTime() {
      const s = clockStateRef.current;
      const ms = s.paused ? s.posMs : s.posMs + (performance.now() - s.ts);
      const cap = s.durMs > 0 ? s.durMs : Number.POSITIVE_INFINITY;
      return Math.max(0, Math.min(cap, ms)) / 1000;
    },
    get duration() {
      return clockStateRef.current.durMs / 1000;
    },
    get paused() {
      return clockStateRef.current.paused;
    },
  });

  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [track, setTrack] = useState<SpotifyTrackInfo | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let player: SpotifyPlayer | null = null;

    loadSdk()
      .then(() => {
        if (cancelled || !window.Spotify) return;
        player = new window.Spotify.Player({
          name,
          volume,
          getOAuthToken: (cb) => {
            void getTokenRef.current().then((t) => {
              if (t) cb(t);
            });
          },
        });
        playerRef.current = player;

        player.addListener('ready', (arg) => {
          if (cancelled) return;
          const { device_id } = arg as { device_id: string };
          deviceIdRef.current = device_id;
          setDeviceId(device_id);
          setReady(true);
        });
        player.addListener('not_ready', () => {
          if (!cancelled) setReady(false);
        });
        player.addListener('player_state_changed', (arg) => {
          if (cancelled || !arg) return;
          const st = arg as SpotifyPlaybackState;
          clockStateRef.current = {
            posMs: st.position,
            durMs: st.duration,
            paused: st.paused,
            ts: performance.now(),
          };
          setPaused(st.paused);
          setPosition(st.position / 1000);
          setDuration(st.duration / 1000);
          const cur = st.track_window?.current_track;
          if (cur) {
            setTrack({
              uri: cur.uri,
              title: cur.name,
              artist: (cur.artists ?? []).map((a) => a.name).join(', '),
              artwork: cur.album?.images?.[0]?.url,
            });
          }
        });
        const onError = (arg: unknown) => {
          if (cancelled) return;
          const msg = (arg as { message?: string })?.message;
          setError(new Error(msg || 'Spotify player error'));
        };
        player.addListener('initialization_error', onError);
        player.addListener('authentication_error', onError);
        player.addListener('account_error', (arg) => {
          if (cancelled) return;
          const msg = (arg as { message?: string })?.message;
          setError(new Error(msg || 'Spotify Premium is required to play here'));
        });
        player.addListener('playback_error', onError);

        void player.connect();
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });

    return () => {
      cancelled = true;
      try {
        player?.disconnect();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      deviceIdRef.current = null;
      setReady(false);
    };
  }, [enabled, name, volume]);

  const playTrack = useCallback(async (uri: string) => {
    const token = await getTokenRef.current();
    const dev = deviceIdRef.current;
    if (!token || !dev) throw new Error('Spotify player is not ready yet');
    // Browsers may need the audio element activated from a user gesture.
    try {
      await playerRef.current?.activateElement();
    } catch {
      /* not always required */
    }
    const res = await fetch(
      `${API}/me/player/play?device_id=${encodeURIComponent(dev)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [uri] }),
      }
    );
    if (!res.ok && res.status !== 202 && res.status !== 204) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Spotify play failed (${res.status}) ${detail}`.trim());
    }
  }, []);

  const toggle = useCallback(async () => {
    await playerRef.current?.togglePlay();
  }, []);
  const pause = useCallback(async () => {
    await playerRef.current?.pause();
  }, []);
  const resume = useCallback(async () => {
    await playerRef.current?.resume();
  }, []);
  const seek = useCallback(async (seconds: number) => {
    await playerRef.current?.seek(Math.max(0, Math.round(seconds * 1000)));
  }, []);

  return {
    ready,
    deviceId,
    clockRef,
    paused,
    position,
    duration,
    track,
    error,
    playTrack,
    toggle,
    pause,
    resume,
    seek,
  };
}
