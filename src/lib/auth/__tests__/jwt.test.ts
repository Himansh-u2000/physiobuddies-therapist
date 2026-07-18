import { decodeJwt, jwtExpiryMs } from "@/lib/auth/jwt";

/**
 * The backend returns no `expiresAt` (auth.service.ts `generateTokens` sends only
 * `{ accessToken, refreshToken }`), so the client derives expiry from the token's own
 * `exp` claim. If this decoding is wrong the app either refreshes constantly or never
 * refreshes at all — and neither is visible until a token actually ages out on a device.
 */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Unpadded base64url encoder. Hand-rolled rather than using Node's `Buffer` so the test
 * relies only on what React Native itself provides — the same constraint that forced
 * `jwt.ts` to hand-roll its decoder.
 */
function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += B64[b0 >> 2];
    out += B64[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    if (b1 === undefined) break;
    out += B64[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    if (b2 === undefined) break;
    out += B64[b2 & 0x3f];
  }
  return out.replace(/\+/g, "-").replace(/\//g, "_");
}

function b64url(value: unknown): string {
  return base64UrlEncode(JSON.stringify(value));
}

function makeToken(payload: unknown): string {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.signature-not-verified`;
}

describe("decodeJwt", () => {
  it("decodes the payload of a well-formed token", () => {
    const token = makeToken({ id: "user_123", role: "therapist", exp: 1_800_000_000 });
    expect(decodeJwt(token)).toEqual({ id: "user_123", role: "therapist", exp: 1_800_000_000 });
  });

  it("decodes payloads of every length mod 4 (base64 padding is stripped)", () => {
    // Varying the id length shifts where padding would have been required.
    for (const id of ["a", "ab", "abc", "abcd", "abcde"]) {
      expect(decodeJwt<{ id: string }>(makeToken({ id }))?.id).toBe(id);
    }
  });

  it("decodes non-ASCII payload values", () => {
    // Therapist names are free text; a mangled decode here would throw at JSON.parse
    // and silently degrade every token to the fallback expiry.
    const token = makeToken({ name: "Ravi Krishnan — Physiothérapie 東京", exp: 123 });
    expect(decodeJwt<{ name: string }>(token)?.name).toBe("Ravi Krishnan — Physiothérapie 東京");
  });

  it("handles base64url-specific characters", () => {
    // Payload chosen so the standard-base64 encoding contains both '+' and '/',
    // which base64url rewrites to '-' and '_'.
    const payload = { data: "ÿÿþ???>>>" };
    expect(decodeJwt(makeToken(payload))).toEqual(payload);
  });

  it("returns null for structurally invalid tokens", () => {
    expect(decodeJwt("")).toBeNull();
    expect(decodeJwt("only-one-part")).toBeNull();
  });

  it("returns null when the payload is not valid JSON", () => {
    const notJson = base64UrlEncode("this is not json");
    expect(decodeJwt(`header.${notJson}.sig`)).toBeNull();
  });
});

describe("jwtExpiryMs", () => {
  it("converts the exp claim from seconds to epoch milliseconds", () => {
    const expSeconds = 1_800_000_000;
    expect(jwtExpiryMs(makeToken({ exp: expSeconds }))).toBe(expSeconds * 1000);
  });

  it("falls back to now + 15 minutes when the token carries no exp", () => {
    const before = Date.now();
    const result = jwtExpiryMs(makeToken({ id: "user_123" }));
    expect(result).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
    expect(result).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
  });

  it("falls back when the token cannot be decoded at all", () => {
    const before = Date.now();
    expect(jwtExpiryMs("garbage")).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
  });

  it("ignores a non-numeric exp rather than producing NaN", () => {
    // NaN would poison every downstream expiry comparison silently.
    expect(Number.isNaN(jwtExpiryMs(makeToken({ exp: "soon" })))).toBe(false);
  });

  it("honours a caller-supplied fallback window", () => {
    const before = Date.now();
    expect(jwtExpiryMs(makeToken({ id: "x" }), 1000)).toBeGreaterThanOrEqual(before + 1000);
  });

  it("preserves expiry precision for a real 15-minute backend token", () => {
    // Mirrors the backend's `expiresIn: '15m'`: exp is whole seconds, so the derived
    // millisecond value must land within a second of 15 minutes out.
    const exp = Math.floor(Date.now() / 1000) + 15 * 60;
    const drift = Math.abs(jwtExpiryMs(makeToken({ exp })) - (Date.now() + 15 * 60 * 1000));
    expect(drift).toBeLessThan(1000);
  });
});
