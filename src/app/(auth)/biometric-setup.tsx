import { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Fingerprint, Lock, Zap, RefreshCw } from "lucide-react-native";
import { Button } from "@/components/ui";
import { useAppStore } from "@/lib/stores/app.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useBiometric } from "@/lib/hooks/useBiometric";
import { COLORS } from "@/constants/config";

export default function BiometricSetupScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const setBiometric = useAuthStore((s) => s.setBiometric);
  const { checkAvailability, authenticate, supportedTypes } = useBiometric();
  const [scanning, setScanning] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  const handleEnable = async () => {
    setScanning(true);
    try {
      const success = await authenticate("Enable fingerprint login for Physiobuddies");
      if (success) {
        await setBiometric(true);
        setEnabled(true);
        showToast("Fingerprint registered successfully");
        setTimeout(() => router.replace("/(app)"), 1800);
      } else {
        showToast("Biometric authentication cancelled");
      }
    } catch {
      showToast("Biometric authentication failed");
    } finally {
      setScanning(false);
    }
  };

  if (enabled) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-success/15 items-center justify-center mb-4">
          <View className="w-12 h-12 rounded-full bg-success/20 items-center justify-center">
            <Text className="text-success text-4xl font-black">✓</Text>
          </View>
        </View>
        <Text className="text-[20px] font-bold text-fg mb-2">Fingerprint enabled!</Text>
        <Text className="text-muted text-[13px] text-center max-w-[260px]">
          You can now log in with a single touch. Heading to your dashboard…
        </Text>
      </View>
    );
  }

  const hasFingerprint = supportedTypes.includes("fingerprint");
  const hasFacial = supportedTypes.includes("facial");
  const biometricLabel = hasFacial ? "Face ID" : hasFingerprint ? "Fingerprint" : "Biometric";

  return (
    <View className="flex-1 bg-bg items-center justify-center px-6 py-8">
      <View className="w-full max-w-[340px]" style={{ gap: 22 }}>
        <View className="items-center">
          <View
            className={`w-32 h-32 rounded-full bg-white border-[3px] border-border items-center justify-center ${scanning ? "border-accent" : ""}`}
            style={{ shadowColor: COLORS.nav, shadowOpacity: 0.12, shadowRadius: 28, elevation: 6 }}
          >
            <Fingerprint size={68} color={COLORS.accent} />
          </View>
        </View>

        <View className="items-center">
          <Text className="text-[22px] font-extrabold text-fg">Enable {biometricLabel} login</Text>
          <Text className="text-muted text-[13px] mt-2 text-center leading-6">
            Add a quick and secure way to log in each day. Your biometric data stays on your device — never leaves it.
          </Text>
        </View>

        <View className="bg-primary-soft rounded-md p-3.5" style={{ gap: 8 }}>
          <View className="flex-row items-center gap-2.5">
            <Lock size={18} color={COLORS.accent} />
            <View>
              <Text className="text-[13px] font-bold text-fg">Stored on device only</Text>
              <Text className="text-muted text-[11px]">Physiobuddies never receives your fingerprint</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2.5">
            <Zap size={18} color={COLORS.accent} />
            <View>
              <Text className="text-[13px] font-bold text-fg">1-tap daily login</Text>
              <Text className="text-muted text-[11px]">Skip OTP on trusted devices</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2.5">
            <RefreshCw size={18} color={COLORS.accent} />
            <View>
              <Text className="text-[13px] font-bold text-fg">Fallback to OTP anytime</Text>
              <Text className="text-muted text-[11px]">Always available if biometric fails</Text>
            </View>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Button onPress={handleEnable} disabled={scanning}>
            <Fingerprint size={18} color="#fff" />
            <Text className="text-white font-bold text-[14px]">
              {scanning ? "Scanning..." : `Enable ${biometricLabel}`}
            </Text>
          </Button>
          <Button variant="secondary" onPress={() => router.replace("/(app)")}>
            Skip for now
          </Button>
          <Text className="text-muted text-[11px] text-center">
            You can enable this later in Settings → Security
          </Text>
        </View>
      </View>
    </View>
  );
}
