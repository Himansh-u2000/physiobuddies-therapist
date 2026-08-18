import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../global.css";
import "@/lib/nativewind-interop";
import { DatabaseProvider } from "@/lib/db/provider";
import { QueryProvider } from "@/lib/query/provider";
import { ToastContainer } from "@/components/ui/Toast";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { useAuthStore } from "@/lib/stores/auth.store";
import { setSessionDeadHandler } from "@/lib/api/client";
import { useNetwork } from "@/lib/hooks/useNetwork";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { useAppLock } from "@/lib/hooks/useAppLock";
import { useSyncEngine } from "@/lib/hooks/useSyncEngine";
import { useSessionSync } from "@/lib/hooks/useSessionSync";

function useProtectedRouting() {
  const segments = useSegments() as string[];
  const router = useRouter();
  const navState = useRootNavigationState();
  const { isAuthenticated, isHydrated, biometricEnabled, isLocked } = useAuthStore();

  useEffect(() => {
    if (!isHydrated || !navState?.key) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAppGroup = segments[0] === "(app)" || segments[0] === "session";
    const onUnlockScreen = inAuthGroup && segments[1] === "biometric-unlock";
    const onSetupScreen = inAuthGroup && segments[1] === "biometric-setup";

    if (!isAuthenticated && inAppGroup) {
      // Not signed in but on a protected route → back to splash.
      router.replace("/(auth)/splash");
    } else if (isAuthenticated && biometricEnabled && isLocked && !onUnlockScreen) {
      // Signed in, biometric on, re-locked (cold start or background timeout) → unlock gate.
      router.replace("/(auth)/biometric-unlock");
    } else if (isAuthenticated && !isLocked && inAuthGroup && !onSetupScreen) {
      // Signed in and unlocked but stranded on an auth screen (splash/login/otp/unlock) → app.
      router.replace("/(app)");
    }
  }, [isAuthenticated, isHydrated, biometricEnabled, isLocked, segments, navState?.key, router]);
}

function RootLayoutNav() {
  useProtectedRouting();
  useAppLock();
  useNetwork();
  useSyncEngine();
  useSessionSync();
  const notificationRegistrationStarted = useRef(false);
  const { registerForPushNotifications } = useNotifications();
  const { isAuthenticated, isHydrated } = useAuthStore();

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || notificationRegistrationStarted.current) return;
    notificationRegistrationStarted.current = true;
    registerForPushNotifications().catch(() => {
      notificationRegistrationStarted.current = false;
    });
  }, [isHydrated, isAuthenticated, registerForPushNotifications]);

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="session" />
        <Stack.Screen name="patient" />
        <Stack.Screen name="payouts" />
        <Stack.Screen name="availability" />
        <Stack.Screen name="leave" />
        <Stack.Screen name="reviews" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="network-log" />
        <Stack.Screen name="delete-account" options={{ presentation: "modal" }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // The API client can't import the auth store (auth.store → services → client would cycle),
  // so it publishes "the refresh token was rejected" through a callback instead. Without this
  // the app stays visibly signed in while every request 401s until the next cold start.
  useEffect(() => {
    setSessionDeadHandler(() => {
      void useAuthStore.getState().sessionExpired();
    });
    return () => setSessionDeadHandler(null);
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DatabaseProvider>
          <QueryProvider>
            <StatusBar style="dark" />
            <RootLayoutNav />
            <ToastContainer />
          </QueryProvider>
        </DatabaseProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
