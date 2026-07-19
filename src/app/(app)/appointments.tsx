import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Calendar, TriangleAlert } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { Avatar, Chip, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { appointmentApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useSyncedQuery } from "@/lib/hooks/useSyncedQuery";
import { getCachedAppointments, cacheAppointments } from "@/lib/db/repositories";
import { COLORS } from "@/constants/config";
import { formatCurrency, getSessionTypeLabel } from "@/lib/utils/format";
import type { Appointment } from "@/types";

export default function AppointmentsScreen() {
  const router = useRouter();
  const therapist = useAuthStore((s) => s.therapist);
  const { data: appointments, isLoading, isError, refetch } = useSyncedQuery({
    queryKey: ["appointments"],
    queryFn: appointmentApi.list,
    readCache: getCachedAppointments,
    writeCache: cacheAppointments,
  });

  const renderItem = ({ item }: { item: Appointment }) => (
    <Pressable
      onPress={() => router.push(`/session/appointment/${item.id}`)}
      className="bg-white border border-border rounded-lg mb-3 active:opacity-90 overflow-hidden"
      style={{ shadowColor: COLORS.nav, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 }}
    >
      <View className="flex-row">
        <View className="w-[72px] items-center justify-between bg-primary-soft px-2 py-4">
          <View className="items-center">
            <Text className="text-[18px] font-black text-accent">{item.timeLabel}</Text>
            <Text className="text-[10px] text-muted font-extrabold uppercase">{item.meridiem}</Text>
          </View>
          <View className="rounded-full bg-white px-2 py-1 border border-accent/10">
            <Text className="text-[9px] font-bold text-accent">{item.etaMin ? `${item.etaMin}m` : "Ready"}</Text>
          </View>
        </View>

        <View className="flex-1 p-3.5" style={{ gap: 10 }}>
          <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
            <View className="flex-row flex-1 items-center" style={{ gap: 10 }}>
              <Avatar name={item.patientName} url={item.patientAvatarUrl} size={42} radius={13} />
              <View className="flex-1">
                <Text className="text-[15px] font-extrabold text-fg" numberOfLines={1}>{item.patientName}</Text>
                <Text className="text-muted text-[11px] mt-0.5" numberOfLines={1}>{item.condition}</Text>
              </View>
            </View>
            <Chip variant={item.paymentStatus === "paid" ? "active" : "pending"}>
              {item.paymentStatus === "paid" ? "Paid" : "Pending"}
            </Chip>
          </View>

          <View className="flex-row flex-wrap" style={{ gap: 7 }}>
            <View className="rounded-full bg-bg px-2.5 py-1 border border-border">
              <Text className="text-[10px] font-bold text-muted">{getSessionTypeLabel(item.type)}</Text>
            </View>
            <View className="rounded-full bg-mint-soft px-2.5 py-1 border border-success/10">
              <Text className="text-[10px] font-bold text-success">{formatCurrency(item.amount)}</Text>
            </View>
            {item.distanceKm && (
              <View className="rounded-full bg-tint px-2.5 py-1 border border-accent/10">
                <Text className="text-[10px] font-bold text-accent">{item.distanceKm} km away</Text>
              </View>
            )}
          </View>

          {item.address && (
            <Text className="text-muted text-[11px] leading-4" numberOfLines={2}>{item.address}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} title="Appointments" subtitle="Today & upcoming" showNotification={false} />
      <FlashList
        data={appointments ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 96 }}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={110} radius={14} />
              <Skeleton height={110} radius={14} />
            </View>
          ) : isError ? (
            <ErrorState
              icon={TriangleAlert}
              title="Something went wrong"
              badge="Error"
              description="We couldn't load your appointments right now. This is usually temporary. Your data is safe."
              action={{ label: "Try again", onPress: () => refetch() }}
            />
          ) : (
            <EmptyState
              icon={Calendar}
              title="No appointments today"
              description="You don't have any sessions scheduled for today. Add your availability so patients can book a clinic, home, or online slot."
            />
          )
        }
      />
    </View>
  );
}
