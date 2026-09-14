import { memo, useMemo, useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { COLORS } from "@/constants/config";
import { formatCurrency } from "@/lib/utils/format";
import type { WeeklyTotal } from "@/types";
import { compactRupees, GRID_COLOR, niceMax, SERIES_COLOR } from "./scale";

const PLOT_HEIGHT = 120;
const AXIS_WIDTH = 46;
const PAD_Y = 8;
/** Wide enough that the edge points' labels ("28 Jul") stay inside the card at PAD_X. */
const PAD_X = 20;
const LABEL_WIDTH = 40;

/**
 * Weekly earnings over the last eight weeks — the "am I growing?" view.
 *
 * Replaces `PayoutTrendChart`, which had three problems that made it misleading rather than merely
 * plain:
 *
 *   - **It re-plotted the bar chart above it.** It was fed the same seven daily totals and titled
 *     "Payout trend", so the Earnings screen showed one dataset twice under two names — and neither
 *     was payouts. It now plots a genuinely different series: totals per week (`weeklyTrend`).
 *   - **Its y-axis was min–max normalised.** The week's lowest value always sat on the floor, so
 *     Rs 600 vs Rs 640 drew as a crash and recovery, under an area fill that implies magnitude from
 *     zero. The axis now starts at zero on nice round numbers, and the area fill is gone.
 *   - **`preserveAspectRatio="none"`** stretched the SVG to the card, turning its circles into
 *     ellipses on wider screens. The chart now measures its width and draws in real pixels.
 *
 * The current week is partial by definition, so it is drawn as partial — a dashed final segment
 * and a hollow marker, labelled "so far" — instead of as a full week that will always look like a
 * slump until Sunday.
 */
function WeeklyTrendChartImpl({ data }: { data: WeeklyTotal[] }) {
  const [width, setWidth] = useState(0);
  const max = useMemo(() => niceMax(Math.max(0, ...data.map((d) => d.amount))), [data]);
  const [selectedIndex, setSelectedIndex] = useState(data.length - 1);
  const selected = data[selectedIndex] ?? data[data.length - 1];

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const points = useMemo(() => {
    if (width <= 0 || max <= 0 || data.length === 0) return [];
    const innerW = width - PAD_X * 2;
    const step = data.length > 1 ? innerW / (data.length - 1) : 0;
    const innerH = PLOT_HEIGHT - PAD_Y * 2;
    return data.map((d, i) => ({
      x: PAD_X + i * step,
      y: PAD_Y + (1 - Math.min(1, d.amount / max)) * innerH,
      week: d,
    }));
  }, [width, max, data]);

  if (max === 0) {
    return (
      <View
        className="items-center justify-center rounded-[12px]"
        style={{ height: PLOT_HEIGHT + 40, backgroundColor: "rgba(0,64,96,0.03)" }}
      >
        <Text className="text-[13px] font-bold text-fg">No earnings in the last 8 weeks</Text>
        <Text className="text-muted text-[11.5px] mt-1">Your weekly totals will build up here.</Text>
      </View>
    );
  }

  const complete = points.filter((p) => !p.week.isCurrent);
  const current = points.find((p) => p.week.isCurrent);
  const solidPath = complete.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const lastComplete = complete[complete.length - 1];
  const active = points[selectedIndex];
  const ticks = [max, max / 2, 0];
  const innerH = PLOT_HEIGHT - PAD_Y * 2;

  return (
    <View>
      {selected && (
        <View className="flex-row items-baseline justify-between mb-3">
          <Text className="text-muted text-[12px] font-semibold">
            Week of {selected.label}
            {selected.isCurrent ? " · so far" : ""}
          </Text>
          <Text className="text-[16px] font-extrabold text-fg">{formatCurrency(selected.amount)}</Text>
        </View>
      )}

      <View className="flex-row">
        {/* Y axis, aligned to the plot's padded area rather than its box. */}
        <View style={{ width: AXIS_WIDTH, height: PLOT_HEIGHT }}>
          {ticks.map((t, i) => (
            <Text
              key={t}
              className="absolute text-[9.5px] text-muted font-semibold"
              style={{ top: PAD_Y + (i / 2) * innerH - 6, fontVariant: ["tabular-nums"] }}
            >
              {compactRupees(t)}
            </Text>
          ))}
        </View>

        <View className="flex-1" style={{ height: PLOT_HEIGHT }} onLayout={onLayout}>
          {width > 0 && (
            <Svg width={width} height={PLOT_HEIGHT}>
              {/* Solid hairline grid; the zero line one step stronger. */}
              {[0, 0.5].map((f) => (
                <Line
                  key={f}
                  x1={0}
                  x2={width}
                  y1={PAD_Y + f * innerH}
                  y2={PAD_Y + f * innerH}
                  stroke={GRID_COLOR}
                  strokeWidth={1}
                />
              ))}
              <Line x1={0} x2={width} y1={PAD_Y + innerH} y2={PAD_Y + innerH} stroke={COLORS.border} strokeWidth={1} />

              {active && (
                <Line
                  x1={active.x}
                  x2={active.x}
                  y1={PAD_Y}
                  y2={PAD_Y + innerH}
                  stroke={COLORS.muted}
                  strokeOpacity={0.35}
                  strokeWidth={1}
                />
              )}

              {solidPath ? (
                <Path d={solidPath} fill="none" stroke={SERIES_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              ) : null}
              {lastComplete && current && (
                // The partial week: dashed, because the number is still moving.
                <Path
                  d={`M${lastComplete.x},${lastComplete.y} L${current.x},${current.y}`}
                  fill="none"
                  stroke={SERIES_COLOR}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                />
              )}

              {points.map((p, i) => {
                const isActive = i === selectedIndex;
                const r = isActive ? 5.5 : 4;
                return p.week.isCurrent ? (
                  <Circle key={p.week.weekStart} cx={p.x} cy={p.y} r={r} fill="#fff" stroke={SERIES_COLOR} strokeWidth={2} />
                ) : (
                  // 2px surface ring keeps a marker legible where it overlaps the line.
                  <Circle key={p.week.weekStart} cx={p.x} cy={p.y} r={r} fill={SERIES_COLOR} stroke="#fff" strokeWidth={2} />
                );
              })}
            </Svg>
          )}

          {/*
            Tap targets: a full-height band centred on each point, spanning halfway to its
            neighbours — far larger than the 8px marker. Positioned from the same `x` as the
            markers; equal `flex-1` columns would centre at (i + ½)·width/n and drift off them.
          */}
          {points.map((p, i) => {
            const half = points.length > 1 ? (points[1].x - points[0].x) / 2 : width / 2;
            return (
              <Pressable
                key={p.week.weekStart}
                className="absolute top-0 bottom-0"
                style={{ left: p.x - half, width: half * 2 }}
                onPress={() => setSelectedIndex(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: i === selectedIndex }}
                accessibilityLabel={`Week of ${p.week.label}${p.week.isCurrent ? ", so far" : ""}: ${formatCurrency(p.week.amount)}`}
              />
            );
          })}
        </View>
      </View>

      {/* X axis — each label centred on its point's x, not on an equal slice. */}
      <View style={{ marginLeft: AXIS_WIDTH, height: 16 }} className="mt-2">
        {points.map((p, i) => {
          const isActive = i === selectedIndex;
          // Every other label: eight "28 Jul"s collide on a narrow phone. The selected and current
          // weeks always keep theirs.
          const show = isActive || p.week.isCurrent || i % 2 === (points.length - 1) % 2;
          if (!show) return null;
          return (
            <Text
              key={p.week.weekStart}
              className={`absolute text-center text-[9.5px] ${isActive ? "font-extrabold text-fg" : "font-semibold text-muted"}`}
              style={{ left: p.x - LABEL_WIDTH / 2, width: LABEL_WIDTH }}
              numberOfLines={1}
            >
              {p.week.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

export const WeeklyTrendChart = memo(WeeklyTrendChartImpl);
