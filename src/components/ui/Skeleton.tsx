import { View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  className?: string;
  /**
   * Inline overrides, merged last. The reason this exists rather than another `className`:
   * a utility class passed in can't reliably beat the built-in `bg-muted/15`, because CSS
   * resolves conflicts by stylesheet order, not by the order classes appear in the string.
   * A placeholder on a dark surface (the session-detail gradient header) needs a light fill,
   * and an inline style is the only override that always wins.
   */
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = "100%",
  height = 16,
  radius = 8,
  className,
  style,
}: SkeletonProps) {
  return (
    <View
      className={`bg-muted/15 ${className ?? ""}`}
      style={[{ width, height, borderRadius: radius }, style]}
    />
  );
}
