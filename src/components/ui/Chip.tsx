import { Pressable, Text, type PressableProps } from "react-native";

type ChipVariant = "active" | "pending" | "cancelled" | "info" | "neutral" | "dark";

interface ChipProps extends Omit<PressableProps, "children"> {
  variant?: ChipVariant;
  children: React.ReactNode;
  selected?: boolean;
  selectable?: boolean;
}

const variantStyles: Record<ChipVariant, string> = {
  active: "text-success bg-success/10 border-success/20",
  pending: "text-warning bg-warning/10 border-warning/20",
  cancelled: "text-danger bg-danger/10 border-danger/20",
  info: "text-info bg-info/10 border-info/20",
  neutral: "text-muted bg-muted/10 border-border",
  dark: "text-white bg-accent border-transparent",
};

export function Chip({ variant = "neutral", children, selected, selectable, onPress, className, ...props }: ChipProps) {
  const baseClass = `flex-row items-center gap-1 min-h-[22px] px-2 py-[3px] rounded-full border text-[11px] font-bold ${variantStyles[variant]}`;

  if (selectable) {
    const selectedClass = selected
      ? "border-accent bg-accent/5 text-accent"
      : "border-border bg-white text-fg";
    return (
      <Pressable
        onPress={onPress}
        className={`${baseClass} ${selectedClass} ${className ?? ""}`}
        {...props}
      >
        {selected && <Text className="text-[10px] text-accent">✓ </Text>}
        <Text className="text-[11px] font-bold">{children}</Text>
      </Pressable>
    );
  }

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={`${baseClass} ${className ?? ""}`} {...props}>
        <Text className="text-[11px] font-bold">{children}</Text>
      </Pressable>
    );
  }

  return (
    <Text className={`${baseClass} ${className ?? ""}`} {...(props as object)}>
      {children}
    </Text>
  );
}
