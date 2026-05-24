/**
 * spotify-sdk.ts — the slim subset of the Spotify Web Playback SDK we use,
 * typed locally so we don't pull in the full `@types/spotify-web-playback-sdk`
 * dependency. See https://developer.spotify.com/documentation/web-playback-sdk
 */

export interface SpotifyArtist {
  name: string;
  uri?: string;
}

export interface SpotifyImage {
  url: string;
  width?: number;
  height?: number;
}

export interface SpotifyTrack {
  uri: string;
  name: string;
  duration_ms?: number;
  artists?: SpotifyArtist[];
  album?: { name?: string; images?: SpotifyImage[] };
}

export interface SpotifyPlaybackState {
  paused: boolean;
  /** Playhead position in ms (snapshot — interpolate between updates). */
  position: number;
  /** Track length in ms. */
  duration: number;
  track_window: { current_track: SpotifyTrack };
}

export interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (arg: unknown) => void): boolean;
  removeListener(event: string, cb?: (arg: unknown) => void): boolean;
  getCurrentState(): Promise<SpotifyPlaybackState | null>;
  setName(name: string): Promise<void>;
  getVolume(): Promise<number>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  /** Required on some browsers to start the audio element from a gesture. */
  activateElement(): Promise<void>;
}

export interface SpotifyPlayerInit {
  name: string;
  getOAuthToken: (cb: (token: string) => void) => void;
  volume?: number;
}

export interface SpotifyNamespace {
  Player: new (init: SpotifyPlayerInit) => SpotifyPlayer;
}

declare global {
  interface Window {
    Spotify?: SpotifyNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}
