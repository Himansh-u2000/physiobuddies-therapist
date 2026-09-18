/**
 * The iOS half of push registration: an FCM token, obtained through `@react-native-firebase`.
 *
 * ## Why iOS needs this and Android doesn't
 *
 * The backend sends with firebase-admin, which can only address **FCM registration tokens**. On
 * Android, `Notifications.getDevicePushTokenAsync()` already returns one. On iOS it returns the raw
 * **APNs** device token instead — something firebase-admin cannot send to at all. The Firebase iOS
 * SDK is what exchanges the APNs token for an FCM token, and `@react-native-firebase/messaging` is
 * how this app reaches it.
 *
 * ## iOS only, by construction
 *
 * The package is excluded from Android autolinking (`package.json` → `expo.autolinking.android`),
 * because its Android side declares a second `MESSAGING_EVENT` service and duplicate notification
 * meta-data that clash with expo-notifications. So it is `require`d lazily, inside functions that
 * only iOS reaches — Android never evaluates the module, and the JS bundle has no top-level import
 * of a native module that is absent there.
 */
import { Platform } from "react-native";

type MessagingModule = typeof import("@react-native-firebase/messaging");

function loadMessaging(): MessagingModule {
  if (Platform.OS !== "ios") {
    throw new Error("@react-native-firebase/messaging is only linked on iOS");
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@react-native-firebase/messaging") as MessagingModule;
}

/**
 * Registration failures that retrying cannot fix, because the BUILD is missing something.
 *
 *   - `no-app` / "No Firebase App": `GoogleService-Info.plist` was not bundled, so Firebase never
 *     started (see FCM_SETUP.md).
 *   - `aps-environment`: the build has no push entitlement. Every **simulator** build from EAS is in
 *     this state — they are unsigned — so this is what the current iOS test build reports.
 *
 * Everything else (network, APNs not answering yet) is treated as transient.
 */
export function isConfigurationError(error: unknown): boolean {
  const text = error instanceof Error ? `${(error as { code?: string }).code ?? ""} ${error.message}` : String(error);
  return /no-app|no firebase app|aps-environment|not been configured/i.test(text);
}

/**
 * An APNs device token: 64 hex characters (32 bytes). FCM tokens are longer and contain `:`.
 *
 * Used as a hard guard. An APNs token posted to the backend is a row firebase-admin can never
 * deliver to, and every send would still fan out to it — so whichever path one arrives by, it is
 * refused rather than trusted.
 */
export function looksLikeApnsToken(token: string): boolean {
  return /^[0-9a-f]{64}$/i.test(token.trim());
}

/**
 * Fetch this iPhone's FCM token. Throws on failure; see `isConfigurationError` to tell a build gap
 * from a transient error.
 *
 * `registerDeviceForRemoteMessages` is idempotent and is what makes iOS hand over an APNs token;
 * `getToken` then fails until that exchange has happened, so the order matters.
 */
export async function getIosFcmToken(): Promise<string | null> {
  const m = loadMessaging();
  const messaging = m.getMessaging();
  await m.registerDeviceForRemoteMessages(messaging);
  const token = await m.getToken(messaging);
  return token || null;
}

/** Subscribe to FCM token rotation on iOS. Returns an unsubscribe; a no-op anywhere else. */
export function onIosFcmTokenRefresh(listener: (token: string) => void): () => void {
  if (Platform.OS !== "ios") return () => {};
  try {
    const m = loadMessaging();
    return m.onTokenRefresh(m.getMessaging(), listener);
  } catch {
    // Firebase not configured in this build — there is no token to rotate.
    return () => {};
  }
}
