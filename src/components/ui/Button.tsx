import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, type PressableProps, type ViewStyle } from "react-native";
import { GRADIENTS } from "@/constants/config";

type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "ghost";
type ButtonSize = "default" | "small";

interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
  primary: { bg: "bg-accent", text: "text-white", border: "border-transparent" },
  secondary: { bg: "bg-white", text: "text-accent", border: "border-border" },
  success: { bg: "bg-success", text: "text-white", border: "border-transparent" },
  danger: { bg: "bg-white", text: "text-danger", border: "border-danger/30" },
  ghost: { bg: "bg-transparent", text: "text-accent", border: "border-transparent" },
};

const sizeStyles: Record<ButtonSize, { height: string; text: string; radius: string; px: string }> = {
  default: { height: "h-[46px]", text: "text-[14px]", radius: "rounded-[13px]", px: "px-4" },
  small: { height: "h-[34px]", text: "text-[12px]", radius: "rounded-[9px]", px: "px-3" },
};

export function Button({
  variant = "primary",
  size = "default",
  children,
  fullWidth = true,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const useGradient = (variant === "primary" || variant === "success") && !disabled;
  const flatStyle = style as ViewStyle | undefined;

  const content = (
    <>
      {typeof children === "string" ? (
        <Text className={`${s.text} font-bold ${v.text}`}>{children}</Text>
      ) : (
        children
      )}
    </>
  );

  if (useGradient) {
    const colors = variant === "success" ? GRADIENTS.success : GRADIENTS.accent;
    return (
      <Pressable
        disabled={disabled}
        className={`${s.height} ${s.radius} ${fullWidth ? "w-full" : ""} items-center justify-center flex-row gap-2 overflow-hidden ${disabled ? "opacity-50" : ""}`}
        style={flatStyle}
        {...props}
      >
        {/* No shadow here: `overflow-hidden` (needed to clip the gradient to the rounded
            corners) also clips RN's shadow on iOS. Pre-existing gap — the gradient variant
            (primary/success, the default) has never had a shadow; fixing it needs an outer
            shadow wrapper + inner clipped view, verified on a running build, not guessed here. */}
        <LinearGradient
          colors={colors as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          className="absolute inset-0"
        />
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={disabled}
      className={`${s.height} ${s.radius} ${fullWidth ? "w-full" : ""} ${v.bg} ${v.border} border shadow-btn items-center justify-center flex-row gap-2 ${disabled ? "opacity-50" : ""}`}
      style={flatStyle}
      {...props}
    >
      {content}
    </Pressable>
  );
}
