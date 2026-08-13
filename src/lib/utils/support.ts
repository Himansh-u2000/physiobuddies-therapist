import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import { SUPPORT_EMAIL } from "@/constants/config";
import type { Therapist } from "@/types";

/**
 * Open the device mail composer addressed to Physiobuddies support.
 *
 * The body is pre-filled with the details a support agent would otherwise have to ask for —
 * who the therapist is, which build they're on, which OS. That turns a typical "can you tell us
 * your app version?" round trip into zero, and costs the therapist nothing since they can edit
 * or delete it before sending.
 *
 * Returns `false` when no mail client can handle the link (an emulator with no mail app, or a
 * work profile that blocks it) so the caller can fall back to showing the address to copy —
 * silently doing nothing on a tapped support button is the worst outcome here.
 */
export async function openSupportEmail(
  therapist?: Therapist | null,
  subject = "Physiobuddies Therapist — support request",
): Promise<boolean> {
  const version = Constants.expoConfig?.version ?? "unknown";
  // `versionCode` is a number and `buildNumber` a string, so both are stringified before
  // Platform.select — its overloads require every branch to share one type.
  const build =
    Platform.select({
      android: String(Constants.expoConfig?.android?.versionCode ?? ""),
      ios: Constants.expoConfig?.ios?.buildNumber ?? "",
    }) || "—";

  const body = [
    "",
    "",
    "———————————————",
    "Please keep the details below — they help us find your account.",
    `Name: ${therapist?.name ?? "—"}`,
    `Email: ${therapist?.email ?? "—"}`,
    `Phone: ${therapist?.phone ?? "—"}`,
    `App: ${version} (${build})`,
    `Device: ${Platform.OS} ${Platform.Version}`,
  ].join("\n");

  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  try {
    // `canOpenURL` is checked rather than trusted blindly: on Android 11+ a `mailto:` probe
    // needs a `<queries>` entry to return true, so a `false` here doesn't prove there's no mail
    // app. Try to open regardless and treat only a thrown error as a real failure.
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
