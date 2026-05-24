/**
 * SpotifyProvider.tsx — a single shared Spotify session for the whole app.
 *
 * The Spotify Web Playback SDK does not support more than one `Spotify.Player`
 * instance per page (the second never reaches `ready`). So instead of each
 * consumer calling `useSpotify()` (which would each spin up a player), mount
 * **one** `SpotifyProvider` at the app root and read the shared session via
 * `useSpotifyContext()` / `useSpotifyOptional()`.
 */

import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import { useSpotify, type UseSpotifyOptions, type UseSpotifyReturn } from './useSpotify.js';
import type { MediaClock } from '../useVibzChoreography.js';

const SpotifyContext = createContext<UseSpotifyReturn | null>(null);

export interface SpotifyProviderProps extends UseSpotifyOptions {
  children: ReactNode;
}

export function SpotifyProvider({ children, ...options }: SpotifyProviderProps) {
  const value = useSpotify(options);
  return <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>;
}

/** The shared Spotify session, or `null` if no provider is mounted above. */
export function useSpotifyContext(): UseSpotifyReturn | null {
  return useContext(SpotifyContext);
}

const NULL_CLOCK: RefObject<MediaClock | null> = { current: null };

/** A stable, inert session used when no provider is present. */
const DISABLED_SPOTIFY: UseSpotifyReturn = {
  auth: {
    token: null,
    isAuthed: false,
    loading: false,
    error: null,
    login: async () => {},
    logout: () => {},
    getToken: async () => null,
  },
  player: {
    ready: false,
    deviceId: null,
    clockRef: NULL_CLOCK,
    paused: true,
    position: 0,
    duration: 0,
    track: null,
    error: null,
    playTrack: async () => {},
    toggle: async () => {},
    pause: async () => {},
    resume: async () => {},
    seek: async () => {},
  },
};

/**
 * Like {@link useSpotifyContext} but never returns null — falls back to an inert
 * session so components can use Spotify state unconditionally even when no
 * provider is mounted (the controls simply do nothing).
 */
export function useSpotifyOptional(): UseSpotifyReturn {
  return useContext(SpotifyContext) ?? DISABLED_SPOTIFY;
}
