import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ShieldCheck } from "lucide-react-native";
import { Button, OTPInput } from "@/components/ui";
import { useAppStore } from "@/lib/stores/app.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { authApi } from "@/lib/api/services";
import { OTP_CONFIG } from "@/constants/config";

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const showToast = useAppStore((s) => s.showToast);
  const setSession = useAuthStore((s) => s.setSession);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [resendSec, setResendSec] = useState<number>(OTP_CONFIG.resendCooldownSec);

  useEffect(() => {
    if (resendSec <= 0) return;
    const timer = setInterval(() => setResendSec((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [resendSec]);

  const handleComplete = useCallback((c: string) => setCode(c), []);

  const handleVerify = async () => {
    if (code.length < OTP_CONFIG.authOtpLength) {
      setError(true);
      showToast("Enter all 6 digits to continue.");
      return;
    }
    setError(false);
    setLoading(true);
    try {
      const phoneStr = phone ?? "+91 98765 43210";
      const { tokens, therapist } = await authApi.verifyOtp(phoneStr, code);
      await setSession(tokens, therapist, phoneStr);
      showToast("OTP verified — welcome!");
      setTimeout(() => router.replace("/(auth)/biometric-setup"), 500);
    } catch {
      setError(true);
      showToast("Incorrect OTP. Try again or resend.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setResendSec(OTP_CONFIG.resendCooldownSec);
    showToast(`OTP resent to ${phone ?? "+91 98765 43210"}`);
  };

  return (
    <View className="flex-1 bg-white">
      <View className="h-[180px] relative overflow-hidden">
        <LinearGradient colors={["#003554", "#004060"]} className="absolute inset-0" />
        <View className="absolute bottom-5 left-5">
          <View className="w-10 h-10 rounded-[10px] bg-white items-center justify-center mb-2">
            <Text className="text-accent font-black text-lg">P</Text>
          </View>
          <Text className="text-white text-[18px] font-extrabold">Verify your number</Text>
        </View>
      </View>

      <View className="flex-1 px-5 pt-6 pb-8" style={{ gap: 16 }}>
        <View>
          <Text className="text-[20px] font-bold text-fg">Enter OTP</Text>
          <Text className="text-muted text-[12px] mt-1">
            6-digit code sent to{" "}
            <Text className="text-fg font-bold">{phone ?? "+91 98765 43210"}</Text>
          </Text>
          <Pressable onPress={() => router.replace("/(auth)/login")}>
            <Text className="text-accent font-bold text-[12px] mt-1">Change number</Text>
          </Pressable>
        </View>

        <View>
          <OTPInput length={OTP_CONFIG.authOtpLength} onComplete={handleComplete} />
          {error && (
            <Text className="text-danger text-[12px] font-bold mt-2">
              Incorrect OTP. Try again or resend.
            </Text>
          )}
        </View>

        <Button onPress={handleVerify} disabled={loading}>
          <ShieldCheck size={18} color="#fff" />
          <Text className="text-white font-bold text-[14px]">
            {loading ? "Verifying..." : "Verify OTP"}
          </Text>
        </Button>

        <View className="items-center">
          {resendSec > 0 ? (
            <Text className="text-muted text-[12px]">
              Resend OTP in{" "}
              <Text className="text-accent font-bold">{resendSec}s</Text>
            </Text>
          ) : (
            <Pressable onPress={handleResend}>
              <Text className="text-accent font-bold text-[14px]">Resend OTP</Text>
            </Pressable>
          )}
        </View>

        <Text className="text-muted text-[11px] text-center">
          Having trouble?{" "}
          <Text className="text-accent font-bold">Contact support</Text>
        </Text>
        <Text className="text-muted/60 text-[10px] text-center mt-2">
          Demo OTP: {OTP_CONFIG.demoOtp}
        </Text>
      </View>
    </View>
  );
}
