import { isExpired, TOKEN_EXPIRY_SKEW_MS } from "@/lib/storage/secure";
import type { AuthTokens } from "@/types";

/**
 * `isExpired` gates whether the request interceptor refreshes before sending. Getting it
 * wrong is silent in both directions: too eager burns a refresh per request, too lax lets
 * every request fail once with a 401.
 */

function tokens(expiresAt: number): AuthTokens {
  return { accessToken: "header.payload.sig", refreshToken: "refresh", expiresAt };
}

describe("isExpired", () => {
  it("treats a token comfortably in the future as valid", () => {
    expect(isExpired(tokens(Date.now() + 10 * 60 * 1000))).toBe(false);
  });

  it("treats an already-elapsed token as expired", () => {
    expect(isExpired(tokens(Date.now() - 1000))).toBe(true);
  });

  it("refreshes early, inside the skew window", () => {
    // Still technically valid, but too close to expiry to risk sending.
    expect(isExpired(tokens(Date.now() + TOKEN_EXPIRY_SKEW_MS / 2))).toBe(true);
  });

  it("does not refresh just outside the skew window", () => {
    expect(isExpired(tokens(Date.now() + TOKEN_EXPIRY_SKEW_MS + 5000))).toBe(false);
  });

  it("honours a caller-supplied skew", () => {
    const expiresAt = Date.now() + 30_000;
    expect(isExpired(tokens(expiresAt), 60_000)).toBe(true);
    expect(isExpired(tokens(expiresAt), 5_000)).toBe(false);
  });

  it("treats a null token bundle as expired", () => {
    expect(isExpired(null)).toBe(true);
  });

  it("treats an empty access token as expired", () => {
    expect(isExpired({ accessToken: "", refreshToken: "r", expiresAt: Date.now() + 1e6 })).toBe(
      true,
    );
  });

  // Fails CLOSED. `Date.now() >= NaN - skew` evaluates to false, so a naive implementation
  // would report a corrupt token as valid forever and never refresh it.
  it("treats a NaN expiry as expired rather than valid", () => {
    expect(isExpired(tokens(Number.NaN))).toBe(true);
  });

  it("treats a non-finite expiry as expired", () => {
    expect(isExpired(tokens(Number.POSITIVE_INFINITY))).toBe(true);
  });
});
