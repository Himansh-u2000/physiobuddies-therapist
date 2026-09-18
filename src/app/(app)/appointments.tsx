import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Calendar, TriangleAlert } from "lucide-react-native";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { AppHeader } from "@/components/shared/AppHeader";
import { Skeleton, EmptyState, ErrorState, FLOATING_TAB_BAR_INSET } from "@/components/ui";
import { appointmentApi } from "@/lib/api/services";
import { useSessionStore } from "@/lib/stores/session.store";
import { useSyncedQuery } from "@/lib/hooks/useSyncedQuery";
import { getCachedAppointments, cacheAppointments } from "@/lib/db/repositories";
import { COLORS } from "@/constants/config";
import type { Appointment, AppointmentStatus } from "@/types";

type FilterId = "upcoming" | "completed" | "all";

const FILTERS: { id: FilterId; label: string; match: (s: AppointmentStatus) => boolean }[] = [
  {
    id: "upcoming",
    label: "Upcoming",
    match: (s) => s === "confirmed" || s === "in_progress" || s === "pending",
  },
  { id: "completed", label: "Completed", match: (s) => s === "completed" },
  { id: "all", label: "All", match: () => true },
];

/** "06:00" + "PM" → minutes past midnight, so 12-hour times sort correctly. */
function minutesOfDay(a: Appointment): number {
  const [h, m] = (a.timeLabel ?? "00:00").split(":").map((n) => parseInt(n, 10) || 0);
  return ((h % 12) + (a.meridiem === "PM" ? 12 : 0)) * 60 + m;
}

/**
 * Chronological key. Undated rows (a booking whose date the backend couldn't format) sort last
 * either way rather than landing unpredictably among real dates.
 */
function sortKey(a: Appointment): string {
  return a.date ? `${a.date}-${String(minutesOfDay(a)).padStart(4, "0")}` : "";
}

/**
 * Upcoming reads soonest-first — the next visit is the one that matters. Completed reads
 * newest-first, because the visit you just finished is the one you're looking for.
 */
function sortFor(filter: FilterId, list: Appointment[]): Appointment[] {
  const newestFirst = filter === "completed";
  return [...list].sort((x, y) => {
    const a = sortKey(x);
    const b = sortKey(y);
    if (!a) return 1;
    if (!b) return -1;
    return newestFirst ? b.localeCompare(a) : a.localeCompare(b);
  });
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const activeSessionAppointmentId = useSessionStore((s) => (s.isActive ? s.appointmentId : null));
  const [filter, setFilter] = useState<FilterId | null>(null);

  const { data: appointments, isLoading, isError, isFetching, refetch } = useSyncedQuery({
    queryKey: ["appointments"],
    queryFn: appointmentApi.list,
    readCache: getCachedAppointments,
    writeCache: cacheAppointments,
  });

  const counts = useMemo(() => {
    const list = appointments ?? [];
    return FILTERS.reduce<Record<FilterId, number>>(
      (acc, f) => {
        acc[f.id] = list.filter((a) => f.match(a.status)).length;
        return acc;
      },
      { upcoming: 0, completed: 0, all: 0 },
    );
  }, [appointments]);

  /**
   * "Upcoming" by default, but "All" when nothing is upcoming and there IS history — otherwise a
   * therapist whose bookings are all in the past opens the screen to an empty state and assumes
   * it is broken. `filter` stays `null` until they choose, so this never fights their selection.
   */
  const activeFilter: FilterId =
    filter ?? (counts.upcoming === 0 && counts.all > 0 ? "all" : "upcoming");

  const rows = useMemo(() => {
    const active = FILTERS.find((f) => f.id === activeFilter) ?? FILTERS[0];
    return sortFor(activeFilter, (appointments ?? []).filter((a) => active.match(a.status)));
  }, [appointments, activeFilter]);

  /**
   * "Start visit" jumps straight into the flow. A home visit starts at navigation; a clinic or
   * online visit has nowhere to drive to, so it goes directly to OTP verification. A session
   * already running for this booking resumes rather than asking for a second code.
   */
  const startVisit = useCallback(
    (a: Appointment) => {
      if (activeSessionAppointmentId === a.id) {
        router.push("/session/active");
      } else if (a.type === "home") {
        router.push(`/session/route?appointmentId=${a.id}`);
      } else {
        router.push(`/session/otp?appointmentId=${a.id}`);
      }
    },
    [router, activeSessionAppointmentId],
  );

  return (
    // White page, light-blue cards — see AppointmentCard's "Surfaces" note.
    <View className="flex-1 bg-white">
      <AppHeader title="Appointments" subtitle="Your schedule">
        {/* Segmented tabs */}
        <View
          className="flex-row mt-4 p-1 rounded-[16px]"
          style={{ gap: 6, backgroundColor: "rgba(255,255,255,0.12)" }}
          accessibilityRole="tablist"
        >
          {FILTERS.map((f) => {
            const selected = activeFilter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                className="flex-1 py-2 px-2 rounded-[12px] flex-row items-center justify-center active:opacity-80"
                style={{
                  gap: 6,
                  // Selected inverts to white-on-navy, which on a dark track is the strongest
                  // available contrast and needs no shadow to separate it.
                  backgroundColor: selected ? "#ffffff" : "transparent",
                }}
              >
                <Text
                  className={`text-[12px] ${selected ? "font-bold" : "font-semibold text-white/75"}`}
                  style={selected ? { color: COLORS.nav } : undefined}
                >
                  {f.label}
                </Text>
                <View
                  className="rounded-full px-1.5"
                  style={{ backgroundColor: selected ? "rgba(0,53,84,0.1)" : "rgba(255,255,255,0.18)" }}
                >
                  <Text
                    className={`text-[10px] font-bold ${selected ? "" : "text-white"}`}
                    style={selected ? { color: COLORS.nav } : undefined}
                  >
                    {counts[f.id]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </AppHeader>

      <FlashList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="mb-4">
            <AppointmentCard
              appointment={item}
              onPress={() => router.push(`/session/appointment/${item.id}`)}
              onStartVisit={() => startVisit(item)}
              resumable={activeSessionAppointmentId === item.id}
            />
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 + FLOATING_TAB_BAR_INSET }}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={COLORS.accent} />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 16 }}>
              <Skeleton height={236} radius={24} />
              <Skeleton height={236} radius={24} />
              <Skeleton height={236} radius={24} />
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
            // The copy names how many visits exist under the other tabs, so an empty view can
            // never be mistaken for a failed fetch.
            <EmptyState
              icon={Calendar}
              title={activeFilter === "completed" ? "Nothing completed yet" : "No upcoming appointments"}
              description={
                counts.all > 0
                  ? `Nothing matches this tab right now. You have ${counts.all} ${
                      counts.all === 1 ? "visit" : "visits"
                    } in total — tap “All” to see them.`
                  : "You don't have any sessions yet. Add your availability so patients can book a clinic, home, or online slot."
              }
              action={
                counts.all > 0 && activeFilter !== "all"
                  ? { label: "Show all visits", onPress: () => setFilter("all") }
                  : undefined
              }
            />
          )
        }
      />
    </View>
  );
}
