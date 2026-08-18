import { useState } from "react";
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { LogIn, Eye, EyeOff } from "lucide-react-native";
import { BrandMark, Button, Input } from "@/components/ui";
import { useAppStore } from "@/lib/stores/app.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { authApi } from "@/lib/api/services";
import { COLORS } from "@/constants/config";

/**
 * Sign in — **email and password only**.
 *
 * This screen used to lead with a phone number and a "Send OTP" button. That flow was
 * mock-only and had no backend behind it: `authApi.login`/`verifyOtp` accepted any 6-digit
 * code and minted a literal `mock-access-token`, which the live API then rejected on every
 * subsequent request. So the most prominent control on the app's first screen produced a
 * session that looked signed in and could not load a single thing. Both it and the separate
 * `email-login` screen are gone; this is the one login path, and it is real.
 *
 * Social sign-in is gone too (2026-08-17). Google was removed on request; Apple went with it
 * rather than being left alone under an "or continue with" divider, since it is iOS-only, has
 * never been compiled, and `POST /auth/apple` still does not exist server-side. `lib/auth/
 * appleSignIn.ts` and `authApi.loginWithApple` are kept — inert — for whenever that endpoint
 * lands. Worth noting for Phase 8: App Store Guideline 4.8 only compels Sign in with Apple when
 * the app offers a *third-party* social login, so dropping Google also drops that obligation.
 */
export default function LoginScreen() {
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
      showToast("Signed in — welcome back", "success");
      setTimeout(() => router.replace("/(auth)/biometric-setup"), 400);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sign in failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View className="h-[200px] relative overflow-hidden">
        <LinearGradient colors={["#003554", "#004060"]} className="absolute inset-0" />
        <View className="absolute bottom-5 left-5">
          <View className="mb-2.5">
            <BrandMark size={46} radius={13} />
          </View>
          <Text className="text-white text-[20px] font-extrabold">Physiobuddies Therapist</Text>
          <Text className="text-white/70 text-[12px] mt-0.5">Therapist Partner App</Text>
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
                Sign in with the email and password for your therapist account
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
              returnKeyType="next"
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
                returnKeyType="go"
                onSubmitEditing={handleSignIn}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[34px] h-[30px] w-[30px] items-center justify-center"
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
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

            <View className="items-center mt-1">
              <Text className="text-muted text-[12px]">
                Are you a patient?{" "}
                <Text className="text-accent font-bold">Switch to patient app</Text>
              </Text>
              <Text className="text-muted text-[11px] mt-2.5 text-center leading-5">
                By continuing, you agree to Physiobuddies{" "}
                <Text className="text-accent">Terms of Service</Text> and{" "}
                <Text className="text-accent">Privacy Policy</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
