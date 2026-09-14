import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ServerCrash } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { NextSessionCard } from "@/components/dashboard/NextSessionCard";
import { ResumeSessionCard } from "@/components/dashboard/ResumeSessionCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DailyEarningsChart } from "@/components/charts/DailyEarningsChart";
import { ChangeBadge } from "@/components/charts/ChangeBadge";
import { SyncStatusCard } from "@/components/shared/SyncStatusCard";
import { ErrorState, Skeleton } from "@/components/ui";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useSyncedQuery } from "@/lib/hooks/useSyncedQuery";
import {
  getCachedDashboardStats,
  cacheDashboardStats,
  getCachedAppointments,
  cacheAppointments,
} from "@/lib/db/repositories";
import { therapistApi, appointmentApi } from "@/lib/api/services";
import { GlassSurface } from "@/components/ui/Glass";
import { formatCurrency } from "@/lib/utils/format";

export default function DashboardScreen() {
  const router = useRouter();
  const therapist = useAuthStore((s) => s.therapist);

  // SQLite-first, matching the four list screens. The dashboard was the last data screen on
  // a bare `useQuery`: offline it showed its skeleton forever, on the app's landing screen,
  // while every list behind it rendered from cache.
  const { data: stats, isLoading: statsLoading, isError, refetch } = useSyncedQuery({
    queryKey: ["dashboard"],
    queryFn: therapistApi.getDashboard,
    readCache: getCachedDashboardStats,
    writeCache: cacheDashboardStats,
  });

  const { data: appointments } = useSyncedQuery({
    queryKey: ["appointments"],
    queryFn: appointmentApi.list,
    readCache: getCachedAppointments,
    writeCache: cacheAppointments,
  });

  const nextAppointment = appointments?.[0];

  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-3.5 pt-3 pb-24">
        {statsLoading ? (
          <DashboardSkeleton />
        ) : !stats ? (
          // Only reachable on a first-ever launch with an empty cache and a failed fetch —
          // otherwise `useSyncedQuery` falls back to the cached snapshot. Previously this
          // state rendered the skeleton forever, with no way out.
          <ErrorState
            icon={ServerCrash}
            title="Couldn't load your dashboard"
            badge="Offline"
            description="We couldn't reach the server and there's nothing saved on this device yet."
            action={{ label: "Try again", onPress: refetch }}
          />
        ) : (
          <>
            {isError && (
              <View className="bg-warning/10 border border-warning/20 rounded-md px-3 py-2 mb-3">
                <Text className="text-[11px] font-bold text-fg">
                  Showing saved data — couldn&apos;t refresh just now.
                </Text>
              </View>
            )}

            <HeroCard therapist={therapist} stats={stats} />

            {/* Both render nothing unless there's something unfinished — placed directly under
                the hero so an interrupted session or a stuck record is the first actionable
                thing on the screen, not buried below the fold. */}
            <ResumeSessionCard />
            <SyncStatusCard />

            <LinearGradient
              colors={["#003554", "#004060"]}
              className="mt-3 rounded-lg overflow-hidden relative h-[140px] justify-end p-4"
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-white/5" />
              {/* The right-hand "96% On-time" that sat here was a hardcoded literal — no data behind
                  it, shown to every therapist as their own record. Removed rather than kept as
                  decoration: a fabricated performance figure on the landing screen is worse than
                  an empty corner. */}
              <View>
                <Text className="text-white/80 text-[11px] font-bold uppercase tracking-wide">
                  {therapist?.clinicName ?? "Physiobuddies Clinic"}
                </Text>
                <Text className="text-white text-[16px] font-bold mt-0.5">
                  Today: {stats.todaySessions} {stats.todaySessions === 1 ? "session" : "sessions"} scheduled
                </Text>
              </View>
            </LinearGradient>

            {nextAppointment && (
              <View className="mt-3">
                <View className="flex-row items-center justify-between mb-2.5">
                  <Text className="text-[17px] font-bold text-fg">Next session</Text>
                  <Pressable onPress={() => router.push("/(app)/appointments")}>
                    <Text className="text-accent font-bold text-[12px]">See all</Text>
                  </Pressable>
                </View>
                <NextSessionCard appointment={nextAppointment} />
              </View>
            )}

            <View className="mt-3">
              <Text className="text-[17px] font-bold text-fg mb-2.5">Quick actions</Text>
              <QuickActions />
            </View>

            <View className="mt-3">
              <View className="flex-row items-center justify-between mb-2.5">
                <Text className="text-[17px] font-bold text-fg">This week</Text>
                {/* Had no `onPress` — a link that did nothing. */}
                <Pressable onPress={() => router.push("/(app)/earnings")} hitSlop={8}>
                  <Text className="text-accent font-bold text-[12px]">Full report</Text>
                </Pressable>
              </View>
              <GlassSurface
                fallbackClassName="bg-white"
                glassRadius={12}
                className="border border-border rounded-md p-4">
                <View className="flex-row items-start justify-between mb-4" style={{ gap: 8 }}>
                  <View className="flex-shrink">
                    <Text className="text-muted text-[12px] font-semibold">Earned this week</Text>
                    {/* The headline is the number — same sans as everything else, proportional
                        figures, in text ink rather than a brand colour. */}
                    <Text className="text-[24px] font-black text-fg mt-0.5">
                      {formatCurrency(stats.weeklyEarnings)}
                    </Text>
                  </View>
                  <ChangeBadge percent={stats.weeklyChangePercent} />
                </View>
                <DailyEarningsChart data={stats.weeklyChart} />
              </GlassSurface>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DashboardSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <Skeleton height={180} radius={12} />
      <Skeleton height={140} radius={18} />
      <Skeleton height={200} radius={14} />
      <Skeleton height={120} radius={12} />
    </View>
  );
}
