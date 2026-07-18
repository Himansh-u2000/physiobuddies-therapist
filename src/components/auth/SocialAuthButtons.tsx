import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { authApi } from "@/lib/api/services";
import { signInWithGoogle, GoogleSignInError } from "@/lib/auth/googleSignIn";
import { signInWithApple, isAppleAuthAvailable, AppleSignInError } from "@/lib/auth/appleSignIn";
import { USE_MOCK_AUTH, COLORS } from "@/constants/config";
import type { AuthTokens, Therapist } from "@/types";

/**
 * Secondary social sign-in (Google + Apple-on-iOS). Phone/email remain the primary methods.
 * In mock mode the native SDKs are bypassed so the flow is testable in Expo Go.
 */
export function SocialAuthButtons() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const showToast = useAppStore((s) => s.showToast);
  const [busy, setBusy] = useState<null | "google" | "apple">(null);

  const finish = async (tokens: AuthTokens, therapist: Therapist) => {
    await setSession(tokens, therapist);
    showToast("Signed in — welcome!", "success");
    setTimeout(() => router.replace("/(auth)/biometric-setup"), 400);
  };

  const onGoogle = async () => {
    if (busy) return;
    setBusy("google");
    try {
      const code = USE_MOCK_AUTH
        ? "mock-google-auth-code"
        : (await signInWithGoogle()).serverAuthCode;
      const { tokens, therapist } = await authApi.loginWithGoogle(code);
      await finish(tokens, therapist);
    } catch (e) {
      if (!(e instanceof GoogleSignInError && e.code === "cancelled")) {
        showToast(e instanceof Error ? e.message : "Google sign-in failed", "error");
      }
    } finally {
      setBusy(null);
    }
  };

  const onApple = async () => {
    if (busy) return;
    setBusy("apple");
    try {
      const cred = USE_MOCK_AUTH
        ? { identityToken: "mock-apple-identity-token", fullName: null as string | null }
        : await signInWithApple();
      const { tokens, therapist } = await authApi.loginWithApple(cred.identityToken, cred.fullName);
      await finish(tokens, therapist);
    } catch (e) {
      if (!(e instanceof AppleSignInError && e.code === "cancelled")) {
        showToast(e instanceof Error ? e.message : "Apple sign-in failed", "error");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <Pressable
        onPress={onGoogle}
        disabled={!!busy}
        className={`h-[46px] flex-row items-center justify-center gap-2.5 rounded-[13px] border-[1.5px] border-border bg-white active:opacity-80 ${busy ? "opacity-60" : ""}`}
      >
        {busy === "google" ? (
          <ActivityIndicator size="small" color={COLORS.accent} />
        ) : (
          <View className="w-5 h-5 rounded-full items-center justify-center bg-white border border-border">
            <Text className="text-[13px] font-black" style={{ color: "#4285F4" }}>
              G
            </Text>
          </View>
        )}
        <Text className="text-fg font-bold text-[14px]">Continue with Google</Text>
      </Pressable>

      {isAppleAuthAvailable && (
        <Pressable
          onPress={onApple}
          disabled={!!busy}
          className={`h-[46px] flex-row items-center justify-center gap-2 rounded-[13px] bg-black active:opacity-80 ${busy ? "opacity-60" : ""}`}
        >
          {busy === "apple" ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            // U+F8FF renders as the Apple logo on iOS (the only platform this button shows).
            <Text className="text-white text-[16px]"></Text>
          )}
          <Text className="text-white font-bold text-[14px]">Continue with Apple</Text>
        </Pressable>
      )}
    </View>
  );
}
