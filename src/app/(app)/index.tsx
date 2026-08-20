import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ServerCrash } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { NextSessionCard } from "@/components/dashboard/NextSessionCard";
import { ResumeSessionCard } from "@/components/dashboard/ResumeSessionCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { WeeklyChart } from "@/components/dashboard/WeeklyChart";
import { SyncStatusCard } from "@/components/shared/SyncStatusCard";
import { Badge, ErrorState, Skeleton } from "@/components/ui";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { useSyncedQuery } from "@/lib/hooks/useSyncedQuery";
import {
  getCachedDashboardStats,
  cacheDashboardStats,
  getCachedAppointments,
  cacheAppointments,
} from "@/lib/db/repositories";
import { therapistApi, appointmentApi } from "@/lib/api/services";
import { GlassSurface } from "@/components/ui/Glass";

export default function DashboardScreen() {
  const router = useRouter();
  const therapist = useAuthStore((s) => s.therapist);
  const isOnline = useAppStore((s) => s.isOnline);
  const setOnline = useAppStore((s) => s.setOnline);
  const showToast = useAppStore((s) => s.showToast);

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

  const handleToggleOnline = (value: boolean) => {
    setOnline(value);
    showToast(value ? "You are now available for sessions" : "You are now offline");
  };

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

            <HeroCard
              therapist={therapist}
              stats={stats}
              isOnline={isOnline}
              onToggleOnline={handleToggleOnline}
            />

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
              <View className="flex-row items-end justify-between">
                <View className="flex-1">
                  <Text className="text-white/80 text-[11px] font-bold uppercase tracking-wide">
                    {therapist?.clinicName ?? "Physiobuddies Clinic"}
                  </Text>
                  <Text className="text-white text-[16px] font-bold mt-0.5">
                    Today: {stats.todaySessions} sessions scheduled
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-white text-[13px] font-extrabold">96%</Text>
                  <Text className="text-white/70 text-[10px]">On-time</Text>
                </View>
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
                <Pressable>
                  <Text className="text-accent font-bold text-[12px]">Full report</Text>
                </Pressable>
              </View>
              <GlassSurface
                fallbackClassName="bg-white"
                glassRadius={12}
                className="border border-border rounded-md p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <View>
                    <Text className="text-[22px] font-black text-accent">
                      Rs {stats.weeklyEarnings.toLocaleString("en-IN")}
                    </Text>
                    <Text className="text-muted text-[12px]">Weekly earnings</Text>
                  </View>
                  <Badge variant="success" size="sm">+{stats.weeklyChangePercent}% vs last week</Badge>
                </View>
                <WeeklyChart data={stats.weeklyChart} />
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
