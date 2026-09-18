import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  ArrowDownCircle,
  AlertCircle,
  Wallet,
  TriangleAlert,
} from "lucide-react-native";
import { AppHeader } from "@/components/shared/AppHeader";
import { DailyEarningsChart } from "@/components/charts/DailyEarningsChart";
import { WeeklyTrendChart } from "@/components/charts/WeeklyTrendChart";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { earningsApi } from "@/lib/api/services";
import { useSyncedQuery } from "@/lib/hooks/useSyncedQuery";
import { getCachedEarningsSummary, cacheEarningsSummary, getCachedTransactions, cacheTransactions } from "@/lib/db/repositories";
import { COLORS } from "@/constants/config";
import { formatCurrency } from "@/lib/utils/format";
import type { Transaction } from "@/types";
import { GlassSurface } from "@/components/ui/Glass";

export default function EarningsScreen() {
  const router = useRouter();
  const {
    data: earnings,
    isLoading: earningsLoading,
    isError: earningsError,
    refetch: refetchEarnings,
  } = useSyncedQuery({
    queryKey: ["earnings"],
    queryFn: earningsApi.getSummary,
    readCache: getCachedEarningsSummary,
    writeCache: cacheEarningsSummary,
  });
  const {
    data: transactions,
    isLoading: txLoading,
    isError: txError,
    refetch: refetchTx,
  } = useSyncedQuery({
    queryKey: ["transactions"],
    queryFn: earningsApi.getTransactions,
    readCache: getCachedTransactions,
    writeCache: cacheTransactions,
  });

  const txIcon = (status: string) => {
    if (status === "paid") return <ArrowDownCircle size={18} color={COLORS.success} />;
    if (status === "pending") return <Clock size={18} color={COLORS.warning} />;
    return <AlertCircle size={18} color={COLORS.danger} />;
  };

  const renderItem = ({ item }: { item: Transaction }) => (
    <GlassSurface
      fallbackClassName="bg-card"
      glassRadius={12}
      className="border border-border rounded-md p-3 mb-2.5 flex-row items-center" style={{ gap: 10, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
      <View className="w-10 h-10 rounded-[12px] items-center justify-center" style={{ backgroundColor: item.status === "paid" ? "rgba(35,145,73,0.1)" : item.status === "pending" ? "rgba(209,154,18,0.1)" : "rgba(207,66,56,0.1)" }}>
        {txIcon(item.status)}
      </View>
      <View className="flex-1">
        <Text className="text-[13px] font-bold text-fg">{item.patientName}</Text>
        <Text className="text-muted text-[11px]">{item.dateLabel} · {item.type}</Text>
      </View>
      <Text className={`text-[14px] font-extrabold ${item.type === "payout" ? "text-danger" : "text-success"}`}>
        {item.type === "payout" ? "-" : "+"}{formatCurrency(item.amount)}
      </Text>
    </GlassSurface>
  );

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Earnings" subtitle="Payouts & transactions" />
      <FlashList
        data={transactions ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 96 }}
        ListHeaderComponent={
          earningsLoading ? (
            <View style={{ gap: 10, marginBottom: 12 }}>
              <Skeleton height={140} radius={18} />
              <Skeleton height={120} radius={12} />
            </View>
          ) : earningsError || !earnings ? (
            <ErrorState
              icon={TriangleAlert}
              title="Something went wrong"
              badge="Error"
              description="We couldn't load your earnings summary right now. This is usually temporary. Your data is safe."
              action={{ label: "Try again", onPress: () => refetchEarnings() }}
            />
          ) : (
            <View style={{ gap: 12, marginBottom: 12 }}>
              <LinearGradient
                colors={["#00486b", "#006071"]}
                className="rounded-lg p-5 overflow-hidden relative"
              >
                <View className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/5" />
                <Text className="text-white/80 text-[12px] font-semibold">Total this week</Text>
                <Text className="text-white text-[36px] font-black tracking-tight">
                  {formatCurrency(earnings.totalThisWeek)}
                </Text>
                <HeroChange percent={earnings.changePercent} />
                <View className="flex-row mt-3" style={{ gap: 8 }}>
                  <View className="flex-1 bg-white/10 rounded-[10px] p-2.5">
                    <Text className="text-white/70 text-[10px]">This month</Text>
                    <Text className="text-white text-[14px] font-bold">{formatCurrency(earnings.totalThisMonth)}</Text>
                  </View>
                  <View className="flex-1 bg-white/10 rounded-[10px] p-2.5">
                    <Text className="text-white/70 text-[10px]">Pending payout</Text>
                    <Text className="text-white text-[14px] font-bold">{formatCurrency(earnings.pendingPayout)}</Text>
                  </View>
                </View>
                <Text className="text-white/60 text-[11px] mt-2.5">Next payout: {earnings.nextPayoutDate}</Text>
                <Pressable
                  onPress={() => router.push("/payouts")}
                  className="mt-3 h-10 rounded-[12px] bg-white/15 flex-row items-center justify-center active:opacity-80"
                  style={{ gap: 8 }}
                >
                  <ArrowDownCircle size={16} color="#fff" />
                  <Text className="text-white font-bold text-[13px]">Payouts & wallet</Text>
                </Pressable>
              </LinearGradient>
              <ChartCard title="This week by day" subtitle="Your share of each day's sessions, after the platform fee">
                <DailyEarningsChart data={earnings.weeklyChart} />
              </ChartCard>
              {/* Absent on a summary cached by an older build until the next fetch replaces it. */}
              {earnings.weeklyTrend && earnings.weeklyTrend.length > 1 && (
                <ChartCard title="Weekly earnings" subtitle="Last 8 weeks — tap a week for its total">
                  <WeeklyTrendChart data={earnings.weeklyTrend} />
                </ChartCard>
              )}
              <Text className="text-[15px] font-bold text-fg mt-1">Transactions</Text>
            </View>
          )
        }
        ListEmptyComponent={
          txLoading ? null : txError ? (
            <ErrorState
              icon={TriangleAlert}
              title="Something went wrong"
              badge="Error"
              description="We couldn't load your transactions right now. This is usually temporary. Your data is safe."
              action={{ label: "Try again", onPress: () => refetchTx() }}
            />
          ) : (
            <EmptyState
              icon={Wallet}
              tone="success"
              title="No earnings yet"
              description="Complete your first paid session to see payouts and transactions here. Earnings are settled every Monday."
              action={{ label: "View appointments", onPress: () => router.push("/(app)/appointments") }}
            />
          )
        }
      />
    </View>
  );
}

/** A titled white card around one chart. The charts are bare, so the card lives in one place. */
function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View
      className="bg-card border border-border rounded-md p-4"
      style={{ shadowColor: COLORS.nav, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }}
    >
      <Text className="text-[14px] font-extrabold text-fg">{title}</Text>
      <Text className="text-muted text-[11.5px] mt-0.5 mb-3.5">{subtitle}</Text>
      {children}
    </View>
  );
}

/**
 * Week-over-week change on the dark hero gradient.
 *
 * Previously a hardcoded `TrendingUp` icon and `+{n}%` in green, so a losing week read "+-12% vs
 * last week" with a rising arrow. The sign now drives both the icon and the text, and nothing
 * renders when there is no previous week to compare with. Status green/amber are dropped here on
 * purpose: at 12px on this navy gradient they fall below readable contrast, so direction is carried
 * by the icon and an explicit sign in white instead.
 */
function HeroChange({ percent }: { percent: number | null }) {
  if (percent === null) {
    return <Text className="text-white/70 text-[12px] font-semibold mt-1.5">First week with earnings</Text>;
  }
  const Icon = percent > 0 ? TrendingUp : percent < 0 ? TrendingDown : Minus;
  const text =
    percent === 0 ? "Same as last week" : `${percent > 0 ? "+" : "−"}${Math.abs(percent)}% vs last week`;
  return (
    <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
      <Icon size={14} color="#fff" />
      <Text className="text-white text-[12px] font-bold">{text}</Text>
    </View>
  );
}
