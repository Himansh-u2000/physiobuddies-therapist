import { useMemo, useState } from "react";
import { Pressable, View, Text } from "react-native";
import { COLORS } from "@/constants/config";
import { formatCurrency } from "@/lib/utils/format";

interface WeeklyChartProps {
  data: { day: string; amount: number; isToday: boolean }[];
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  const maxValue = Math.max(...data.map((d) => d.amount), 1);
  const defaultDay = useMemo(() => data.find((d) => d.isToday)?.day ?? data[data.length - 1]?.day, [data]);
  const [selectedDay, setSelectedDay] = useState<string | undefined>(defaultDay);
  const selected = data.find((d) => d.day === selectedDay) ?? data.find((d) => d.day === defaultDay) ?? data[0];

  return (
    <View className="bg-white border border-border rounded-md p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-[13px] font-bold text-fg">Daily performance</Text>
        {selected && (
          <View className="rounded-full bg-success/10 border border-success/15 px-2.5 py-1">
            <Text className="text-[11px] font-extrabold text-success">
              {selected.day} {formatCurrency(selected.amount)}
            </Text>
          </View>
        )}
      </View>
      <View className="flex-row items-end" style={{ height: 116, gap: 8, paddingTop: 8 }}>
        {data.map((d) => {
          const heightPct = (d.amount / maxValue) * 100;
          const active = d.day === selected?.day;
          return (
            <Pressable
              key={d.day}
              onPress={() => setSelectedDay(d.day)}
              className="flex-1 items-center justify-end active:opacity-80"
              style={{ height: "100%", gap: 6 }}
              hitSlop={8}
            >
              <View
                className="w-full overflow-hidden"
                style={{
                  height: `${heightPct}%`,
                  minHeight: 18,
                  borderRadius: 10,
                  borderBottomLeftRadius: 4,
                  borderBottomRightRadius: 4,
                  backgroundColor: active ? COLORS.success : COLORS.accent,
                  opacity: active ? 1 : 0.82,
                  shadowColor: active ? COLORS.success : COLORS.accent,
                  shadowOpacity: active ? 0.22 : 0.1,
                  shadowRadius: active ? 10 : 6,
                  elevation: active ? 4 : 2,
                }}
              >
                <View className="h-1.5 w-full bg-white/25" />
              </View>
              <Text
                className={`text-center text-[9px] font-bold ${active ? "text-success" : "text-muted"}`}
              >
                {d.day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
