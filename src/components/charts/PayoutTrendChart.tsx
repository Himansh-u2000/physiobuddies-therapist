import { memo, useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Line, Path, Polyline, Circle } from "react-native-svg";
import { COLORS } from "@/constants/config";

interface PayoutTrendChartProps {
  data: { day: string; amount: number; isToday: boolean }[];
  trendLabel?: string;
}

const VIEW_W = 300;
const VIEW_H = 120;
const PAD_TOP = 12;
const PAD_BOTTOM = 12;

/**
 * Matches the prototype's earnings.html `.line-chart` (SVG area + stroke + dots) — a genuine
 * gap, not a re-implementation: the app had no chart here at all, only the daily-sessions bar
 * chart. Reuses the same weeklyChart data as the bar chart rather than inventing a second,
 * disconnected "trend" dataset.
 */
function PayoutTrendChartImpl({ data, trendLabel }: PayoutTrendChartProps) {
  const points = useMemo(() => {
    if (data.length === 0) return [];
    const amounts = data.map((d) => d.amount);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const range = max - min || 1;
    const step = data.length > 1 ? VIEW_W / (data.length - 1) : 0;
    return data.map((d, i) => {
      const x = i * step;
      const norm = (d.amount - min) / range;
      const y = VIEW_H - PAD_BOTTOM - norm * (VIEW_H - PAD_TOP - PAD_BOTTOM);
      return { x, y, day: d.day };
    });
  }, [data]);

  if (points.length === 0) return null;

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const last = points[points.length - 1];
  const areaPath = `M${points.map((p) => `${p.x},${p.y}`).join(" L")} L${last.x},${VIEW_H} L${points[0].x},${VIEW_H} Z`;

  return (
    <View className="bg-white border border-border rounded-md p-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-[13px] font-bold text-fg">Payout trend</Text>
        {trendLabel && (
          <View className="rounded-full bg-success/10 border border-success/15 px-2.5 py-1">
            <Text className="text-[11px] font-extrabold text-success">{trendLabel}</Text>
          </View>
        )}
      </View>
      <View style={{ height: 130 }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="payoutArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={COLORS.success} stopOpacity={0.2} />
              <Stop offset="100%" stopColor={COLORS.success} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Line x1={0} y1={30} x2={VIEW_W} y2={30} stroke={COLORS.border} strokeWidth={1} />
          <Line x1={0} y1={60} x2={VIEW_W} y2={60} stroke={COLORS.border} strokeWidth={1} />
          <Line x1={0} y1={90} x2={VIEW_W} y2={90} stroke={COLORS.border} strokeWidth={1} />
          <Path d={areaPath} fill="url(#payoutArea)" />
          <Polyline
            points={linePoints}
            fill="none"
            stroke={COLORS.success}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p, i) => {
            const isLast = i === points.length - 1;
            return (
              <Circle
                key={p.day}
                cx={p.x}
                cy={p.y}
                r={isLast ? 5 : 4}
                fill={COLORS.success}
                stroke={isLast ? "#fff" : undefined}
                strokeWidth={isLast ? 2 : undefined}
              />
            );
          })}
        </Svg>
      </View>
      <View className="flex-row mt-1.5">
        {points.map((p) => (
          <Text key={p.day} className="flex-1 text-center text-[9px] font-bold text-muted">
            {p.day}
          </Text>
        ))}
      </View>
    </View>
  );
}

export const PayoutTrendChart = memo(PayoutTrendChartImpl);
