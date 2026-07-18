import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

/**
 * Apple Sign-In abstraction (iOS only; App Store Guideline 4.8 — required once Google is
 * offered on iOS).
 *
 * STUB STATUS: the backend has no `/auth/apple` endpoint yet, so this obtains the Apple
 * credential natively but the exchange is stubbed in `authApi.loginWithApple` (mock only).
 * On-device Apple verification is deferred to Phase 8 (needs an Apple Developer account).
 */

export const isAppleAuthAvailable = Platform.OS === "ios";

export type AppleErrorCode = "cancelled" | "unavailable" | "unknown";

export class AppleSignInError extends Error {
  readonly code: AppleErrorCode;
  constructor(message: string, code: AppleErrorCode) {
    super(message);
    this.name = "AppleSignInError";
    this.code = code;
  }
}

export interface AppleAuthResult {
  identityToken: string;
  authorizationCode: string | null;
  /** Only present on the FIRST authorization — Apple never sends it again. Persist it. */
  fullName: string | null;
  email: string | null;
}

export async function signInWithApple(): Promise<AppleAuthResult> {
  if (Platform.OS !== "ios") {
    throw new AppleSignInError("Apple Sign-In is only available on iOS.", "unavailable");
  }
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new AppleSignInError("Apple Sign-In isn't available on this device.", "unavailable");
  }
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const fullName = credential.fullName
      ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ") ||
        null
      : null;
    return {
      identityToken: credential.identityToken ?? "",
      authorizationCode: credential.authorizationCode ?? null,
      fullName,
      email: credential.email ?? null,
    };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "ERR_REQUEST_CANCELED") {
      throw new AppleSignInError("Apple sign-in was cancelled.", "cancelled");
    }
    throw new AppleSignInError("Apple sign-in failed. Please try again.", "unknown");
  }
}
