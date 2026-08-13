import { useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Calendar, TriangleAlert } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { Chip, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { appointmentApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useSyncedQuery } from "@/lib/hooks/useSyncedQuery";
import { getCachedAppointments, cacheAppointments } from "@/lib/db/repositories";
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

/** A date heading, or one appointment. FlashList renders both from one flat array. */
type Row = { kind: "header"; id: string; label: string; count: number } | { kind: "item"; id: string; appointment: Appointment };

/**
 * Group appointments under date headings, newest-relevant first.
 *
 * The list was previously flat and undated, which was survivable only while every row was
 * assumed to be "today" — now that the backend returns a real course of treatment spanning
 * weeks, an ungrouped list gives no sense of when anything is. Within a day, rows are ordered
 * by clock time.
 */
function buildRows(appointments: Appointment[]): Row[] {
  const groups = new Map<string, { label: string; items: Appointment[] }>();

  for (const a of appointments) {
    const key = a.date ?? "undated";
    const group = groups.get(key) ?? { label: a.dateLabel ?? "Scheduled", items: [] };
    group.items.push(a);
    groups.set(key, group);
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => {
    // Undated rows (a booking whose date the backend couldn't format) sink to the bottom
    // rather than sorting unpredictably among real dates.
    if (a === "undated") return 1;
    if (b === "undated") return -1;
    return a.localeCompare(b);
  });

  const rows: Row[] = [];
  for (const key of sortedKeys) {
    const group = groups.get(key);
    if (!group) continue;
    group.items.sort((x, y) => minutesOfDay(x) - minutesOfDay(y));
    rows.push({ kind: "header", id: `h-${key}`, label: group.label, count: group.items.length });
    for (const appointment of group.items) {
      rows.push({ kind: "item", id: appointment.id, appointment });
    }
  }
  return rows;
}

/** "06:00" + "PM" → minutes past midnight, so 12-hour times sort correctly. */
function minutesOfDay(a: Appointment): number {
  const [h, m] = (a.timeLabel ?? "00:00").split(":").map((n) => parseInt(n, 10) || 0);
  const hour12 = h % 12;
  return (a.meridiem === "PM" ? hour12 + 12 : hour12) * 60 + m;
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const therapist = useAuthStore((s) => s.therapist);
  const [filter, setFilter] = useState<FilterId | null>(null);

  const { data: appointments, isLoading, isError, refetch } = useSyncedQuery({
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
   * "Upcoming" by default, but fall back to "All" when there is nothing upcoming and there IS
   * history. The screen previously hard-defaulted to Upcoming, so a therapist whose bookings
   * were all in the past — which is exactly the state of the dev/seed data — opened it to
   * "No upcoming appointments" and reasonably concluded the screen was broken, while twelve
   * real visits sat one unnoticed chip away. `filter` stays `null` until they choose, so this
   * is a default rather than an override that would fight their selection.
   */
  const activeFilter: FilterId =
    filter ?? (counts.upcoming === 0 && counts.all > 0 ? "all" : "upcoming");

  const rows = useMemo(() => {
    const active = FILTERS.find((f) => f.id === activeFilter) ?? FILTERS[0];
    return buildRows((appointments ?? []).filter((a) => active.match(a.status)));
  }, [appointments, activeFilter]);

  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} title="Appointments" subtitle="Your schedule" showNotification={false} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-grow-0"
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <Chip key={f.id} selectable selected={activeFilter === f.id} onPress={() => setFilter(f.id)}>
            {`${f.label}${counts[f.id] ? ` · ${counts[f.id]}` : ""}`}
          </Chip>
        ))}
      </ScrollView>

      <FlashList
        data={rows}
        renderItem={({ item }) =>
          item.kind === "header" ? (
            <View className="flex-row items-center pt-2 pb-2.5" style={{ gap: 8 }}>
              <Text className="text-[12px] font-extrabold text-fg uppercase" style={{ letterSpacing: 0.8 }}>
                {item.label}
              </Text>
              <View className="h-px flex-1 bg-border" />
              <Text className="text-muted text-[11px] font-bold">
                {item.count} {item.count === 1 ? "visit" : "visits"}
              </Text>
            </View>
          ) : (
            <View className="mb-3">
              <AppointmentCard
                appointment={item.appointment}
                onPress={() => router.push(`/session/appointment/${item.appointment.id}`)}
              />
            </View>
          )
        }
        keyExtractor={(item) => item.id}
        // Date headings and appointment cards have very different heights; without this
        // FlashList recycles one as the other and mis-measures the list.
        getItemType={(item) => item.kind}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 96 }}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={130} radius={18} />
              <Skeleton height={130} radius={18} />
              <Skeleton height={130} radius={18} />
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
            // The copy names how many visits exist under the *other* filters, so an empty
            // view can never be mistaken for a failed fetch — the previous wording said
            // "you don't have any sessions scheduled" even when the account had a dozen.
            <EmptyState
              icon={Calendar}
              title={
                activeFilter === "completed" ? "Nothing completed yet" : "No upcoming appointments"
              }
              description={
                counts.all > 0
                  ? `Nothing matches this filter right now. You have ${counts.all} ${
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
