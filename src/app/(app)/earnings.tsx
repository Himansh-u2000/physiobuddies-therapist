import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { TrendingUp, Clock, ArrowDownCircle, AlertCircle, Wallet, TriangleAlert } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { WeeklyChart } from "@/components/dashboard/WeeklyChart";
import { PayoutTrendChart } from "@/components/charts/PayoutTrendChart";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { earningsApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useSyncedQuery } from "@/lib/hooks/useSyncedQuery";
import { getCachedEarningsSummary, cacheEarningsSummary, getCachedTransactions, cacheTransactions } from "@/lib/db/repositories";
import { COLORS } from "@/constants/config";
import { formatCurrency } from "@/lib/utils/format";
import type { Transaction } from "@/types";

export default function EarningsScreen() {
  const router = useRouter();
  const therapist = useAuthStore((s) => s.therapist);
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
    <View className="bg-white border border-border rounded-md p-3 mb-2.5 flex-row items-center" style={{ gap: 10, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
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
    </View>
  );

  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} title="Earnings" subtitle="Payouts & transactions" showNotification={false} />
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
                <View className="flex-row items-center mt-1.5" style={{ gap: 6 }}>
                  <TrendingUp size={14} color="#349e54" />
                  <Text className="text-success text-[12px] font-bold">+{earnings.changePercent}% vs last week</Text>
                </View>
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
              </LinearGradient>
              <WeeklyChart data={earnings.weeklyChart} />
              <PayoutTrendChart
                data={earnings.weeklyChart}
                trendLabel={`↑ ${earnings.changePercent}% vs last week`}
              />
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
