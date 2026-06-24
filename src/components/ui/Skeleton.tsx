import { View, type DimensionValue } from "react-native";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  className?: string;
}

export function Skeleton({ width = "100%", height = 16, radius = 8, className }: SkeletonProps) {
  return (
    <View
      className={`bg-muted/15 ${className ?? ""}`}
      style={{ width, height, borderRadius: radius }}
    />
  );
}
