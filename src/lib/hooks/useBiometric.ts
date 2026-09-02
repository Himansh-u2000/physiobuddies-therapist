import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useMemo, useState } from "react";
import { Platform } from "react-native";

export type BiometricType = "fingerprint" | "facial" | "iris" | null;

/**
 * What to call the device's biometric, in the user's own vocabulary.
 *
 * **"Face ID" is an Apple feature name and must never appear on Android.** That was the bug:
 * the label was picked purely from `supportedAuthenticationTypesAsync()`, facial checked first,
 * so any Android phone whose hardware reports face unlock said "Face ID" — including phones
 * where the therapist actually authenticates with a fingerprint.
 *
 * Two things make that easy to get wrong, and both are handled here:
 *
 *  1. **The enum is platform-blind.** `FACIAL_RECOGNITION` means Face ID on iOS and camera face
 *     unlock on Android; only `Platform.OS` distinguishes them. So platform picks the noun.
 *  2. **It reports hardware, not enrolment** (documented). A phone with both a fingerprint
 *     sensor and a face camera lists both, whatever the user actually set up — so on Android,
 *     "both" resolves to the neutral "Biometric" rather than guessing at one and being
 *     wrong half the time. iOS devices ship one or the other, so naming it there is safe.
 */
export interface BiometricNaming {
  /** Sentence-case noun for buttons and headings: "Face ID", "Fingerprint", "Biometric". */
  label: string;
  /** Which glyph to draw. */
  icon: "face" | "fingerprint";
  /** How the user physically does it — "Look at your phone to unlock" vs "Touch to unlock". */
  action: string;
  /** Every method this device advertises, for the capabilities list on the setup screen. */
  methods: string[];
}

export function biometricNaming(types: BiometricType[]): BiometricNaming {
  const facial = types.includes("facial");
  const fingerprint = types.includes("fingerprint");
  const iris = types.includes("iris");

  if (Platform.OS === "ios") {
    // Apple's own names. An iPhone/iPad has Face ID or Touch ID, never both.
    if (facial) {
      return { label: "Face ID", icon: "face", action: "Look at your phone to unlock", methods: ["Face ID"] };
    }
    if (fingerprint) {
      return { label: "Touch ID", icon: "fingerprint", action: "Touch to unlock", methods: ["Touch ID"] };
    }
    return { label: "Biometric", icon: "fingerprint", action: "Authenticate to unlock", methods: [] };
  }

  // Android — generic vocabulary, matching what the OS itself calls these in Settings.
  const methods = [
    fingerprint ? "Fingerprint" : null,
    facial ? "Face unlock" : null,
    iris ? "Iris" : null,
  ].filter((m): m is string => m !== null);

  if (methods.length > 1) {
    return {
      label: "Biometric",
      // The fingerprint sensor is the one the user reaches for on a phone that has both.
      icon: "fingerprint",
      action: "Verify to unlock",
      methods,
    };
  }
  if (fingerprint) {
    return { label: "Fingerprint", icon: "fingerprint", action: "Touch to unlock", methods };
  }
  if (facial) {
    return { label: "Face unlock", icon: "face", action: "Look at your phone to unlock", methods };
  }
  if (iris) {
    return { label: "Iris unlock", icon: "face", action: "Look at your phone to unlock", methods };
  }
  return { label: "Biometric", icon: "fingerprint", action: "Verify to unlock", methods };
}

export function useBiometric() {
  const [supportedTypes, setSupportedTypes] = useState<BiometricType[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);

  const checkAvailability = useCallback(async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      setSupportedTypes([]);
      setIsEnrolled(false);
      return { compatible: false, enrolled: false };
    }
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsEnrolled(enrolled);
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const mapped: BiometricType[] = types.map((t) => {
      switch (t) {
        case LocalAuthentication.AuthenticationType.FINGERPRINT:
          return "fingerprint";
        case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
          return "facial";
        case LocalAuthentication.AuthenticationType.IRIS:
          return "iris";
        default:
          return null;
      }
    });
    setSupportedTypes(mapped);
    return { compatible: true, enrolled };
  }, []);

  const authenticate = useCallback(
    async (promptMessage = "Authenticate to continue") => {
      // disableDeviceFallback:false keeps the passcode fallback available when biometric fails.
      return LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
    },
    [],
  );

  const naming = useMemo(() => biometricNaming(supportedTypes), [supportedTypes]);

  return { supportedTypes, isEnrolled, checkAvailability, authenticate, naming };
}
