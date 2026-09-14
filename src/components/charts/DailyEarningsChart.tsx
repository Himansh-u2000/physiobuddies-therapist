import { memo, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { COLORS } from "@/constants/config";
import { formatCurrency } from "@/lib/utils/format";
import { barFraction, compactRupees, GRID_COLOR, niceMax, SERIES_COLOR } from "./scale";

const FULL_DAY: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const PLOT_HEIGHT = 128;
const AXIS_WIDTH = 46;

interface DailyEarningsChartProps {
  data: { day: string; amount: number; isToday: boolean }[];
}

/**
 * This week's earnings, one bar per day.
 *
 * Replaces `WeeklyChart`, which failed on the things that decide whether a bar chart is honest:
 *
 *   - **A zero day drew an 18px bar** (`minHeight: 18`), so a day with no earnings looked like a
 *     day with some. Bars now start at a true zero baseline and a zero day draws nothing.
 *   - **There was no scale.** No axis, gridline or value, so bar height could not be read as an
 *     amount. There is now a 0 / half / top axis on nice round numbers, in recessive hairlines.
 *   - **Selection was a status colour.** The tapped bar turned `COLORS.success` green, which reads
 *     as "good day". Every bar is now the one validated series colour; the selected day is carried
 *     by the value label, bold text and an underline — nothing about it depends on colour.
 *   - **Heavy blocks:** drop shadows, 10px rounded tops and a decorative white strip. Now thin marks
 *     with 4px rounded data-ends, square at the baseline.
 *   - **Card-in-card:** it wrapped itself in a `GlassSurface` inside the screen's own card. It is
 *     bare now; each screen supplies the card.
 *
 * On a phone there is no hover, so tap is the tooltip. It is never the only way to a value: each
 * bar carries its amount as an accessibility label, the screen-reader equivalent of a table view.
 */
function DailyEarningsChartImpl({ data }: DailyEarningsChartProps) {
  const max = useMemo(() => niceMax(Math.max(0, ...data.map((d) => d.amount))), [data]);
  const defaultDay = data.find((d) => d.isToday)?.day ?? data[data.length - 1]?.day;
  const [selectedDay, setSelectedDay] = useState<string | undefined>(defaultDay);
  const selected = data.find((d) => d.day === selectedDay) ?? data.find((d) => d.day === defaultDay);

  if (max === 0) {
    return (
      <View
        className="items-center justify-center rounded-[12px]"
        style={{ height: PLOT_HEIGHT + 40, backgroundColor: "rgba(0,64,96,0.03)" }}
      >
        <Text className="text-[13px] font-bold text-fg">No earnings yet this week</Text>
        <Text className="text-muted text-[11.5px] mt-1">Completed sessions will appear here by day.</Text>
      </View>
    );
  }

  const ticks = [max, max / 2, 0];

  return (
    <View accessible={false}>
      {/* Direct label for the selection — the one value called out, not a number on every bar. */}
      {selected && (
        <View className="flex-row items-baseline justify-between mb-3">
          <Text className="text-muted text-[12px] font-semibold">
            {FULL_DAY[selected.day] ?? selected.day}
            {selected.isToday ? " · Today" : ""}
          </Text>
          <Text className="text-[16px] font-extrabold text-fg">{formatCurrency(selected.amount)}</Text>
        </View>
      )}

      <View className="flex-row">
        {/* Y axis */}
        <View style={{ width: AXIS_WIDTH, height: PLOT_HEIGHT }} className="justify-between">
          {ticks.map((t, i) => (
            <Text
              key={t}
              className="text-[9.5px] text-muted font-semibold"
              style={{
                fontVariant: ["tabular-nums"],
                // Pull the first and last label onto their gridline rather than hanging past it.
                marginTop: i === 0 ? -6 : 0,
                marginBottom: i === ticks.length - 1 ? -6 : 0,
              }}
            >
              {compactRupees(t)}
            </Text>
          ))}
        </View>

        {/* Plot */}
        <View className="flex-1" style={{ height: PLOT_HEIGHT }}>
          {[0, 0.5].map((f) => (
            <View
              key={f}
              pointerEvents="none"
              className="absolute left-0 right-0"
              style={{ top: f * PLOT_HEIGHT, height: 1, backgroundColor: GRID_COLOR }}
            />
          ))}
          {/* Baseline: one step stronger than the grid, because it is where zero is. */}
          <View
            pointerEvents="none"
            className="absolute left-0 right-0 bottom-0"
            style={{ height: 1, backgroundColor: COLORS.border }}
          />

          <View className="flex-row items-end h-full px-1" style={{ gap: 8 }}>
            {data.map((d) => {
              const active = d.day === selected?.day;
              const height = barFraction(d.amount, max) * PLOT_HEIGHT;
              return (
                <Pressable
                  key={d.day}
                  onPress={() => setSelectedDay(d.day)}
                  // The whole column is the target, not just the bar — a zero day has no bar to hit.
                  className="flex-1 h-full items-center justify-end"
                  hitSlop={{ top: 8, bottom: 24 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${FULL_DAY[d.day] ?? d.day}${d.isToday ? ", today" : ""}: ${formatCurrency(d.amount)}`}
                >
                  {height > 0 && (
                    <View
                      style={{
                        width: "100%",
                        maxWidth: 24,
                        height,
                        backgroundColor: SERIES_COLOR,
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                        // Emphasis without a second hue: the rest step back rather than the
                        // selection stepping into a different colour.
                        opacity: active ? 1 : 0.55,
                      }}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* X axis */}
      <View className="flex-row mt-2" style={{ paddingLeft: AXIS_WIDTH }}>
        <View className="flex-1 flex-row px-1" style={{ gap: 8 }}>
          {data.map((d) => {
            const active = d.day === selected?.day;
            return (
              <View key={d.day} className="flex-1 items-center">
                <Text
                  className={`text-[10px] ${active ? "font-extrabold text-fg" : "font-semibold text-muted"}`}
                >
                  {d.day}
                </Text>
                <View
                  className="mt-1 rounded-full"
                  style={{
                    height: 2,
                    width: 14,
                    backgroundColor: active ? COLORS.fg : "transparent",
                  }}
                />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export const DailyEarningsChart = memo(DailyEarningsChartImpl);
