/**
 * pkce.ts — helpers for Spotify's Authorization Code + PKCE flow.
 *
 * PKCE lets a pure browser app (no server, no client secret) obtain user
 * tokens safely: we send a hashed challenge with the authorize request and the
 * original verifier with the token exchange. All crypto is via Web Crypto.
 */

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A URL-safe random string (verifier / state). */
export function randomString(length = 64): string {
  const charset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  let out = '';
  for (const v of values) out += charset[v % charset.length];
  return out;
}

/** S256 code challenge for a verifier. */
export async function codeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(digest);
}
