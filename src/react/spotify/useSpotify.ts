/**
 * useSpotify.ts — convenience hook tying auth + player together. The player is
 * only created once authenticated. Returns both sub-hooks so callers can drive
 * login UI from `auth` and playback + the choreography clock from `player`.
 */

import { useSpotifyAuth, type UseSpotifyAuthOptions, type UseSpotifyAuthReturn } from './useSpotifyAuth.js';
import { useSpotifyPlayer, type UseSpotifyPlayerReturn } from './useSpotifyPlayer.js';

export interface UseSpotifyOptions extends UseSpotifyAuthOptions {
  /** Device name shown in Spotify Connect. */
  name?: string;
  /** 0…1. */
  volume?: number;
}

export interface UseSpotifyReturn {
  auth: UseSpotifyAuthReturn;
  player: UseSpotifyPlayerReturn;
}

export function useSpotify(options: UseSpotifyOptions): UseSpotifyReturn {
  const auth = useSpotifyAuth(options);
  const player = useSpotifyPlayer({
    getToken: auth.getToken,
    enabled: auth.isAuthed,
    name: options.name,
    volume: options.volume,
  });
  return { auth, player };
}
