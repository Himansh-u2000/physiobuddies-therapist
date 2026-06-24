import { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Fingerprint } from "lucide-react-native";
import { useAppStore } from "@/lib/stores/app.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useBiometric } from "@/lib/hooks/useBiometric";

export default function BiometricUnlockScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const therapist = useAuthStore((s) => s.therapist);
  const { authenticate } = useBiometric();
  const [scanning, setScanning] = useState(false);

  const handleUnlock = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const success = await authenticate("Unlock Physiobuddies Therapist");
      if (success) {
        showToast("Fingerprint recognised — logging in…");
        setTimeout(() => router.replace("/(app)"), 600);
      }
    } catch {
      showToast("Authentication failed. Try OTP instead.");
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(handleUnlock, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 bg-black">
      <LinearGradient colors={["#021526", "#003554"]} className="absolute inset-0" />
      <View className="flex-1 items-center justify-between px-6 pt-16 pb-12">
        <View className="items-center">
          <View className="w-10 h-10 rounded-[10px] bg-white items-center justify-center mb-2">
            <Text className="text-accent font-black text-lg">P</Text>
          </View>
          <Text className="text-white text-[18px] font-extrabold">Physiobuddies Therapist</Text>
        </View>

        <View className="items-center" style={{ gap: 20 }}>
          <Pressable
            onPress={handleUnlock}
            className={`w-36 h-36 rounded-full items-center justify-center ${scanning ? "bg-success/20" : "bg-white/10"}`}
            style={{ borderWidth: 2, borderColor: "rgba(255,255,255,0.25)" }}
          >
            <Fingerprint size={64} color="#fff" />
          </Pressable>
          <View className="items-center">
            <Text className="text-white font-bold text-[15px]">Touch to unlock</Text>
            <Text className="text-white/60 text-[12px] mt-1">
              {therapist?.name ?? "Dr. Riya Sharma"} · {therapist?.specialization ?? "MPT Orthopedics"}
            </Text>
          </View>
        </View>

        <View className="w-full max-w-[300px]" style={{ gap: 10 }}>
          <Pressable
            onPress={() => router.replace("/(auth)/otp")}
            className="h-[46px] rounded-[13px] items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.24)" }}
          >
            <Text className="text-white font-bold text-[14px]">Use OTP instead</Text>
          </Pressable>
          <Text className="text-white/40 text-[11px] text-center">
            Not {therapist?.name?.split(" ").slice(-1)[0] ?? "Riya"}?{" "}
            <Text className="text-white/70 font-bold" onPress={() => {
              useAuthStore.getState().logout();
              router.replace("/(auth)/login");
            }}>
              Switch account
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}
