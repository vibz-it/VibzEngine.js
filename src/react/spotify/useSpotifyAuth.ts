/**
 * useSpotifyAuth.ts — Spotify login for a static browser app via the
 * Authorization Code + PKCE flow (no client secret, no backend).
 *
 * Flow:
 *  1. `login()` builds a PKCE challenge, stashes the verifier, and redirects to
 *     Spotify's consent screen. Call it from a user gesture (it navigates away).
 *  2. Spotify redirects back to `redirectUri` with `?code=…`. On mount this hook
 *     detects the code, exchanges it for tokens, then cleans the URL.
 *  3. `getToken()` returns a valid access token, transparently refreshing with
 *     the stored refresh token when it is near expiry.
 *
 * The Web Playback SDK (actual track playback) additionally requires the
 * listener to have **Spotify Premium**.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { randomString, codeChallenge } from './pkce.js';

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

const STORE_KEY = 'vibz.spotify.token';
const VERIFIER_KEY = 'vibz.spotify.verifier';
const STATE_KEY = 'vibz.spotify.state';

/** Scopes needed for the Web Playback SDK + starting playback by track URI. */
export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
];

interface StoredToken {
  access_token: string;
  refresh_token?: string;
  /** Epoch ms. */
  expires_at: number;
}

export interface UseSpotifyAuthOptions {
  /** Spotify app Client ID (public; from the developer dashboard). */
  clientId: string;
  /**
   * Redirect URI registered on the Spotify app. Defaults to the current
   * origin + path. Must match exactly, character for character.
   */
  redirectUri?: string;
  /** Override the default scope set. */
  scopes?: string[];
}

export interface UseSpotifyAuthReturn {
  /** Current access token (may be near expiry; prefer `getToken()`). */
  token: string | null;
  /** Whether we hold a (possibly refreshable) session. */
  isAuthed: boolean;
  /** True while the redirect code is being exchanged. */
  loading: boolean;
  error: Error | null;
  /** Start the OAuth redirect. Must run inside a user gesture. */
  login: () => Promise<void>;
  /** Forget the stored session. */
  logout: () => void;
  /** A fresh access token, refreshed if needed; `null` if signed out. */
  getToken: () => Promise<string | null>;
}

function defaultRedirect(): string {
  return window.location.origin + window.location.pathname;
}

function loadStored(): StoredToken | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch {
    return null;
  }
}

function saveStored(token: StoredToken | null): void {
  try {
    if (token) localStorage.setItem(STORE_KEY, JSON.stringify(token));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* storage disabled — session simply won't persist */
  }
}

function cleanUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
}

export function useSpotifyAuth(options: UseSpotifyAuthOptions): UseSpotifyAuthReturn {
  const { clientId } = options;
  const redirectUri =
    options.redirectUri ?? (typeof window !== 'undefined' ? defaultRedirect() : '');
  const scopes = options.scopes ?? SPOTIFY_SCOPES;

  const [stored, setStored] = useState<StoredToken | null>(() =>
    typeof window !== 'undefined' ? loadStored() : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const storedRef = useRef(stored);
  storedRef.current = stored;

  const setToken = useCallback((token: StoredToken | null) => {
    saveStored(token);
    setStored(token);
  }, []);

  // ---- handle the redirect back from Spotify (?code=…) ----------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('error');
    if (authError) {
      setError(new Error(`Spotify authorization failed: ${authError}`));
      cleanUrl();
      return;
    }
    const code = params.get('code');
    if (!code) return;

    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    const expectedState = sessionStorage.getItem(STATE_KEY);
    const returnedState = params.get('state');
    // Not our redirect (or stale/forged) — leave it alone.
    if (!verifier || (expectedState && returnedState !== expectedState)) return;

    setLoading(true);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    });
    fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error_description || j.error);
        setToken({
          access_token: j.access_token,
          refresh_token: j.refresh_token,
          expires_at: Date.now() + (j.expires_in ?? 3600) * 1000,
        });
      })
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => {
        setLoading(false);
        sessionStorage.removeItem(VERIFIER_KEY);
        sessionStorage.removeItem(STATE_KEY);
        cleanUrl();
      });
  }, [clientId, redirectUri, setToken]);

  const login = useCallback(async () => {
    setError(null);
    const verifier = randomString(64);
    const challenge = await codeChallenge(verifier);
    const state = randomString(16);
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
      scope: scopes.join(' '),
    });
    window.location.assign(`${AUTH_URL}?${params.toString()}`);
  }, [clientId, redirectUri, scopes]);

  const refresh = useCallback(
    async (refreshToken: string): Promise<StoredToken | null> => {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      });
      const r = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error_description || j.error);
      const next: StoredToken = {
        access_token: j.access_token,
        refresh_token: j.refresh_token ?? refreshToken,
        expires_at: Date.now() + (j.expires_in ?? 3600) * 1000,
      };
      setToken(next);
      return next;
    },
    [clientId, setToken]
  );

  const getToken = useCallback(async (): Promise<string | null> => {
    const current = storedRef.current;
    if (!current) return null;
    // Still valid (with a 60 s safety margin).
    if (Date.now() < current.expires_at - 60_000) return current.access_token;
    if (current.refresh_token) {
      try {
        const next = await refresh(current.refresh_token);
        return next?.access_token ?? null;
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setToken(null);
        return null;
      }
    }
    setToken(null);
    return null;
  }, [refresh, setToken]);

  const logout = useCallback(() => setToken(null), [setToken]);

  return {
    token: stored?.access_token ?? null,
    isAuthed: !!stored,
    loading,
    error,
    login,
    logout,
    getToken,
  };
}
