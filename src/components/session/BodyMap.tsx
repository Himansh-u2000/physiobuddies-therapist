import { memo } from "react";
import { View, Text } from "react-native";
import Svg, { Ellipse, Rect } from "react-native-svg";
import { COLORS } from "@/constants/config";

/**
 * Tappable body diagram for marking pain locations — a direct port of the prototype's
 * treatment-form.html body map (same 23 regions, same viewBox geometry). One deliberate
 * upgrade over the prototype: multi-select, because the app's `Treatment.painRegions`
 * is already an array and real patients present with more than one pain site.
 */

interface BodyRegion {
  label: string;
  shape: "rect" | "ellipse";
  /** rect: x y w h rx · ellipse: cx cy rx ry */
  geo: [number, number, number, number, number?];
}

/** Geometry copied verbatim from the prototype SVG (viewBox 0 0 120 260). */
const REGIONS: BodyRegion[] = [
  { label: "Head", shape: "ellipse", geo: [60, 22, 16, 18] },
  { label: "Neck", shape: "rect", geo: [54, 40, 12, 12, 4] },
  { label: "Left shoulder", shape: "rect", geo: [26, 52, 22, 14, 6] },
  { label: "Right shoulder", shape: "rect", geo: [72, 52, 22, 14, 6] },
  { label: "Upper back", shape: "rect", geo: [44, 52, 32, 28, 6] },
  { label: "Left upper arm", shape: "rect", geo: [22, 66, 16, 28, 8] },
  { label: "Right upper arm", shape: "rect", geo: [82, 66, 16, 28, 8] },
  { label: "Left forearm", shape: "rect", geo: [18, 96, 14, 24, 7] },
  { label: "Right forearm", shape: "rect", geo: [88, 96, 14, 24, 7] },
  { label: "Left hand", shape: "ellipse", geo: [24, 130, 9, 8] },
  { label: "Right hand", shape: "ellipse", geo: [96, 130, 9, 8] },
  { label: "Lower back", shape: "rect", geo: [44, 82, 32, 26, 5] },
  { label: "Abdomen", shape: "rect", geo: [46, 108, 28, 22, 5] },
  { label: "Left hip", shape: "rect", geo: [36, 130, 20, 18, 6] },
  { label: "Right hip", shape: "rect", geo: [64, 130, 20, 18, 6] },
  { label: "Left thigh", shape: "rect", geo: [38, 150, 18, 30, 8] },
  { label: "Right thigh", shape: "rect", geo: [64, 150, 18, 30, 8] },
  { label: "Left knee", shape: "ellipse", geo: [47, 188, 10, 9] },
  { label: "Right knee", shape: "ellipse", geo: [73, 188, 10, 9] },
  { label: "Left shin", shape: "rect", geo: [39, 198, 16, 28, 7] },
  { label: "Right shin", shape: "rect", geo: [65, 198, 16, 28, 7] },
  { label: "Left foot", shape: "ellipse", geo: [46, 234, 12, 8] },
  { label: "Right foot", shape: "ellipse", geo: [74, 234, 12, 8] },
];

/** Region names the map knows — exported so callers can validate stored drafts against it. */
export const BODY_MAP_REGIONS = REGIONS.map((r) => r.label);

interface BodyMapProps {
  selected: string[];
  onToggle: (region: string) => void;
}

const IDLE_FILL = "rgba(0,64,96,0.08)";
const IDLE_STROKE = "rgba(0,64,96,0.22)";

function BodyMapImpl({ selected, onToggle }: BodyMapProps) {
  return (
    <View className="items-center">
      <Svg viewBox="0 0 120 260" width={160} height={347}>
        {REGIONS.map((region) => {
          const isSelected = selected.includes(region.label);
          const common = {
            fill: isSelected ? COLORS.accent : IDLE_FILL,
            stroke: isSelected ? COLORS.accent : IDLE_STROKE,
            strokeWidth: 1,
            onPress: () => onToggle(region.label),
          };
          if (region.shape === "ellipse") {
            const [cx, cy, rx, ry] = region.geo;
            return <Ellipse key={region.label} cx={cx} cy={cy} rx={rx} ry={ry} {...common} />;
          }
          const [x, y, w, h, rx] = region.geo;
          return <Rect key={region.label} x={x} y={y} width={w} height={h} rx={rx ?? 4} {...common} />;
        })}
      </Svg>
      <View className="mt-2 rounded-full border border-border bg-white px-3 py-1.5">
        <Text className="text-[11px] font-bold text-accent">
          {selected.length > 0 ? `Selected: ${selected.join(", ")}` : "Tap body regions to mark pain areas"}
        </Text>
      </View>
    </View>
  );
}

export const BodyMap = memo(BodyMapImpl);
