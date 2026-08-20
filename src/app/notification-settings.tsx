import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking, AppState } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  BellRing,
  TriangleAlert,
  ShieldCheck,
  Mail,
  Smartphone,
  Inbox,
} from "lucide-react-native";
import { Skeleton, ErrorState, Toggle } from "@/components/ui";
import { GlassSurface } from "@/components/ui/Glass";
import { notificationApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { registerDeviceToken, type PushRegistrationState } from "@/lib/notifications/push";
import { COLORS } from "@/constants/config";
import type { NotificationPreferences } from "@/types";

/**
 * Notification settings — the app surface for `GET`/`PATCH /notifications/preferences`, plus the
 * device-level push state that no server flag can express.
 *
 * Two independent things decide whether a push actually arrives, and conflating them is what
 * makes notification settings screens confusing:
 *
 *  1. **The OS permission and this device's registration.** Shown at the top, read-only, because
 *     only the system settings app can grant the permission back once it has been denied.
 *  2. **The account's opt-in flags.** The toggles below, which apply to every device and to
 *     email as well.
 *
 * Only *promotional* and *reminder* traffic is switchable. Transactional notifications — a
 * booking landing, a cancellation, a payout clearing — are always delivered, and the screen says
 * so rather than leaving a therapist hunting for the switch that turns them off.
 */

const PUSH_STATE_COPY: Record<
  PushRegistrationState,
  { tone: "ok" | "warn" | "info"; title: string; body: string; action?: "settings" | "retry" }
> = {
  registered: {
    tone: "ok",
    title: "Push notifications are on",
    body: "This device is registered and will receive alerts even when the app is closed.",
  },
  denied: {
    tone: "warn",
    title: "Notifications are blocked",
    body: "Android is blocking notifications for Physiobuddies. Turn them on in system settings to get session and payout alerts.",
    action: "settings",
  },
  "not-configured": {
    tone: "warn",
    title: "Push isn't available in this build",
    body: "This build has no Firebase configuration, so it can't register for push. In-app notifications below still work.",
  },
  "unsupported-platform": {
    tone: "info",
    title: "Push isn't available on iOS yet",
    body: "iOS push is still being set up. You'll keep getting in-app and email notifications.",
  },
  failed: {
    tone: "warn",
    title: "Couldn't register this device",
    body: "We reached the notification service but couldn't register this device. Try again below.",
    action: "retry",
  },
};

interface ToggleRowProps {
  icon: typeof Mail;
  label: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ icon: Icon, label, description, value, disabled, onChange }: ToggleRowProps) {
  return (
    <View
      className="flex-row items-center bg-white border border-border rounded-[13px] p-3"
      style={{ gap: 12, opacity: disabled ? 0.55 : 1 }}
    >
      <View className="w-9 h-9 rounded-[10px] items-center justify-center" style={{ backgroundColor: COLORS.primarySoft }}>
        <Icon size={17} color={COLORS.accent} />
      </View>
      <View className="flex-1">
        <Text className="text-[13px] font-bold text-fg">{label}</Text>
        <Text className="text-muted text-[11.5px] mt-0.5">{description}</Text>
      </View>
      <Toggle value={value} onValueChange={disabled ? () => {} : onChange} />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();

  const [pushState, setPushState] = useState<PushRegistrationState | null>(null);
  const [saving, setSaving] = useState(false);

  const prefs = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: notificationApi.getPreferences,
  });

  /**
   * Re-check on every foreground: the therapist may have just left for system settings to grant
   * the permission, and a screen still reading "blocked" when they come back is simply wrong.
   * `registerDeviceToken` is idempotent — with an unchanged token it makes no network call — so
   * running it per resume is cheap.
   */
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      registerDeviceToken()
        .then((r) => {
          if (!cancelled) setPushState(r.state);
        })
        .catch(() => {
          if (!cancelled) setPushState("failed");
        });
    };
    check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  /**
   * Optimistic, because a toggle that snaps back while a request is in flight feels broken. The
   * server echoes the full set, so its response replaces the local guess and any rejected flag
   * corrects itself; on a thrown error the whole cached set is restored.
   */
  const update = async (patch: Partial<NotificationPreferences>) => {
    const previous = prefs.data;
    if (!previous || saving) return;
    setSaving(true);
    queryClient.setQueryData<NotificationPreferences>(["notification-preferences"], {
      ...previous,
      ...patch,
    });
    try {
      const next = await notificationApi.updatePreferences(patch);
      queryClient.setQueryData(["notification-preferences"], next);
    } catch (e) {
      queryClient.setQueryData(["notification-preferences"], previous);
      showToast(e instanceof Error ? e.message : "Couldn't save that preference.", "error");
    } finally {
      setSaving(false);
    }
  };

  const status = pushState ? PUSH_STATE_COPY[pushState] : null;
  const statusStyle =
    status?.tone === "ok"
      ? { bg: "bg-success/5", border: "border-success/25", color: COLORS.success, Icon: ShieldCheck }
      : status?.tone === "warn"
        ? { bg: "bg-warning/5", border: "border-warning/30", color: COLORS.warning, Icon: TriangleAlert }
        : { bg: "bg-info/5", border: "border-info/20", color: COLORS.info, Icon: BellRing };
  const StatusIcon = statusStyle.Icon;

  const p = prefs.data;

  return (
    <View className="flex-1 bg-bg">
      <GlassSurface
        fallbackClassName="bg-white"
        className="px-4 pb-3 flex-row items-center border-b border-border"
        style={{ paddingTop: insets.top + 10, gap: 8 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} className="w-8 h-8 items-center justify-center">
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg flex-1">Notification settings</Text>
      </GlassSurface>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 12 }}
      >
        {status && (
          <View className={`flex-row ${statusStyle.bg} border ${statusStyle.border} rounded-md p-3`} style={{ gap: 8 }}>
            <StatusIcon size={16} color={statusStyle.color} style={{ marginTop: 1 }} />
            <View className="flex-1">
              <Text className="text-[12.5px] font-bold text-fg">{status.title}</Text>
              <Text className="text-[12px] text-fg/75 mt-0.5">{status.body}</Text>
              {status.action === "settings" && (
                <Pressable onPress={() => Linking.openSettings().catch(() => {})} hitSlop={6} className="mt-2">
                  <Text className="text-[12px] font-bold text-accent">Open system settings</Text>
                </Pressable>
              )}
              {status.action === "retry" && (
                <Pressable
                  onPress={() => registerDeviceToken(true).then((r) => setPushState(r.state)).catch(() => setPushState("failed"))}
                  hitSlop={6}
                  className="mt-2"
                >
                  <Text className="text-[12px] font-bold text-accent">Try again</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        <View className="flex-row bg-info/5 border border-info/20 rounded-md p-3" style={{ gap: 8 }}>
          <ShieldCheck size={16} color={COLORS.info} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[12px] text-fg/80">
            Alerts about your bookings, sessions and payouts are always sent — they can&apos;t be
            switched off. The settings below cover reminders and offers only.
          </Text>
        </View>

        {prefs.isLoading ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={64} radius={13} />
            <Skeleton height={64} radius={13} />
            <Skeleton height={64} radius={13} />
          </View>
        ) : prefs.isError || !p ? (
          <ErrorState
            icon={TriangleAlert}
            title="Couldn't load your preferences"
            badge="Error"
            description="We couldn't reach the server. Your existing settings are unchanged."
            action={{ label: "Try again", onPress: () => prefs.refetch() }}
          />
        ) : (
          <>
            <Text className="text-[13px] font-extrabold text-fg mt-1">Session reminders</Text>
            <Text className="text-[11.5px] text-muted -mt-1.5">
              A nudge a day before and an hour before each session.
            </Text>
            <ToggleRow
              icon={Smartphone}
              label="Push"
              description="On this phone and any other signed-in device"
              value={p.reminderPush}
              disabled={saving}
              onChange={(v) => update({ reminderPush: v })}
            />
            <ToggleRow
              icon={Inbox}
              label="In-app"
              description="Shown in your notifications list"
              value={p.reminderInApp}
              disabled={saving}
              onChange={(v) => update({ reminderInApp: v })}
            />
            <ToggleRow
              icon={Mail}
              label="Email"
              description="Sent to your registered email address"
              value={p.reminderEmail}
              disabled={saving}
              onChange={(v) => update({ reminderEmail: v })}
            />

            <Text className="text-[13px] font-extrabold text-fg mt-3">Offers & updates</Text>
            <Text className="text-[11.5px] text-muted -mt-1.5">
              News, feature announcements and promotions from Physiobuddies.
            </Text>
            <ToggleRow
              icon={Smartphone}
              label="Push"
              description="On this phone and any other signed-in device"
              value={p.promotionalPush}
              disabled={saving}
              onChange={(v) => update({ promotionalPush: v })}
            />
            <ToggleRow
              icon={Inbox}
              label="In-app"
              description="Shown in your notifications list"
              value={p.promotionalInApp}
              disabled={saving}
              onChange={(v) => update({ promotionalInApp: v })}
            />
            <ToggleRow
              icon={Mail}
              label="Email"
              description="Sent to your registered email address"
              value={p.promotionalEmail}
              disabled={saving}
              onChange={(v) => update({ promotionalEmail: v })}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}
