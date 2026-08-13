import { View, Text, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { COLORS } from "@/constants/config";
import type { AppointmentStatus, PaymentStatus } from "@/types";

/**
 * Status badges.
 *
 * Replaces the old fully-round `Chip` pill for *status* display. Three deliberate changes:
 *
 *  1. **Squircle, not pill.** A 7px-radius tag reads as a label attached to the thing it
 *     describes; a full pill reads as a tappable filter. The app has both jobs and they were
 *     previously indistinguishable — `Chip` is now only for the selectable/filter case.
 *  2. **A leading indicator dot.** Colour alone carried the entire meaning before, which fails
 *     for the ~8% of men with colour-vision deficiency and washes out in sunlight — the
 *     conditions a home-visit therapist actually works in. The dot adds a second, non-colour
 *     channel (present/absent, filled/hollow) and gives the eye an anchor at small sizes.
 *  3. **Uppercase micro-type with wide tracking.** 10px at weight 800 with +0.6 tracking stays
 *     legible where 11px mixed-case bold started to smear.
 *
 * Colours are computed from `COLORS` rather than written as Tailwind opacity classes so the
 * tint, border and text of a variant can never drift apart.
 */

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "accent";
export type BadgeTone = "soft" | "solid" | "outline";
export type BadgeSize = "sm" | "md";

/** Hex → `rgba()` at the given alpha. Keeps one hue definition per variant. */
function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const HUE: Record<BadgeVariant, string> = {
  success: COLORS.success,
  warning: COLORS.warning,
  danger: COLORS.danger,
  info: COLORS.info,
  accent: COLORS.accent,
  neutral: COLORS.muted,
};

const SIZE = {
  sm: { height: 20, padH: 6, gap: 4, font: 9.5, dot: 5, radius: 6 },
  md: { height: 24, padH: 8, gap: 5, font: 10.5, dot: 6, radius: 7 },
} as const;

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Leading dot. On by default; turn off when an `icon` is carrying the same job. */
  dot?: boolean;
  icon?: LucideIcon;
  style?: ViewStyle;
}

export function Badge({
  children,
  variant = "neutral",
  tone = "soft",
  size = "md",
  dot = true,
  icon: Icon,
  style,
}: BadgeProps) {
  const hue = HUE[variant];
  const s = SIZE[size];
  const solid = tone === "solid";

  const background = solid ? hue : tone === "outline" ? "transparent" : alpha(hue, 0.1);
  const borderColor = solid ? hue : alpha(hue, tone === "outline" ? 0.45 : 0.22);
  const foreground = solid ? "#ffffff" : hue;

  return (
    <View
      className="flex-row items-center self-start border"
      style={[
        {
          minHeight: s.height,
          paddingHorizontal: s.padH,
          gap: s.gap,
          borderRadius: s.radius,
          backgroundColor: background,
          borderColor,
        },
        style,
      ]}
    >
      {Icon ? (
        <Icon size={s.font + 2} color={foreground} />
      ) : dot ? (
        <View
          style={{
            width: s.dot,
            height: s.dot,
            borderRadius: s.dot / 2,
            // On a solid badge the dot must read against the filled hue, so it inverts.
            backgroundColor: solid ? "rgba(255,255,255,0.85)" : hue,
          }}
        />
      ) : null}
      <Text
        style={{
          fontSize: s.font,
          fontWeight: "800",
          letterSpacing: 0.6,
          color: foreground,
          textTransform: "uppercase",
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * The single source of truth for how an appointment status is worded and coloured.
 *
 * Every screen used to inline its own `status === "completed" ? … : …` ternary, so the same
 * state could read "Upcoming" on one screen and "Confirmed" on the next. Mapping it once here
 * means adding a status to the backend enum surfaces consistently everywhere.
 */
const STATUS_META: Record<AppointmentStatus, { label: string; variant: BadgeVariant }> = {
  confirmed: { label: "Confirmed", variant: "info" },
  in_progress: { label: "In session", variant: "accent" },
  completed: { label: "Completed", variant: "success" },
  pending: { label: "Awaiting payment", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "danger" },
  no_show: { label: "No show", variant: "danger" },
  expired: { label: "Expired", variant: "neutral" },
};

export function StatusBadge({
  status,
  size = "md",
  tone,
}: {
  status: AppointmentStatus;
  size?: BadgeSize;
  tone?: BadgeTone;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    // A live session is the one state worth shouting about — it's the only one that means
    // "you are mid-visit right now", so it gets the filled treatment unless overridden.
    <Badge variant={meta.variant} tone={tone ?? (status === "in_progress" ? "solid" : "soft")} size={size}>
      {meta.label}
    </Badge>
  );
}

const PAYMENT_META: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  paid: { label: "Paid", variant: "success" },
  pending: { label: "Unpaid", variant: "warning" },
  failed: { label: "Failed", variant: "danger" },
};

export function PaymentBadge({ status, size = "md" }: { status: PaymentStatus; size?: BadgeSize }) {
  const meta = PAYMENT_META[status] ?? PAYMENT_META.pending;
  return (
    <Badge variant={meta.variant} size={size}>
      {meta.label}
    </Badge>
  );
}
