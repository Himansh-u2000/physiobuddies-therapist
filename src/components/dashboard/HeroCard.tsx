import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar, Toggle } from "@/components/ui";
import { getGreeting, formatCurrency } from "@/lib/utils/format";
import { COLORS } from "@/constants/config";
import type { Therapist, DashboardStats } from "@/types";

interface HeroCardProps {
  therapist: Therapist | null;
  stats: DashboardStats;
  isOnline: boolean;
  onToggleOnline: (value: boolean) => void;
}

export function HeroCard({ therapist, stats, isOnline, onToggleOnline }: HeroCardProps) {
  return (
    <View className="bg-surface-strong border border-border rounded-md p-4 overflow-hidden relative" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.12, shadowRadius: 28, elevation: 6 }}>
      <View className="flex-row items-start" style={{ gap: 12 }}>
        <Avatar name={therapist?.name} url={therapist?.avatarUrl} size={96} radius={22} />
        <View className="flex-1" style={{ gap: 6 }}>
          <View className="flex-row items-center justify-between">
            <Text className={`text-[10px] font-bold ${isOnline ? "text-success" : "text-danger"}`}>
              ● {isOnline ? "Online" : "Offline"}
            </Text>
            <Toggle value={isOnline} onValueChange={onToggleOnline} />
          </View>
          <Text className="text-[20px] font-extrabold text-fg leading-tight">
            {getGreeting()},{"\n"}{therapist?.name ?? "Doctor"} 👋
          </Text>
          <Text className="text-muted text-[12px]">
            {isOnline ? "Available for home visits & clinic" : "Unavailable — not accepting sessions"}
          </Text>
        </View>
      </View>

      <View className="flex-row mt-3.5" style={{ gap: 8 }}>
        <StatBox value={String(stats.todaySessions)} label="Today's sessions" color={COLORS.accent} />
        <StatBox value={formatCurrency(stats.earnedToday)} label="Earned today" color={COLORS.success} />
        <StatBox value={`${stats.rating} ⭐`} label="Rating" color={COLORS.fg} />
      </View>
    </View>
  );
}

function StatBox({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View className="flex-1 rounded-[10px] py-2.5 items-center" style={{ backgroundColor: "rgba(0,64,96,0.04)" }}>
      <Text className="text-[18px] font-extrabold" style={{ color }}>{value}</Text>
      <Text className="text-muted text-[10px]">{label}</Text>
    </View>
  );
}
