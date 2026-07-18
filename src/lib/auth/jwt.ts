/**
 * Minimal, dependency-free JWT payload decoding.
 *
 * The backend issues access (15m) / refresh (7d) tokens but does NOT return an `expiresAt`
 * (see auth.service.ts `generateTokens`). We derive it from the token's own `exp` claim so
 * the client can pre-emptively refresh. This does NOT verify the signature — it only reads
 * the (public) payload for scheduling; the server remains the source of truth on validity.
 *
 * Hermes has no reliable global `atob`, so we decode base64url by hand.
 */

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Decode a base64url string to a binary (Latin-1) string. */
function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  let output = "";
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < b64.length; i++) {
    const ch = b64[i];
    if (ch === "=") break;
    const idx = B64_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

/** Interpret a binary string as UTF-8 (safe for non-ASCII names in the payload). */
function toUtf8(binary: string): string {
  try {
    // eslint-disable-next-line no-restricted-globals
    return decodeURIComponent(escape(binary));
  } catch {
    return binary;
  }
}

export function decodeJwt<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(toUtf8(base64UrlDecode(parts[1]))) as T;
  } catch {
    return null;
  }
}

/**
 * Epoch-ms expiry for an access token, from its `exp` claim.
 * Falls back to `now + fallbackMs` (default 15 min, matching the backend) if undecodable.
 */
export function jwtExpiryMs(token: string, fallbackMs = 15 * 60 * 1000): number {
  const payload = decodeJwt<{ exp?: number }>(token);
  const exp = payload && typeof payload.exp === "number" ? payload.exp : null;
  return exp ? exp * 1000 : Date.now() + fallbackMs;
}
