import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast, { type ToastConfig, type ToastConfigParams } from "react-native-toast-message";
import { CheckCircle2, XCircle, Info, X } from "lucide-react-native";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";

/**
 * Toasts, on `react-native-toast-message`.
 *
 * The app used to hand-roll this: a queue in `app.store`, an `Animated` row per toast, and a
 * container that mounted them. That worked, but it re-rendered every subscriber of the app
 * store on each show/hide and had to re-implement enter/exit timing, stacking and swipe
 * dismissal itself. The library owns all of that now; what stays ours is the *look* — the
 * `TOAST_CONFIG` below is a full custom renderer, not the library's default `BaseToast`.
 *
 * Three tones, each carrying its meaning in colour, icon and a left rail (so the tone survives
 * greyscale and sunlight, same reasoning as `Badge`):
 *
 *   success → green   error → red   info → blue
 *
 * Call it through `useAppStore().showToast(message, type)` as before — that signature is
 * unchanged across ~130 call sites and now just forwards to `Toast.show`.
 */

type Tone = "success" | "error" | "info";

const TONE: Record<Tone, { icon: typeof CheckCircle2; hue: string; tint: string; rail: string }> = {
  success: { icon: CheckCircle2, hue: COLORS.success, tint: "rgba(35,145,73,0.10)", rail: COLORS.success },
  error: { icon: XCircle, hue: COLORS.danger, tint: "rgba(207,66,56,0.10)", rail: COLORS.danger },
  info: { icon: Info, hue: COLORS.info, tint: "rgba(0,134,168,0.10)", rail: COLORS.info },
};

function ToastCard({ tone, text1 }: { tone: Tone; text1?: string }) {
  const t = TONE[tone];
  const Icon = t.icon;

  return (
    // The whole card dismisses on tap — one Pressable rather than a nested icon button, so a
    // tap anywhere works instead of two touch targets racing. The X is an affordance, not a
    // second hit area.
    <Pressable
      onPress={() => Toast.hide()}
      accessibilityRole="alert"
      accessibilityLabel={text1}
      className="flex-row items-center rounded-[16px] border overflow-hidden active:opacity-90"
      style={{
        width: "92%",
        backgroundColor: "#fff",
        borderColor: t.rail,
        borderWidth: 1,
        shadowColor: COLORS.nav,
        shadowOpacity: 0.16,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }}
    >
      {/* Colour rail: the tone is readable before a single word is */}
      <View style={{ width: 5, alignSelf: "stretch", backgroundColor: t.rail }} />
      <View className="flex-row items-center flex-1 pl-2.5 pr-2.5 py-3" style={{ gap: 10 }}>
        <View
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: t.tint }}
        >
          <Icon size={17} color={t.hue} />
        </View>
        <Text
          className="flex-1 text-[13.5px] font-bold text-fg"
          style={{ letterSpacing: -0.1 }}
          numberOfLines={3}
        >
          {text1}
        </Text>
        <View
          className="w-6 h-6 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(2,21,38,0.05)" }}
        >
          <X size={12} color={COLORS.muted} />
        </View>
      </View>
    </Pressable>
  );
}

/** Custom renderers keyed by the `type` passed to `Toast.show`. */
export const TOAST_CONFIG: ToastConfig = {
  success: ({ text1 }: ToastConfigParams<unknown>) => <ToastCard tone="success" text1={text1} />,
  error: ({ text1 }: ToastConfigParams<unknown>) => <ToastCard tone="error" text1={text1} />,
  info: ({ text1 }: ToastConfigParams<unknown>) => <ToastCard tone="info" text1={text1} />,
};

/** Extra clearance so a toast never lands under the connectivity banner. */
const OFFLINE_BANNER_CLEARANCE = 34;

/**
 * Mounted once, last in the root layout so it paints above every screen.
 *
 * `topOffset` is computed here rather than passed per `Toast.show` call: the store has no
 * access to safe-area insets or the offline banner's visibility, and callers shouldn't have to
 * think about either.
 */
export function ToastContainer() {
  const insets = useSafeAreaInsets();
  const isOnline = useAppStore((s) => s.isOnline);

  return (
    <Toast
      config={TOAST_CONFIG}
      position="top"
      topOffset={insets.top + 10 + (isOnline ? 0 : OFFLINE_BANNER_CLEARANCE)}
    />
  );
}
