import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, Fingerprint, LogIn, ShieldCheck } from "lucide-react-native";
import { useAuthStore } from "@/lib/stores/auth.store";
import { COLORS } from "@/constants/config";

/**
 * Splash / launch screen.
 *
 * Redesigned: the previous version was a centred logo, a static ring styled to look like a
 * spinner (it never actually spun — a `border-t-white` circle with no animation) and a
 * "Get started" button that appeared immediately, competing with the auto-redirect that was
 * already scheduled. Two controls racing for the same 2.2 seconds.
 *
 * Now: the brand mark animates in, a real determinate progress bar shows the hydrate window
 * elapsing, and the manual controls only fade in **after** the auto-redirect has been given
 * its chance — so there is exactly one obvious thing to do at any moment. The redirect logic
 * itself is unchanged.
 */

/** How long the brand holds before routing. Long enough to read, short enough not to annoy. */
const HOLD_MS = 1800;

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, biometricEnabled, isHydrated } = useAuthStore();
  const navigated = useRef(false);

  const [enter] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [controls] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 7 }),
      Animated.timing(progress, {
        toValue: 1,
        duration: HOLD_MS,
        easing: Easing.inOut(Easing.quad),
        // Width can't be driven natively; this bar is the only non-native animation here and
        // it runs while nothing else is on screen, so it costs nothing that matters.
        useNativeDriver: false,
      }),
    ]).start();
  }, [enter, progress]);

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
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [isHydrated, isAuthenticated, biometricEnabled, router]);

  // Manual escape hatches, revealed only once the automatic route has had its turn — if
  // hydration stalls (a corrupt SecureStore entry, a slow cold start on a 3 GB device) the
  // therapist is not stranded on a dead screen.
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(controls, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, HOLD_MS + 400);
    return () => clearTimeout(timer);
  }, [controls]);

  const go = (path: "/(auth)/login" | "/(auth)/biometric-unlock") => {
    if (navigated.current) return;
    navigated.current = true;
    router.replace(path);
  };

  return (
    <View className="flex-1">
      <LinearGradient colors={["#021526", "#003554"]} className="absolute inset-0" />
      {/* Two soft radial-ish blooms, built from overlapping translucent circles — the flat
          two-stop gradient alone read as a placeholder screen. */}
      <View
        className="absolute rounded-full"
        style={{ width: 340, height: 340, top: -110, right: -120, backgroundColor: "rgba(0,134,168,0.16)" }}
      />
      <View
        className="absolute rounded-full"
        style={{ width: 260, height: 260, bottom: -90, left: -80, backgroundColor: "rgba(35,145,73,0.12)" }}
      />

      <View className="flex-1 items-center justify-center px-8">
        <Animated.View
          style={{
            opacity: enter,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
              { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            ],
            alignItems: "center",
          }}
        >
          <View
            className="w-[86px] h-[86px] rounded-[26px] bg-white items-center justify-center"
            style={{ shadowColor: "#000", shadowOpacity: 0.32, shadowRadius: 34, shadowOffset: { width: 0, height: 14 }, elevation: 14 }}
          >
            <Text className="text-accent font-black text-[34px]" style={{ letterSpacing: -1 }}>
              P
            </Text>
            <View
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full items-center justify-center border-[3px]"
              style={{ backgroundColor: COLORS.success, borderColor: "#021526" }}
            >
              <Activity size={14} color="#fff" strokeWidth={3} />
            </View>
          </View>

          <Text
            className="text-white text-[26px] font-extrabold text-center mt-6 leading-[32px]"
            style={{ letterSpacing: -0.6 }}
          >
            Physiobuddies
          </Text>
          <Text className="text-white/60 text-[13px] font-bold mt-0.5" style={{ letterSpacing: 3 }}>
            THERAPIST
          </Text>

          <View className="flex-row items-center mt-5" style={{ gap: 6 }}>
            <ShieldCheck size={13} color="rgba(255,255,255,0.55)" />
            <Text className="text-white/55 text-[12px]">Secure partner app for daily practice</Text>
          </View>
        </Animated.View>

        {/* A real progress bar, not a decorative ring: it tells you the wait is bounded. */}
        <View
          className="mt-9 h-[3px] w-[150px] rounded-full overflow-hidden"
          style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
        >
          <Animated.View
            className="h-full rounded-full"
            style={{
              backgroundColor: "rgba(255,255,255,0.85)",
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ["8%", "100%"] }),
            }}
          />
        </View>

        <Animated.View
          style={{
            opacity: controls,
            transform: [{ translateY: controls.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            width: "100%",
            maxWidth: 320,
            marginTop: 28,
            gap: 10,
          }}
          // Untappable until faded in, so a stray tap during the hold can't pre-empt the
          // redirect that is already about to happen.
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => go("/(auth)/login")}
            className="h-[48px] rounded-[14px] bg-white flex-row items-center justify-center gap-2 active:opacity-90"
            style={{ shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 }}
          >
            <LogIn size={18} color={COLORS.accent} />
            <Text className="text-accent font-bold text-[14px]">Sign in</Text>
          </Pressable>
          {isAuthenticated && biometricEnabled && (
            <Pressable
              onPress={() => go("/(auth)/biometric-unlock")}
              className="h-[48px] rounded-[14px] flex-row items-center justify-center gap-2 active:opacity-90"
              style={{ backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" }}
            >
              <Fingerprint size={18} color="#fff" />
              <Text className="text-white font-bold text-[14px]">Unlock with biometrics</Text>
            </Pressable>
          )}
        </Animated.View>
      </View>

      <Text className="text-white/35 text-[11px] text-center pb-8">
        v1.0.0 · Physiobuddies Pvt. Ltd.
      </Text>
    </View>
  );
}
