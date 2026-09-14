import { View, Text } from "react-native";
import { Avatar } from "@/components/ui";
import { getGreeting, formatCurrency } from "@/lib/utils/format";
import { COLORS } from "@/constants/config";
import type { Therapist, DashboardStats } from "@/types";

interface HeroCardProps {
  therapist: Therapist | null;
  stats: DashboardStats;
}

/**
 * The online/offline toggle that used to sit here is gone, and not only for layout.
 *
 * It wrote to `useAppStore.isOnline` — which is not the therapist's availability at all but the
 * NETWORK connectivity flag `useNetwork` sets from NetInfo. Switching it "Offline" raised the
 * offline banner and paused the sync engine on a connected phone, and nothing reached the server:
 * availability is managed through the slot schedule, and there is no availability-status
 * endpoint for a toggle to call.
 */
export function HeroCard({ therapist, stats }: HeroCardProps) {
  return (
    <View className="bg-surface-strong border border-border rounded-md p-4 overflow-hidden relative" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.12, shadowRadius: 28, elevation: 6 }}>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <Avatar name={therapist?.name} url={therapist?.avatarUrl} size={96} radius={22} />
        <View className="flex-1">
          <Text className="text-[20px] font-extrabold text-fg leading-tight">
            {getGreeting()},{"\n"}{therapist?.name ?? "Doctor"} 👋
          </Text>
        </View>
      </View>

      <View className="flex-row mt-3.5" style={{ gap: 8 }}>
        <StatBox value={String(stats.todaySessions)} label="Today's sessions" color={COLORS.info} bg="rgba(0,134,168,0.09)" />
        <StatBox value={formatCurrency(stats.earnedToday)} label="Earned today" color={COLORS.success} bg="rgba(35,145,73,0.10)" />
        <StatBox value={`${stats.rating} ⭐`} label="Rating" color={COLORS.warning} bg="rgba(209,154,18,0.10)" />
      </View>
    </View>
  );
}

/** Colour-coded stat tiles — each metric gets its own tint (teal / green / amber) so the
 *  hero reads as lively rather than three identical grey boxes. All within the brand palette. */
function StatBox({ value, label, color, bg }: { value: string; label: string; color: string; bg: string }) {
  return (
    <View className="flex-1 rounded-[12px] py-2.5 items-center" style={{ backgroundColor: bg }}>
      <Text className="text-[18px] font-extrabold" style={{ color }}>{value}</Text>
      <Text className="text-muted text-[10px] mt-0.5">{label}</Text>
    </View>
  );
}
