import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useState } from "react";

export type BiometricType = "fingerprint" | "facial" | "iris" | null;

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
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      return result.success;
    },
    [],
  );

  return { supportedTypes, isEnrolled, checkAvailability, authenticate };
}
