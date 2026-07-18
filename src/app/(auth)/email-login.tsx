import { useState } from "react";
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { LogIn, Eye, EyeOff } from "lucide-react-native";
import { Button, Input } from "@/components/ui";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { useAppStore } from "@/lib/stores/app.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { authApi } from "@/lib/api/services";
import { COLORS } from "@/constants/config";

export default function EmailLoginScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorField, setErrorField] = useState<"email" | "password" | null>(null);

  const handleSignIn = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setErrorField("email");
      showToast("Enter a valid email address", "error");
      return;
    }
    if (password.length < 6) {
      setErrorField("password");
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    setErrorField(null);
    setLoading(true);
    try {
      const { tokens, therapist } = await authApi.loginWithPassword(trimmed, password);
      await setSession(tokens, therapist);
      showToast("Signed in — welcome!", "success");
      setTimeout(() => router.replace("/(auth)/biometric-setup"), 400);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sign in failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View className="h-[180px] relative overflow-hidden">
        <LinearGradient colors={["#003554", "#004060"]} className="absolute inset-0" />
        <View className="absolute bottom-5 left-5">
          <View className="w-10 h-10 rounded-[10px] bg-white items-center justify-center mb-2">
            <Text className="text-accent font-black text-lg">P</Text>
          </View>
          <Text className="text-white text-[18px] font-extrabold">Sign in with email</Text>
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
          <View style={{ gap: 16 }}>
            <View>
              <Text className="text-[20px] font-bold text-fg">Welcome back</Text>
              <Text className="text-muted text-[12px] mt-1">
                Use the email and password for your therapist account
              </Text>
            </View>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              invalid={errorField === "email"}
              error="Enter a valid email address"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              textContentType="emailAddress"
            />

            <View>
              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                invalid={errorField === "password"}
                error="Password must be at least 6 characters"
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[34px] h-[30px] w-[30px] items-center justify-center"
                hitSlop={8}
              >
                {showPassword ? (
                  <EyeOff size={18} color={COLORS.muted} />
                ) : (
                  <Eye size={18} color={COLORS.muted} />
                )}
              </Pressable>
            </View>

            <Pressable onPress={() => router.push("/(auth)/reset-password")} className="self-end">
              <Text className="text-accent font-bold text-[12px]">Forgot password?</Text>
            </Pressable>

            <Button onPress={handleSignIn} disabled={loading}>
              <LogIn size={18} color="#fff" />
              <Text className="text-white font-bold text-[14px]">
                {loading ? "Signing in..." : "Sign in"}
              </Text>
            </Button>

            <View className="flex-row items-center gap-3 my-1">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-muted text-[11px]">or continue with</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            <SocialAuthButtons />

            <Pressable onPress={() => router.replace("/(auth)/login")} className="items-center mt-1">
              <Text className="text-muted text-[12px]">
                Prefer OTP? <Text className="text-accent font-bold">Use phone number</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
