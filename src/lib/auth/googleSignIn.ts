import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isErrorWithCode,
} from "@react-native-google-signin/google-signin";
import { AUTH_CONFIG } from "@/constants/config";

/**
 * Google Sign-In abstraction (single swap point).
 *
 * The backend uses the OAuth **authorization-code** flow (`POST /auth/google?code=…`), so we
 * configure the native SDK with the **Web** client ID + `offlineAccess: true` to receive a
 * `serverAuthCode`. That code is posted to the backend, which exchanges it server-side using
 * the web client secret. Requires a dev build (not Expo Go) and configured credentials — see
 * GOOGLE_SIGNIN_SETUP.md.
 */

export const isGoogleConfigured = AUTH_CONFIG.googleWebClientId.length > 0;

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: AUTH_CONFIG.googleWebClientId,
    offlineAccess: true, // required to receive serverAuthCode for the backend exchange
  });
  configured = true;
}

export type GoogleErrorCode =
  | "cancelled"
  | "in_progress"
  | "play_services"
  | "not_configured"
  | "no_code"
  | "unknown";

export class GoogleSignInError extends Error {
  readonly code: GoogleErrorCode;
  constructor(message: string, code: GoogleErrorCode) {
    super(message);
    this.name = "GoogleSignInError";
    this.code = code;
  }
}

export interface GoogleAuthResult {
  serverAuthCode: string;
  idToken: string | null;
  email: string | null;
}

export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  if (!isGoogleConfigured) {
    throw new GoogleSignInError(
      "Google Sign-In isn't configured yet. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.",
      "not_configured",
    );
  }
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      throw new GoogleSignInError("Google sign-in was cancelled.", "cancelled");
    }

    const { serverAuthCode, idToken, user } = response.data;
    if (!serverAuthCode) {
      throw new GoogleSignInError(
        "Google didn't return an authorization code. Verify offlineAccess and the Web client ID.",
        "no_code",
      );
    }
    return { serverAuthCode, idToken: idToken ?? null, email: user?.email ?? null };
  } catch (e) {
    if (e instanceof GoogleSignInError) throw e;
    if (isErrorWithCode(e)) {
      switch (e.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw new GoogleSignInError("Google sign-in was cancelled.", "cancelled");
        case statusCodes.IN_PROGRESS:
          throw new GoogleSignInError("A sign-in is already in progress.", "in_progress");
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new GoogleSignInError(
            "Google Play Services isn't available or needs an update.",
            "play_services",
          );
      }
    }
    throw new GoogleSignInError("Google sign-in failed. Please try again.", "unknown");
  }
}

/** Clear the native Google session (call alongside app logout). Best-effort. */
export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // ignore — not signed in, or native module unavailable
  }
}
