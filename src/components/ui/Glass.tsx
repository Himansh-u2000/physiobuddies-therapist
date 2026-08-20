import { StyleSheet, View, type ViewProps } from "react-native";
import { GlassView, isLiquidGlassAvailable, type GlassStyle } from "expo-glass-effect";

/**
 * Whether this OS build can actually draw Liquid Glass (iOS 26+).
 *
 * Read once at module load rather than per render: it's a static capability of the OS the app
 * was launched on, not something that changes while running. On Android and on older iOS,
 * `expo-glass-effect` ships stubs — `isLiquidGlassAvailable()` returns false and `GlassView`
 * renders a plain transparent `View` — so every glass surface here needs its own opaque
 * fallback or it would simply vanish on those platforms.
 */
export const GLASS_ENABLED = isLiquidGlassAvailable();

/**
 * Extra bottom padding a full-screen scroll view needs on the tab screens.
 *
 * The tab bar only floats over content when glass is on; everywhere else it sits in normal flow
 * and content already stops above it. Adding this unconditionally would leave a dead 76px gap at
 * the bottom of every list on Android, so it's zero there.
 */
export const FLOATING_TAB_BAR_INSET = GLASS_ENABLED ? 76 : 0;

/**
 * The glass itself, as a background layer to drop into a container you can't replace.
 *
 * `GlassSurface` covers the common case, but some surfaces have to stay the element they are —
 * a card that's a `Pressable`, for instance. Those keep their own tag and render this as their
 * first child. It returns `null` when glass is unavailable, so the container's own background
 * shows through untouched; `pointerEvents="none"` keeps it out of the way of the press target.
 */
export function GlassLayer({
  radius,
  glassStyle = "regular",
  tintColor,
}: {
  radius?: number;
  glassStyle?: GlassStyle;
  tintColor?: string;
}) {
  if (!GLASS_ENABLED) return null;
  return (
    <GlassView
      pointerEvents="none"
      glassEffectStyle={glassStyle}
      tintColor={tintColor}
      style={[StyleSheet.absoluteFill, radius ? { borderRadius: radius } : null]}
    />
  );
}

interface GlassSurfaceProps extends ViewProps {
  /** `regular` frosts and refracts; `clear` is closer to plain transparency. */
  glassStyle?: GlassStyle;
  tintColor?: string;
  /**
   * Corner radius for the glass layer itself. Needed because the layer is an absolutely
   * positioned child: without its own radius it paints square corners inside a rounded parent,
   * and the alternative (`overflow: "hidden"` on the parent) would clip the card's shadow.
   */
  glassRadius?: number;
  /**
   * Classes applied **only when glass is unavailable** — normally the opaque background the
   * glass replaces. When glass is on the surface must stay transparent, or the effect would be
   * refracting a solid colour instead of the content behind it.
   */
  fallbackClassName?: string;
}

/**
 * A surface that is Liquid Glass on iOS 26+ and its previous opaque self everywhere else.
 *
 * The glass is a `pointerEvents="none"` layer *behind* the children rather than the container
 * itself. That keeps layout and NativeWind classes on an ordinary `View`, so call sites style
 * these exactly as they did before, and it means a header's buttons or a card's press target
 * still receive touches normally.
 */
export function GlassSurface({
  glassStyle = "regular",
  tintColor,
  glassRadius,
  fallbackClassName = "bg-white",
  className,
  style,
  children,
  ...props
}: GlassSurfaceProps) {
  return (
    <View
      className={`${className ?? ""} ${GLASS_ENABLED ? "" : fallbackClassName}`}
      style={style}
      {...props}
    >
      <GlassLayer radius={glassRadius} glassStyle={glassStyle} tintColor={tintColor} />
      {children}
    </View>
  );
}
