import { useState } from "react";
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Mail, KeyRound } from "lucide-react-native";
import { Button, Input, OTPInput } from "@/components/ui";
import { useAppStore } from "@/lib/stores/app.store";
import { authApi } from "@/lib/api/services";
import { OTP_CONFIG } from "@/constants/config";

/**
 * Password reset via the backend email-OTP flow:
 *   1. POST /auth/forgot-password { email }         → 6-digit OTP emailed
 *   2. POST /auth/reset-password  { email, token, newPassword }
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      showToast("Enter a valid email address", "error");
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword(trimmed);
      showToast("Reset code sent to your email", "success");
      setStep("reset");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't send the code. Try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (otp.length < OTP_CONFIG.authOtpLength) {
      showToast(`Enter the ${OTP_CONFIG.authOtpLength}-digit code`, "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(email.trim(), otp, newPassword);
      showToast("Password updated — sign in with your new password", "success");
      setTimeout(() => router.replace("/(auth)/email-login"), 500);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Reset failed. Check the code and try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View className="h-[160px] relative overflow-hidden">
        <LinearGradient colors={["#003554", "#004060"]} className="absolute inset-0" />
        <View className="absolute bottom-5 left-5">
          <View className="w-10 h-10 rounded-[10px] bg-white items-center justify-center mb-2">
            <Text className="text-accent font-black text-lg">P</Text>
          </View>
          <Text className="text-white text-[18px] font-extrabold">Reset password</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-6 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === "email" ? (
            <View style={{ gap: 16 }}>
              <Text className="text-muted text-[13px]">
                Enter your account email and we&apos;ll send a 6-digit reset code.
              </Text>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
              />
              <Button onPress={handleSendCode} disabled={loading}>
                <Mail size={18} color="#fff" />
                <Text className="text-white font-bold text-[14px]">
                  {loading ? "Sending..." : "Send reset code"}
                </Text>
              </Button>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              <Text className="text-muted text-[13px]">
                Enter the code sent to{" "}
                <Text className="text-fg font-bold">{email.trim()}</Text> and your new password.
              </Text>
              <OTPInput length={OTP_CONFIG.authOtpLength} onComplete={setOtp} />
              <Input
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 6 characters"
                secureTextEntry
                autoCapitalize="none"
              />
              <Button onPress={handleReset} disabled={loading}>
                <KeyRound size={18} color="#fff" />
                <Text className="text-white font-bold text-[14px]">
                  {loading ? "Updating..." : "Update password"}
                </Text>
              </Button>
              <Pressable onPress={() => setStep("email")} className="items-center">
                <Text className="text-accent font-bold text-[12px]">Use a different email</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
