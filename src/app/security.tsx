import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Smartphone,
  Monitor,
  Globe,
  LogOut,
  TriangleAlert,
  ShieldCheck,
} from "lucide-react-native";
import { Badge, Button, BottomSheet, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { accountApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";
import type { LoginSession } from "@/types";

/**
 * Account security — where you're signed in, and what's happened on the account.
 *
 * Both halves read endpoints that existed on the backend from the start but had no app surface:
 * `GET /user/sessions/` (+ `DELETE /user/sessions/:id`) and `GET /activity/`. For an app holding
 * patient health data on a phone that can be lost or shared, being able to see and kill a stray
 * session is a real safety feature, not a nicety.
 *
 * ⚠️ **The backend cannot tell us which session is this device.** `isCurrentSession` comes back
 * `false` on every row, including the one serving the request. So no row is marked "this device",
 * and the revoke confirmation says plainly that it might sign you out. If it does, the next
 * request 401s, the refresh fails, and `client.ts`'s session-dead handler ends the session
 * cleanly — so the bad case degrades correctly even though it can't be predicted.
 */
export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();

  const [pendingRevoke, setPendingRevoke] = useState<LoginSession | null>(null);
  const [revoking, setRevoking] = useState(false);

  const sessions = useQuery({ queryKey: ["login-sessions"], queryFn: accountApi.listSessions });

  const revoke = async () => {
    if (!pendingRevoke || revoking) return;
    setRevoking(true);
    try {
      await accountApi.revokeSession(pendingRevoke.id);
      showToast("Signed that device out", "success");
      setPendingRevoke(null);
      await queryClient.invalidateQueries({ queryKey: ["login-sessions"] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't sign that device out.", "error");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <View
        className="px-4 pb-3 flex-row items-center bg-white border-b border-border"
        style={{ paddingTop: insets.top + 10, gap: 8 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} className="w-8 h-8 items-center justify-center">
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg flex-1">Login activity</Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 12 }}
      >
        <View className="flex-row bg-info/5 border border-info/20 rounded-md p-3" style={{ gap: 8 }}>
          <ShieldCheck size={16} color={COLORS.info} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[12px] text-fg/80">
            These are the devices and browsers signed in to your account. If you don&apos;t recognise
            one, sign it out and change your password.
          </Text>
        </View>

        <Text className="text-[13px] font-extrabold text-fg">Signed-in devices</Text>

        {sessions.isLoading ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={72} radius={12} />
            <Skeleton height={72} radius={12} />
          </View>
        ) : sessions.isError ? (
          <ErrorState
            icon={TriangleAlert}
            title="Couldn't load your devices"
            badge="Error"
            description="We couldn't reach the server. Your account is unaffected."
            action={{ label: "Try again", onPress: () => sessions.refetch() }}
          />
        ) : (sessions.data ?? []).length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title="No active sessions"
            description="Nothing is currently signed in to your account."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {(sessions.data ?? []).map((session) => (
              <SessionRow key={session.id} session={session} onRevoke={() => setPendingRevoke(session)} />
            ))}
          </View>
        )}

        {/* The "Recent activity" audit list (GET /activity/) was removed on request. The
            endpoint and its mapper (`accountApi.listActivity` / `mapActivity`) are kept — it
            works and is tested — so re-adding the section is a UI-only change. As shipped, the
            raw log was mostly "GET /path" rows that meant nothing to a therapist and buried
            the one thing on this screen they can act on: the device list above. */}
      </ScrollView>

      <BottomSheet visible={pendingRevoke !== null} onClose={() => setPendingRevoke(null)}>
        <View style={{ gap: 14 }}>
          <Text className="text-[16px] font-extrabold text-fg">Sign out this device?</Text>
          <Text className="text-muted text-[12.5px]">
            <Text className="text-fg font-bold">{pendingRevoke?.deviceLabel}</Text>
            {pendingRevoke?.ip ? ` · ${pendingRevoke.ip}` : ""}
            {pendingRevoke?.lastActiveLabel ? ` · ${pendingRevoke.lastActiveLabel}` : ""}
          </Text>
          {/* Stated because it's genuinely unknowable, not to hedge — see the note at the top. */}
          <View className="flex-row bg-warning/8 border border-warning/30 rounded-md p-2.5" style={{ gap: 8 }}>
            <TriangleAlert size={15} color={COLORS.warning} style={{ marginTop: 1 }} />
            <Text className="flex-1 text-[11.5px] text-fg/80">
              We can&apos;t tell which of these is the phone you&apos;re holding. If this is it,
              you&apos;ll be signed out and will need to log in again.
            </Text>
          </View>
          <Button variant="danger" fullWidth onPress={revoke} disabled={revoking}>
            {revoking ? (
              <ActivityIndicator color={COLORS.danger} />
            ) : (
              <>
                <LogOut size={16} color={COLORS.danger} />
                <Text className="text-danger font-bold text-[14px]">Sign out this device</Text>
              </>
            )}
          </Button>
          <Button variant="secondary" fullWidth onPress={() => setPendingRevoke(null)}>
            Cancel
          </Button>
        </View>
      </BottomSheet>
    </View>
  );
}

function SessionRow({ session, onRevoke }: { session: LoginSession; onRevoke: () => void }) {
  const isApp = /Physiobuddies app/.test(session.deviceLabel);
  const isApi = session.deviceLabel === "API client";
  const Icon = isApp ? Smartphone : isApi ? Globe : Monitor;

  return (
    <View
      className="bg-white border border-border rounded-md p-3.5 flex-row items-center"
      style={{ gap: 12, shadowColor: COLORS.nav, shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}
    >
      <View
        className="w-10 h-10 rounded-[12px] items-center justify-center"
        style={{ backgroundColor: isApp ? "rgba(0,64,96,0.08)" : "rgba(94,107,119,0.1)" }}
      >
        <Icon size={19} color={isApp ? COLORS.accent : COLORS.muted} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text className="text-[13.5px] font-bold text-fg" numberOfLines={1}>
            {session.deviceLabel}
          </Text>
          {session.isCurrent && (
            <Badge variant="success" size="sm">
              This device
            </Badge>
          )}
        </View>
        <Text className="text-muted text-[11.5px] mt-0.5" numberOfLines={1}>
          {[session.lastActiveLabel, session.ip, session.location].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Pressable
        onPress={onRevoke}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Sign out ${session.deviceLabel}`}
        className="px-2.5 py-1.5 rounded-lg active:opacity-70"
        style={{ backgroundColor: "rgba(207,66,56,0.08)" }}
      >
        <Text className="text-danger text-[11.5px] font-bold">Sign out</Text>
      </Pressable>
    </View>
  );
}
