import { useEffect, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Fingerprint, LogIn } from "lucide-react-native";
import { useAuthStore } from "@/lib/stores/auth.store";
import { COLORS, GRADIENTS } from "@/constants/config";

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, biometricEnabled, isHydrated } = useAuthStore();
  const navigated = useRef(false);

  useEffect(() => {
    if (!isHydrated || navigated.current) return;
    const timer = setTimeout(() => {
      if (navigated.current) return;
      navigated.current = true;
      if (isAuthenticated && biometricEnabled) {
        router.replace("/(auth)/biometric-unlock");
      } else if (isAuthenticated) {
        router.replace("/(app)");
      } else {
        router.replace("/(auth)/login");
      }
    }, 2200);
    return () => clearTimeout(timer);
  }, [isHydrated, isAuthenticated, biometricEnabled, router]);

  return (
    <View className="flex-1">
      <LinearGradient
        colors={["#021526", "#003554"]}
        className="absolute inset-0"
      />
      <View className="flex-1 items-center justify-center px-7">
        <View className="w-20 h-20 rounded-[22px] bg-white items-center justify-center mb-5" style={{ shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 32, elevation: 12 }}>
          <Text className="text-accent font-black text-3xl">P</Text>
        </View>
        <Text className="text-white text-[24px] font-extrabold text-center tracking-tight leading-tight">
          Physiobuddies{"\n"}Therapist
        </Text>
        <Text className="text-white/70 text-[13px] mt-1.5 text-center">
          Secure partner app for daily physiotherapy work
        </Text>
        <View className="mt-6 w-9 h-9 rounded-full border-4 border-white/20 border-t-white" />
        <View className="mt-7 w-full max-w-[320px]" style={{ gap: 10 }}>
          <Pressable
            onPress={() => {
              if (navigated.current) return;
              navigated.current = true;
              router.replace("/(auth)/login");
            }}
            className="h-[46px] rounded-[13px] bg-white flex-row items-center justify-center gap-2"
            style={{ shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 24, elevation: 8 }}
          >
            <LogIn size={18} color={COLORS.accent} />
            <Text className="text-accent font-bold text-[14px]">Get started</Text>
          </Pressable>
          {isAuthenticated && biometricEnabled && (
            <Pressable
              onPress={() => {
                if (navigated.current) return;
                navigated.current = true;
                router.replace("/(auth)/biometric-unlock");
              }}
              className="h-[46px] rounded-[13px] flex-row items-center justify-center gap-2"
              style={{ backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" }}
            >
              <Fingerprint size={18} color="#fff" />
              <Text className="text-white font-bold text-[14px]">Biometric login</Text>
            </Pressable>
          )}
        </View>
        <Text className="text-white/40 text-[11px] mt-6">v1.0.0 · Physiobuddies Pvt. Ltd.</Text>
      </View>
    </View>
  );
}
