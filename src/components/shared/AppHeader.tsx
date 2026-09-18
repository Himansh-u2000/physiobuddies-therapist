import { useCallback, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { setStatusBarStyle } from "expo-status-bar";
import { Bell, ChevronLeft } from "lucide-react-native";
import { useAppStore } from "@/lib/stores/app.store";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";
import { COLORS } from "@/constants/config";

/**
 * Light status-bar icons while a screen with a navy header is focused, dark again when it isn't.
 *
 * Focus-driven rather than a `<StatusBar style="light" />` element: expo-status-bar merges mounted
 * `StatusBar` props in mount order, and tab screens stay mounted after their first visit — so an
 * element-based approach would leave whichever tab mounted last in charge of every tab. The root
 * layout's `style="dark"` stays the default for the screens that keep a light header.
 */
export function useLightStatusBar() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, []),
  );
}

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * Stack screens pass this and get a back button where the logo sits. Tab screens omit it and
   * get the "P" brand tile, which takes you home.
   */
  onBack?: () => void;
  /** The bell. Defaults to on for tab screens and off for stack screens. */
  showNotification?: boolean;
  /** Replaces the bell slot — a save button, a status pill. */
  right?: ReactNode;
  /** Rendered inside the header under the title row — tabs, a search box. */
  children?: ReactNode;
}

/**
 * The app's standard header: navy gradient, rounded bottom corners, white type.
 *
 * One component for every ordinary screen so they can't drift apart again — before this there was
 * a `TopBar` for tab screens and roughly fifteen hand-rolled copies of a white back-button bar on
 * the stack screens, each with slightly different padding and sizes.
 *
 * Not used by the visit flow (`VisitHeader`, which carries the step rail) or by screens with their
 * own hero header (session details, patient profile). Controls inside are toned for the dark
 * ground: translucent-white surfaces, white icons.
 */
export function AppHeader({ title, subtitle, onBack, showNotification, right, children }: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // OfflineBanner (rendered above every screen by the root layout) already pads for the status bar
  // while it's showing — adding the inset here too would double that gap.
  const isOnline = useAppStore((s) => s.isOnline);
  const unread = useUnreadNotifications();
  const bell = showNotification ?? !onBack;
  useLightStatusBar();

  return (
    <LinearGradient
      colors={["#003554", "#004060"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="px-5 pb-3 rounded-b-[22px]"
      style={{
        paddingTop: (isOnline ? insets.top : 0) + 14,
        zIndex: 10,
        shadowColor: COLORS.nav,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
        <View className="flex-row items-center flex-1" style={{ gap: 12 }}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="w-10 h-10 rounded-[16px] border items-center justify-center active:opacity-70"
              style={GLASS_TILE}
            >
              <ChevronLeft size={21} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.navigate("/(app)")}
              accessibilityRole="button"
              accessibilityLabel="Home"
              className="w-10 h-10 rounded-[16px] border items-center justify-center active:opacity-70"
              style={GLASS_TILE}
            >
              <Text className="text-white font-extrabold text-[16px]">P</Text>
            </Pressable>
          )}
          <View className="flex-1">
            <Text className="text-[18px] font-extrabold text-white" style={{ letterSpacing: -0.3 }} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-[11px] font-semibold text-white/70 mt-0.5" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {right ??
          (bell ? (
            <Pressable
              onPress={() => router.push("/(app)/notifications")}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
              className="w-10 h-10 rounded-[16px] border items-center justify-center active:opacity-70"
              style={GLASS_TILE}
            >
              <Bell size={19} color="#fff" />
              {unread > 0 && (
                // Navy ring, not white — the badge sits on the gradient.
                <View
                  className="absolute -top-1 -right-1 h-[17px] min-w-[17px] px-[4px] rounded-full bg-danger border-2 items-center justify-center"
                  style={{ borderColor: COLORS.nav }}
                >
                  <Text className="text-white text-[9px] font-bold">{unread > 99 ? "99+" : unread}</Text>
                </View>
              )}
            </Pressable>
          ) : null)}
      </View>
      {children}
    </LinearGradient>
  );
}

const GLASS_TILE = { backgroundColor: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.22)" } as const;

/**
 * A small translucent pill for the header's `right` slot — "Save", "Add", a count. White ink on
 * the gradient, same surface as the back button and bell.
 */
export function HeaderAction({
  label,
  icon,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label?: string;
  icon?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      className={`h-10 ${label ? "px-3.5" : "w-10"} rounded-[16px] border flex-row items-center justify-center active:opacity-70`}
      style={[GLASS_TILE, { gap: 6, opacity: disabled ? 0.5 : 1 }]}
    >
      {icon}
      {label ? <Text className="text-white font-bold text-[13px]">{label}</Text> : null}
    </Pressable>
  );
}
