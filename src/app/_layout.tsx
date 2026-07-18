import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../global.css";
import "@/lib/nativewind-interop";
import { DatabaseProvider } from "@/lib/db/provider";
import { QueryProvider } from "@/lib/query/provider";
import { ToastContainer } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useNetwork } from "@/lib/hooks/useNetwork";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { useAppLock } from "@/lib/hooks/useAppLock";

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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="session" />
      <Stack.Screen name="patient" />
      <Stack.Screen name="delete-account" options={{ presentation: "modal" }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
