import { View, Text, Pressable } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Calendar, IndianRupee, ClipboardList, Info, MessageSquare, BellOff, TriangleAlert } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { notificationApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useSyncedQuery } from "@/lib/hooks/useSyncedQuery";
import { getCachedNotifications, cacheNotifications } from "@/lib/db/repositories";
import { COLORS } from "@/constants/config";
import type { AppNotification } from "@/types";

const iconMap = {
  appointment: { icon: Calendar, color: COLORS.info, bg: "rgba(0,134,168,0.1)" },
  payment: { icon: IndianRupee, color: COLORS.success, bg: "rgba(35,145,73,0.1)" },
  task: { icon: ClipboardList, color: COLORS.warning, bg: "rgba(209,154,18,0.1)" },
  system: { icon: Info, color: COLORS.accent, bg: COLORS.primarySoft },
  message: { icon: MessageSquare, color: COLORS.info, bg: "rgba(0,134,168,0.1)" },
};

export default function NotificationsScreen() {
  const therapist = useAuthStore((s) => s.therapist);
  const { data: notifications, isLoading, isError, refetch } = useSyncedQuery({
    queryKey: ["notifications"],
    queryFn: notificationApi.list,
    readCache: getCachedNotifications,
    writeCache: cacheNotifications,
  });

  const renderItem = ({ item }: { item: AppNotification }) => {
    const config = iconMap[item.type] ?? iconMap.system;
    const Icon = config.icon;
    return (
      <Pressable
        className={`border rounded-[13px] p-3 mb-2.5 flex-row items-start active:opacity-80 ${item.read ? "bg-white border-border" : "bg-tint border-info/10"}`}
        style={{ gap: 12, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
      >
        <View className="w-9 h-9 rounded-[10px] items-center justify-center" style={{ backgroundColor: config.bg }}>
          <Icon size={18} color={config.color} />
        </View>
        <View className="flex-1">
          <Text className="text-[13px] font-bold text-fg">{item.title}</Text>
          <Text className="text-muted text-[12px] mt-0.5">{item.body}</Text>
          <Text className="text-muted/60 text-[10px] mt-1">{item.timestamp}</Text>
        </View>
        {!item.read && <View className="w-2 h-2 rounded-full bg-accent mt-1.5" />}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} title="Notifications" subtitle="Recent updates" showNotification={false} />
      <FlashList
        data={notifications ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 96 }}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={90} radius={13} />
              <Skeleton height={90} radius={13} />
            </View>
          ) : isError ? (
            <ErrorState
              icon={TriangleAlert}
              title="Something went wrong"
              badge="Error"
              description="We couldn't load your notifications right now. This is usually temporary. Your data is safe."
              action={{ label: "Try again", onPress: () => refetch() }}
            />
          ) : (
            <EmptyState
              icon={BellOff}
              tone="neutral"
              title="All caught up!"
              description="You have no new notifications. We'll notify you about appointments, payments, document updates, and patient messages."
            />
          )
        }
      />
    </View>
  );
}
