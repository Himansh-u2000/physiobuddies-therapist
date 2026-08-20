import { useCallback } from "react";
import { View, Text, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { Calendar, IndianRupee, ClipboardList, Info, MessageSquare, BellOff, TriangleAlert, CheckCheck, Settings2 } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { notificationApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { useSyncedQuery } from "@/lib/hooks/useSyncedQuery";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";
import { toAppHref } from "@/lib/notifications/links";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const therapist = useAuthStore((s) => s.therapist);
  const showToast = useAppStore((s) => s.showToast);
  const unread = useUnreadNotifications();

  const { data: notifications, isLoading, isFetching, isError, refetch } = useSyncedQuery({
    queryKey: ["notifications"],
    queryFn: notificationApi.list,
    readCache: getCachedNotifications,
    writeCache: cacheNotifications,
  });

  const markAllRead = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: () => showToast("Couldn't mark these as read. Try again.", "error"),
  });

  /**
   * Tapping a row does two things, and only one of them is allowed to block the navigation:
   * `PATCH /notifications/:id/read` is fire-and-forget so a slow or offline mark-read never
   * leaves the therapist staring at a row that seemingly ignored them. The list is invalidated
   * afterwards to pick up the server's new `isRead` and unread count.
   */
  const openNotification = useCallback(
    (item: AppNotification) => {
      if (!item.read) {
        notificationApi
          .markRead(item.id)
          .then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
          .catch(() => {});
      }
      router.push(toAppHref(item.actionUrl));
    },
    [router, queryClient],
  );

  const renderItem = ({ item }: { item: AppNotification }) => {
    const config = iconMap[item.type] ?? iconMap.system;
    const Icon = config.icon;
    return (
      <Pressable
        onPress={() => openNotification(item)}
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

      <View className="flex-row items-center justify-between px-3.5 pt-3">
        <Text className="text-[12px] text-muted">
          {unread > 0 ? `${unread} unread` : "All caught up"}
        </Text>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {unread > 0 && (
            <Pressable
              onPress={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              hitSlop={6}
              className="flex-row items-center px-2.5 py-1.5 rounded-md border border-border bg-white active:opacity-70"
              style={{ gap: 5, opacity: markAllRead.isPending ? 0.6 : 1 }}
            >
              <CheckCheck size={14} color={COLORS.accent} />
              <Text className="text-[11px] font-semibold text-accent">Mark all read</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push("/notification-settings")}
            hitSlop={6}
            className="w-8 h-8 rounded-md border border-border bg-white items-center justify-center active:opacity-70"
          >
            <Settings2 size={15} color={COLORS.accent} />
          </Pressable>
        </View>
      </View>

      <FlashList
        data={notifications ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={COLORS.accent} />
        }
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
