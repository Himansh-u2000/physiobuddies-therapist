import { Linking } from "react-native";

/**
 * Single entry point for every "call the patient" intent in the app. Today this just opens
 * the device dialer with the number already in hand. `appointmentId` is threaded through
 * even though it's unused today so the eventual IVR swap (resolve a masked number
 * server-side by appointment, don't expose the patient's real number to the therapist's
 * phone log) is a one-file change here, not a call-site hunt across the three screens that
 * currently dial directly.
 */
export async function callPatient(phone: string, appointmentId?: string): Promise<void> {
  void appointmentId;
  await Linking.openURL(`tel:${phone}`);
}
