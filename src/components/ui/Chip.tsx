import { Pressable, Text, View, type PressableProps } from "react-native";
import { Check } from "lucide-react-native";
import { COLORS } from "@/constants/config";

/**
 * A tappable pill — filters, multi-select option lists, quick actions.
 *
 * Status *display* moved to `Badge`, which is a squircle tag with an indicator dot. Keeping
 * these two shapes distinct is the point: a rounded pill now reliably means "you can tap this",
 * a square-ish tag means "this is the state of something". They used to be the same component,
 * so nothing on screen distinguished a filter from a label.
 *
 * The non-interactive `variant` forms are retained for the handful of places that want a pill
 * of running text (e.g. `ErrorState`'s badge), but new status UI should use `Badge`.
 */

type ChipVariant = "active" | "pending" | "cancelled" | "info" | "neutral" | "dark";

interface ChipProps extends Omit<PressableProps, "children"> {
  variant?: ChipVariant;
  children: React.ReactNode;
  selected?: boolean;
  selectable?: boolean;
}

const variantStyles: Record<ChipVariant, string> = {
  active: "text-success bg-success/10 border-success/25",
  pending: "text-warning bg-warning/10 border-warning/25",
  cancelled: "text-danger bg-danger/10 border-danger/25",
  info: "text-info bg-info/10 border-info/25",
  neutral: "text-muted bg-muted/10 border-border",
  dark: "text-white bg-accent border-transparent",
};

const base =
  "flex-row items-center justify-center gap-1.5 min-h-[30px] px-3 py-[5px] rounded-full border text-[11.5px] font-bold";

export function Chip({
  variant = "neutral",
  children,
  selected,
  selectable,
  onPress,
  className,
  ...props
}: ChipProps) {
  if (selectable) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!selected }}
        className={`${base} ${
          selected ? "border-accent bg-accent" : "border-border bg-white"
        } active:opacity-80 ${className ?? ""}`}
        {...props}
      >
        {/* A filled checkmark badge rather than a bare "✓" glyph: at 11px the glyph was
            ambiguous against the label, and the selected state now also flips the whole chip
            to the accent fill, so selection is readable without reading. */}
        {selected && (
          <View className="w-[15px] h-[15px] rounded-full items-center justify-center bg-white/25">
            <Check size={10} color="#fff" strokeWidth={3.5} />
          </View>
        )}
        <Text className={`text-[11.5px] font-bold ${selected ? "text-white" : "text-fg"}`}>
          {children}
        </Text>
      </Pressable>
    );
  }

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${base} ${variantStyles[variant]} active:opacity-80 ${className ?? ""}`}
        {...props}
      >
        <Text className="text-[11.5px] font-bold" style={{ color: chipTextColor(variant) }}>
          {children}
        </Text>
      </Pressable>
    );
  }

  return (
    <Text className={`${base} ${variantStyles[variant]} ${className ?? ""}`} {...(props as object)}>
      {children}
    </Text>
  );
}

/** The nested `<Text>` in the pressable form can't inherit the wrapper's Tailwind text colour. */
function chipTextColor(variant: ChipVariant): string {
  switch (variant) {
    case "active":
      return COLORS.success;
    case "pending":
      return COLORS.warning;
    case "cancelled":
      return COLORS.danger;
    case "info":
      return COLORS.info;
    case "dark":
      return "#ffffff";
    default:
      return COLORS.muted;
  }
}
