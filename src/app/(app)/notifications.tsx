import { useCallback, useMemo } from "react";
import { View, Text, Pressable, RefreshControl, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { Calendar, IndianRupee, ClipboardList, Info, MessageSquare, BellOff, TriangleAlert, CheckCheck, Trash2 } from "lucide-react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { AppHeader } from "@/components/shared/AppHeader";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { notificationApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { useSyncedQuery } from "@/lib/hooks/useSyncedQuery";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";
import { toAppHref } from "@/lib/notifications/links";
import { useDismissedNotifications } from "@/lib/notifications/dismissed";
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
  const showToast = useAppStore((s) => s.showToast);
  const unread = useUnreadNotifications();

  const { data: notifications, isLoading, isFetching, isError, refetch } = useSyncedQuery({
    queryKey: ["notifications"],
    queryFn: notificationApi.list,
    readCache: getCachedNotifications,
    writeCache: cacheNotifications,
  });

  const { dismissed, dismiss } = useDismissedNotifications();
  const visible = useMemo(
    () => (notifications ?? []).filter((n) => !dismissed.has(n.id)),
    [notifications, dismissed],
  );

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

  /**
   * Remove one notification from the list. Removal is recorded on this device — see
   * `lib/notifications/dismissed.ts` for why there's no server delete. An unread one is marked
   * read on the server first, so the bell's count (which comes from the server) drops with it
   * instead of counting a row the therapist can no longer see.
   */
  const removeNotification = useCallback(
    async (item: AppNotification) => {
      if (!item.read) {
        notificationApi
          .markRead(item.id)
          .then(() => queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] }))
          .catch(() => {});
      }
      try {
        await dismiss([item.id]);
      } catch {
        showToast("Couldn't remove that notification. Try again.", "error");
      }
    },
    [dismiss, queryClient, showToast],
  );

  const clearAll = useCallback(() => {
    if (visible.length === 0) return;
    Alert.alert(
      "Clear all notifications?",
      `This removes ${visible.length === 1 ? "the notification" : `all ${visible.length} notifications`} from this device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: async () => {
            if (visible.some((n) => !n.read)) {
              notificationApi
                .markAllRead()
                .then(() => queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] }))
                .catch(() => {});
            }
            try {
              await dismiss(visible.map((n) => n.id));
              showToast("Notifications cleared", "success");
            } catch {
              showToast("Couldn't clear notifications. Try again.", "error");
            }
          },
        },
      ],
    );
  }, [visible, dismiss, queryClient, showToast]);

  const renderItem = ({ item }: { item: AppNotification }) => (
    // Keyed by id so FlashList's view recycling can't hand a still-swiped-open row to the next
    // notification.
    <NotificationRow key={item.id} item={item} onOpen={openNotification} onDelete={removeNotification} />
  );

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Notifications" subtitle="Recent updates" showNotification={false} />

      <View className="flex-row items-center justify-between px-3.5 pt-3">
        <Text className="text-[12px] text-muted">
          {unread > 0 ? `${unread} unread` : "All caught up"}
          {visible.length > 0 ? " · swipe left to delete" : ""}
        </Text>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {visible.length > 0 && (
            <Pressable
              onPress={clearAll}
              hitSlop={6}
              accessibilityRole="button"
              className="flex-row items-center px-2.5 py-1.5 rounded-md border bg-white active:opacity-70"
              style={{ gap: 5, borderColor: "rgba(207,66,56,0.3)" }}
            >
              <Trash2 size={13} color={COLORS.danger} />
              <Text className="text-[11px] font-semibold text-danger">Clear all</Text>
            </Pressable>
          )}
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
        </View>
      </View>

      <FlashList
        data={visible}
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

/** How far a row must be dragged left before letting go deletes it. */
const DELETE_THRESHOLD = 72;
const DELETE_PANEL_WIDTH = 96;

/**
 * One notification. Swipe left to delete: the red panel slides in behind the row, and releasing
 * past the threshold removes it. A short drag springs back, so a scroll that wanders sideways
 * doesn't delete anything. Screen-reader users get the same action from the row's actions menu,
 * since a swipe isn't reachable for them.
 */
function NotificationRow({
  item,
  onOpen,
  onDelete,
}: {
  item: AppNotification;
  onOpen: (item: AppNotification) => void;
  onDelete: (item: AppNotification) => void;
}) {
  const config = iconMap[item.type] ?? iconMap.system;
  const Icon = config.icon;

  return (
    <View className="mb-2.5">
      <ReanimatedSwipeable
        friction={1.6}
        rightThreshold={DELETE_THRESHOLD}
        overshootRight={false}
        // Only reachable by dragging past the threshold — i.e. a deliberate swipe, not a nudge.
        onSwipeableOpen={() => onDelete(item)}
        renderRightActions={() => (
          <View
            className="rounded-[13px] items-center justify-center ml-2"
            style={{ width: DELETE_PANEL_WIDTH, backgroundColor: COLORS.danger }}
          >
            <Trash2 size={19} color="#fff" />
            <Text className="text-white text-[11.5px] font-bold mt-1">Delete</Text>
          </View>
        )}
      >
        <Pressable
          onPress={() => onOpen(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.read ? "" : "Unread. "}${item.title}. ${item.body}`}
          accessibilityHint="Swipe left to delete"
          accessibilityActions={[{ name: "delete", label: "Delete notification" }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "delete") onDelete(item);
          }}
          className={`border rounded-[13px] p-3 flex-row items-start active:opacity-80 ${item.read ? "bg-card border-border" : "bg-primary-soft border-info/20"}`}
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
      </ReanimatedSwipeable>
    </View>
  );
}
