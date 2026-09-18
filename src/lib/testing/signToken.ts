/**
 * Build a JWT-shaped string for tests.
 *
 * Unsigned — nothing in the app verifies signatures (the server is the authority); the app only
 * *reads* the payload, for the `role` and `exp` claims. Tests need real-shaped tokens because
 * `hydrate` and the refresh path both refuse a token whose claims can't be read, so the old
 * `"access"` / `"refresh"` placeholders now correctly fail closed.
 *
 * Hand-rolled base64url rather than `Buffer`: this project has no `@types/node`, and `btoa` is not
 * in the Hermes/jest-expo environment either.
 */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i += 3) {
    const a = input.charCodeAt(i);
    const b = input.charCodeAt(i + 1);
    const c = input.charCodeAt(i + 2);
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | (Number.isNaN(b) ? 0 : b >> 4)];
    out += Number.isNaN(b) ? "=" : B64[((b & 15) << 2) | (Number.isNaN(c) ? 0 : c >> 6)];
    out += Number.isNaN(c) ? "=" : B64[c & 63];
  }
  return out;
}

const base64Url = (s: string) => base64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** `{ id, role, exp }` → a token the app's readers accept. `exp` is in SECONDS, as JWT defines it. */
export function signToken(payload: Record<string, unknown>): string {
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${base64Url(JSON.stringify(payload))}.testsignature`;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** A valid therapist access/refresh pair, both in the future. */
export const therapistToken = (overrides: Record<string, unknown> = {}) =>
  signToken({ id: "u1", role: "therapist", exp: nowSeconds() + 900, ...overrides });

export const expiredToken = (role = "therapist") =>
  signToken({ id: "u1", role, exp: nowSeconds() - 60 });
