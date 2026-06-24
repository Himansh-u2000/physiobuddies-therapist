import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
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

function useProtectedRouting() {
  const segments = useSegments() as string[];
  const router = useRouter();
  const navState = useRootNavigationState();
  const { isAuthenticated, isHydrated, biometricEnabled } = useAuthStore();

  useEffect(() => {
    if (!isHydrated || !navState?.key) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAppGroup = segments[0] === "(app)" || segments[0] === "session";

    if (!isAuthenticated && inAppGroup) {
      router.replace("/(auth)/splash");
    } else if (isAuthenticated && inAuthGroup) {
      if (biometricEnabled && segments[1] !== "biometric-unlock") {
        router.replace("/(auth)/biometric-unlock");
      } else if (!biometricEnabled) {
        router.replace("/(app)");
      }
    }
  }, [isAuthenticated, isHydrated, biometricEnabled, segments, navState?.key, router]);
}

function RootLayoutNav() {
  useProtectedRouting();
  useNetwork();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="session" />
      <Stack.Screen name="patient" />
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
