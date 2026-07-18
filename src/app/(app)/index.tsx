import { View, Text, ScrollView, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { FileWarning, ClipboardList } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { NextSessionCard } from "@/components/dashboard/NextSessionCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { WeeklyChart } from "@/components/dashboard/WeeklyChart";
import { Chip, Skeleton } from "@/components/ui";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { therapistApi, appointmentApi } from "@/lib/api/services";
import { COLORS } from "@/constants/config";

export default function DashboardScreen() {
  const therapist = useAuthStore((s) => s.therapist);
  const isOnline = useAppStore((s) => s.isOnline);
  const setOnline = useAppStore((s) => s.setOnline);
  const showToast = useAppStore((s) => s.showToast);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: therapistApi.getDashboard,
  });

  const { data: appointments } = useQuery({
    queryKey: ["appointments"],
    queryFn: appointmentApi.list,
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
        {statsLoading || !stats ? (
          <DashboardSkeleton />
        ) : (
          <>
            <HeroCard
              therapist={therapist}
              stats={stats}
              isOnline={isOnline}
              onToggleOnline={handleToggleOnline}
            />

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
                  <Pressable onPress={() => {}}>
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
                <Text className="text-[17px] font-bold text-fg">Pending tasks</Text>
                <Chip variant="cancelled">{stats.pendingTasks} need action</Chip>
              </View>
              <View style={{ gap: 10 }}>
                <Pressable className="bg-white border border-border rounded-md p-3 active:opacity-80" style={{ gap: 8, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center" style={{ gap: 10 }}>
                      <View className="w-9 h-9 rounded-[10px] items-center justify-center" style={{ backgroundColor: "rgba(207,66,56,0.08)" }}>
                        <FileWarning size={18} color={COLORS.danger} />
                      </View>
                      <Text className="text-[13px] font-bold text-fg">Registration certificate rejected</Text>
                    </View>
                    <Chip variant="cancelled">Re-upload</Chip>
                  </View>
                  <Text className="text-muted text-[12px]">
                    Image is blurred. Upload a clear scan to unlock your public profile.
                  </Text>
                </Pressable>

                <Pressable className="bg-white border border-border rounded-md p-3 active:opacity-80" style={{ gap: 8, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center" style={{ gap: 10 }}>
                      <View className="w-9 h-9 rounded-[10px] items-center justify-center" style={{ backgroundColor: "rgba(209,154,18,0.1)" }}>
                        <ClipboardList size={18} color={COLORS.warning} />
                      </View>
                      <Text className="text-[13px] font-bold text-fg">Complete Neha&apos;s treatment note</Text>
                    </View>
                    <Chip variant="pending">Draft</Chip>
                  </View>
                  <Text className="text-muted text-[12px]">
                    Session ended at 8:40 AM. Submit before payout review at 6 PM.
                  </Text>
                </Pressable>
              </View>
            </View>

            <View className="mt-3">
              <View className="flex-row items-center justify-between mb-2.5">
                <Text className="text-[17px] font-bold text-fg">This week</Text>
                <Pressable>
                  <Text className="text-accent font-bold text-[12px]">Full report</Text>
                </Pressable>
              </View>
              <View className="bg-white border border-border rounded-md p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <View>
                    <Text className="text-[22px] font-black text-accent">
                      Rs {stats.weeklyEarnings.toLocaleString("en-IN")}
                    </Text>
                    <Text className="text-muted text-[12px]">Weekly earnings</Text>
                  </View>
                  <Chip variant="active">+{stats.weeklyChangePercent}% vs last week</Chip>
                </View>
                <WeeklyChart data={stats.weeklyChart} />
              </View>
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
