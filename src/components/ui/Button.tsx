import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Pressable, Text, type PressableProps, type ViewStyle } from "react-native";
import { GRADIENTS } from "@/constants/config";

type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "ghost";
type ButtonSize = "default" | "small";

interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
  primary: { bg: "bg-accent", text: "text-white", border: "border-transparent" },
  secondary: { bg: "bg-white", text: "text-accent", border: "border-border" },
  success: { bg: "bg-success", text: "text-white", border: "border-transparent" },
  danger: { bg: "bg-white", text: "text-danger", border: "border-danger/30" },
  ghost: { bg: "bg-transparent", text: "text-accent", border: "border-transparent" },
};

// `px` is load-bearing for the hug-content case. A full-width button doesn't need it (the
// label is centred in a stretched box), but `fullWidth={false}` — ErrorState's "Try again",
// the permission-denied actions — sizes the box to its label, and without horizontal padding
// the text ran edge to edge. The class existed here from the start but was never actually
// concatenated into either branch's className, so no non-full-width button has ever had it.
const sizeStyles: Record<ButtonSize, { height: string; text: string; radius: string; px: string }> = {
  default: { height: "h-[46px]", text: "text-[14px]", radius: "rounded-[13px]", px: "px-5" },
  small: { height: "h-[34px]", text: "text-[12px]", radius: "rounded-[9px]", px: "px-3.5" },
};

const GRADIENT_VARIANTS: ButtonVariant[] = ["primary", "success"];

export function Button({
  variant = "primary",
  size = "default",
  children,
  fullWidth = true,
  disabled,
  style,
  // MUST be destructured, not left to `...props`.
  //
  // The spread lands *after* the `className` this component sets, so a caller passing
  // `className="mt-2"` for a bit of margin was silently REPLACING the button's entire
  // appearance — height, radius, background, and the `items-center justify-center flex-row`
  // that positions the icon and label. On the gradient variants the damage is worst: the
  // LinearGradient is `absolute inset-0`, so with the height class gone it fills a zero-height
  // box and the button renders as bare text on transparent. Two call sites hit this
  // (`session/otp.tsx`'s "Send OTP" and "Verify & start session"). Appending instead of
  // replacing keeps a caller's utility class additive, which is what every caller intended.
  className,
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isGradient = GRADIENT_VARIANTS.includes(variant);
  const extra = className ? ` ${className}` : "";

  // The disabled look is a real state, not a dimmed copy of the enabled one.
  //
  // It used to be `opacity-50` on the whole Pressable, and `useGradient` additionally excluded
  // `disabled` — so the instant a submit button set `disabled={loading}` (login, OTP verify,
  // treatment submit, the photo/camera actions: every async action in the app does this) the
  // gradient vanished AND the label went half-transparent along with the background. White text
  // at 50% over a near-white page is invisible; the button read as "turned white and
  // disappeared" for exactly as long as the request was in flight. The fix is to keep the
  // background fully opaque and change its *colour* instead: solid muted grey for the filled
  // variants (white label stays readable on it), a flat tinted box with muted text for the
  // outline variants. Opacity is never applied to the label.
  const filledDisabled = disabled && isGradient;
  const outlineDisabled = disabled && !isGradient;

  const content = (
    <>
      {typeof children === "string" ? (
        <Text className={`${s.text} font-bold ${outlineDisabled ? "text-muted" : v.text}`}>
          {children}
        </Text>
      ) : (
        children
      )}
    </>
  );

  // Pressed feedback was missing entirely — the button had no `active:` class and no pressed
  // style, so a tap produced no visual acknowledgement at all. A small opacity step is applied
  // through the style function rather than a NativeWind `active:` variant so it composes with
  // the gradient child (which paints over any background class) and can never lighten the
  // button toward the page colour.
  const pressStyle = ({ pressed }: { pressed: boolean }): ViewStyle[] => [
    ...(style ? [style] : []),
    ...(pressed && !disabled ? [{ opacity: 0.88 }] : []),
  ];

  if (isGradient) {
    const colors = variant === "success" ? GRADIENTS.success : GRADIENTS.accent;
    return (
      <Pressable
        disabled={disabled}
        // `v.bg` stays on the Pressable underneath the gradient as a solid fallback: the
        // gradient is an absolutely-positioned child, so if it ever fails to paint, the button
        // is still a filled brand-coloured box rather than a transparent one with a white label.
        className={`${s.height} ${s.radius} ${s.px} ${fullWidth ? "w-full" : ""} ${
          filledDisabled ? "bg-muted" : v.bg
        } items-center justify-center flex-row gap-2 overflow-hidden${extra}`}
        style={pressStyle}
        {...props}
      >
        {/* No shadow here: `overflow-hidden` (needed to clip the gradient to the rounded
            corners) also clips RN's shadow on iOS. Pre-existing gap — the gradient variant
            (primary/success, the default) has never had a shadow; fixing it needs an outer
            shadow wrapper + inner clipped view, verified on a running build, not guessed here. */}
        {!filledDisabled && (
          <LinearGradient
            colors={colors as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            // Laid out with a plain style, not `className="absolute inset-0"`. This fill is
            // load-bearing (it *is* the button's background) and shouldn't depend on the
            // cssInterop registration for a third-party component to resolve.
            style={StyleSheet.absoluteFill}
          />
        )}
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={disabled}
      className={`${s.height} ${s.radius} ${s.px} ${fullWidth ? "w-full" : ""} ${
        outlineDisabled ? "bg-bg border-border" : `${v.bg} ${v.border}`
      } border shadow-btn items-center justify-center flex-row gap-2${extra}`}
      style={pressStyle}
      {...props}
    >
      {content}
    </Pressable>
  );
}
