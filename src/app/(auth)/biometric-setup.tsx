import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Fingerprint,
  ScanFace,
  Lock,
  Zap,
  RefreshCw,
  ChevronLeft,
  ShieldCheck,
  ShieldOff,
  TriangleAlert,
} from "lucide-react-native";
import { Badge, Button, Toggle } from "@/components/ui";
import { useAppStore } from "@/lib/stores/app.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useBiometric } from "@/lib/hooks/useBiometric";
import { AUTH_CONFIG, COLORS } from "@/constants/config";
import { GlassSurface } from "@/components/ui/Glass";

/**
 * Biometric login — both the first-run setup and the ongoing setting.
 *
 * It used to be one screen written purely for onboarding: a full-bleed pitch with an "Enable"
 * button and a "Skip for now" that hard-replaced the route to `/(app)`. Reaching it from
 * Profile after biometrics were already on therefore showed a sales pitch for something already
 * enabled, offered no way to turn it off, and "skip" navigated to the dashboard instead of
 * going back where you came from.
 *
 * `?from=settings` (how Profile links here) switches it to a settings screen: a real header with
 * a back button, current state up top, a toggle, and the device's actual capabilities. The
 * onboarding path is unchanged.
 */
export default function BiometricSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const isSettings = from === "settings";

  const showToast = useAppStore((s) => s.showToast);
  const setBiometric = useAuthStore((s) => s.setBiometric);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const { checkAvailability, authenticate, supportedTypes } = useBiometric();

  const [busy, setBusy] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);
  const [capability, setCapability] = useState<{ compatible: boolean; enrolled: boolean } | null>(null);

  useEffect(() => {
    checkAvailability().then(setCapability).catch(() => setCapability({ compatible: false, enrolled: false }));
  }, [checkAvailability]);

  const hasFacial = supportedTypes.includes("facial");
  const hasFingerprint = supportedTypes.includes("fingerprint");
  const biometricLabel = hasFacial ? "Face ID" : hasFingerprint ? "Fingerprint" : "Biometric";
  const BiometricIcon = hasFacial ? ScanFace : Fingerprint;

  const enable = async () => {
    setBusy(true);
    try {
      const { compatible, enrolled } = await checkAvailability();
      setCapability({ compatible, enrolled });
      if (!compatible) {
        showToast("This device has no biometric hardware.", "error");
        return;
      }
      if (!enrolled) {
        showToast("No fingerprint or face is enrolled. Add one in device settings first.", "error");
        return;
      }
      const result = await authenticate(`Enable ${biometricLabel.toLowerCase()} login for Physiobuddies`);
      if (!result.success) {
        showToast("Biometric authentication cancelled");
        return;
      }
      await setBiometric(true);
      showToast(`${biometricLabel} login enabled`, "success");
      if (!isSettings) {
        setJustEnabled(true);
        setTimeout(() => router.replace("/(app)"), 1600);
      }
    } catch {
      showToast("Biometric authentication failed", "error");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Turning it off re-authenticates first. Otherwise anyone holding an unlocked phone could
   * strip the lock off the app — which is the exact thing the lock exists to prevent.
   */
  const disable = async () => {
    setBusy(true);
    try {
      const result = await authenticate("Confirm it's you to turn off biometric login");
      if (!result.success) {
        showToast("Left biometric login on");
        return;
      }
      await setBiometric(false);
      showToast("Biometric login turned off");
    } catch {
      showToast("Couldn't turn off biometric login", "error");
    } finally {
      setBusy(false);
    }
  };

  // ---- Onboarding success interstitial (first-run path only) ----
  if (justEnabled) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-success/15 items-center justify-center mb-4">
          <ShieldCheck size={38} color={COLORS.success} />
        </View>
        <Text className="text-[20px] font-extrabold text-fg mb-2">{biometricLabel} enabled</Text>
        <Text className="text-muted text-[13px] text-center max-w-[280px]">
          You can now unlock Physiobuddies with a single touch. Heading to your dashboard…
        </Text>
      </View>
    );
  }

  // ---- Settings mode (opened from Profile) ----
  if (isSettings) {
    const unavailable = capability != null && !capability.compatible;
    const notEnrolled = capability?.compatible && !capability.enrolled;

    return (
      <View className="flex-1 bg-bg">
        <GlassSurface
          fallbackClassName="bg-white"
          className="px-4 pb-3 flex-row items-center border-b border-border"
          style={{ paddingTop: insets.top + 10, gap: 8 }}
        >
          <Pressable onPress={() => router.back()} hitSlop={8} className="w-8 h-8 items-center justify-center">
            <ChevronLeft size={22} color={COLORS.fg} />
          </Pressable>
          <Text className="text-[16px] font-extrabold text-fg flex-1">Biometric login</Text>
        </GlassSurface>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-3.5 pt-3"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 12 }}
        >
          {/* Current state + the switch, together — the one thing this screen exists to do. */}
          <GlassSurface
            fallbackClassName="bg-white"
            glassRadius={12}
            className="border border-border rounded-md p-4"
            style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
          >
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View
                className="w-12 h-12 rounded-[14px] items-center justify-center"
                style={{
                  backgroundColor: biometricEnabled ? "rgba(35,145,73,0.12)" : "rgba(94,107,119,0.1)",
                }}
              >
                <BiometricIcon size={26} color={biometricEnabled ? COLORS.success : COLORS.muted} />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-extrabold text-fg">{biometricLabel} login</Text>
                <Text className="text-muted text-[12px] mt-0.5">
                  {biometricEnabled
                    ? "On — you'll be asked to verify when you open the app"
                    : "Off — you'll sign in with your password"}
                </Text>
              </View>
              {busy ? (
                <ActivityIndicator color={COLORS.accent} />
              ) : (
                <Toggle
                  value={biometricEnabled}
                  onValueChange={(next) => (next ? enable() : disable())}
                />
              )}
            </View>

            {biometricEnabled && (
              <View className="flex-row items-center mt-3 pt-3 border-t border-border" style={{ gap: 8 }}>
                <Badge variant="success" size="sm">
                  Active
                </Badge>
                <Text className="text-muted text-[11.5px] flex-1">
                  Re-locks after {Math.round(AUTH_CONFIG.biometricRelockMs / 60000)} min in the background
                </Text>
              </View>
            )}
          </GlassSurface>

          {unavailable && (
            <View className="flex-row bg-danger/5 border border-danger/20 rounded-md p-3" style={{ gap: 8 }}>
              <ShieldOff size={16} color={COLORS.danger} style={{ marginTop: 1 }} />
              <Text className="flex-1 text-[12px] text-fg/80">
                This device has no biometric hardware, so this option can&apos;t be turned on here.
              </Text>
            </View>
          )}

          {notEnrolled && (
            <View className="flex-row bg-warning/5 border border-warning/25 rounded-md p-3" style={{ gap: 8 }}>
              <TriangleAlert size={16} color={COLORS.warning} style={{ marginTop: 1 }} />
              <Text className="flex-1 text-[12px] text-fg/80">
                No fingerprint or face is enrolled on this device yet. Add one in your device&apos;s
                security settings, then come back.
              </Text>
            </View>
          )}

          <GlassSurface
            fallbackClassName="bg-white"
            glassRadius={12}
            className="border border-border rounded-md p-3.5" style={{ gap: 14 }}>
            <Text className="text-[13px] font-bold text-fg">How it works</Text>
            <FactRow
              icon={Lock}
              title="Stored on device only"
              body="Physiobuddies never receives your fingerprint or face data — the check happens in your phone's secure hardware."
            />
            <FactRow
              icon={Zap}
              title="One-tap daily unlock"
              body="Open the app and verify, instead of typing your password each time."
            />
            <FactRow
              icon={RefreshCw}
              title="Password always works"
              body="If biometrics fail or you switch phones, signing in with your password still works."
            />
          </GlassSurface>

          {biometricEnabled && (
            <Button variant="secondary" fullWidth onPress={enable} disabled={busy}>
              <RefreshCw size={16} color={COLORS.accent} />
              <Text className="text-accent font-bold text-[14px]">Re-verify this device</Text>
            </Button>
          )}
        </ScrollView>
      </View>
    );
  }

  // ---- Onboarding mode (first run, reached from the auth flow) ----
  return (
    <View className="flex-1 bg-bg items-center justify-center px-6 py-8">
      <View className="w-full max-w-[340px]" style={{ gap: 22 }}>
        <View className="items-center">
          <View
            className={`w-32 h-32 rounded-full bg-white border-[3px] items-center justify-center ${busy ? "border-accent" : "border-border"}`}
            style={{ shadowColor: COLORS.nav, shadowOpacity: 0.12, shadowRadius: 28, elevation: 6 }}
          >
            <BiometricIcon size={68} color={COLORS.accent} />
          </View>
        </View>

        <View className="items-center">
          <Text className="text-[22px] font-extrabold text-fg">Enable {biometricLabel} login</Text>
          <Text className="text-muted text-[13px] mt-2 text-center leading-6">
            Add a quick and secure way to log in each day. Your biometric data stays on your device
            — never leaves it.
          </Text>
        </View>

        <View className="bg-primary-soft rounded-md p-3.5" style={{ gap: 12 }}>
          <FactRow icon={Lock} title="Stored on device only" body="Physiobuddies never receives your fingerprint" compact />
          <FactRow icon={Zap} title="1-tap daily login" body="Skip typing your password on trusted devices" compact />
          <FactRow icon={RefreshCw} title="Password fallback anytime" body="Always available if biometrics fail" compact />
        </View>

        <View style={{ gap: 10 }}>
          <Button onPress={enable} disabled={busy}>
            <BiometricIcon size={18} color="#fff" />
            <Text className="text-white font-bold text-[14px]">
              {busy ? "Verifying..." : `Enable ${biometricLabel}`}
            </Text>
          </Button>
          <Button variant="secondary" onPress={() => router.replace("/(app)")}>
            Skip for now
          </Button>
          <Text className="text-muted text-[11px] text-center">
            You can turn this on later from Profile → Biometric login
          </Text>
        </View>
      </View>
    </View>
  );
}

function FactRow({
  icon: Icon,
  title,
  body,
  compact,
}: {
  icon: typeof Lock;
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <View className="flex-row" style={{ gap: 10 }}>
      <Icon size={18} color={COLORS.accent} style={{ marginTop: 1 }} />
      <View className="flex-1">
        <Text className="text-[13px] font-bold text-fg">{title}</Text>
        <Text className={`text-muted ${compact ? "text-[11px]" : "text-[11.5px] leading-4 mt-0.5"}`}>{body}</Text>
      </View>
    </View>
  );
}
