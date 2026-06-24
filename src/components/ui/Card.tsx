import { Pressable, View, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: "default" | "flat" | "tint";
  pressable?: boolean;
  onPress?: () => void;
}

export function Card({ children, variant = "default", pressable, onPress, className, style, ...props }: CardProps) {
  const variantClass =
    variant === "flat" ? "bg-surface-strong" : variant === "tint" ? "bg-tint" : "bg-surface-strong";

  const baseClass = `${variantClass} border border-border rounded-md p-3.5 ${variant === "default" ? "shadow-sm" : ""}`;

  if (pressable && onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${baseClass} active:opacity-90 ${className ?? ""}`}
        style={style}
        {...(props as PressableProps)}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={`${baseClass} ${className ?? ""}`} style={style} {...props}>
      {children}
    </View>
  );
}

interface PressableProps {
  onPress?: () => void;
}
