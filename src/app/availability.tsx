import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarOff,
  CalendarRange,
  ChevronLeft,
  TriangleAlert,
  Check,
  Ban,
  Sunrise,
  Sun,
  Moon,
} from "lucide-react-native";
import { Badge, Button, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { availabilityApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS, SLOT_CONFIG, WEEKDAYS, type SlotShiftId } from "@/constants/config";
import type { AvailabilityDay, AvailabilitySlot, SlotShift, WeeklySchedule } from "@/types";
import { GlassSurface } from "@/components/ui/Glass";

/** "14" → "2 PM". The grid is hourly, so minutes never need showing. */
function hourLabel(hour: number): string {
  const meridiem = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${meridiem}`;
}

/** "6" → "6:00 – 6:40", the actual bookable window. */
function slotRangeLabel(hour: number): string {
  const meridiem = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 – ${h}:${SLOT_CONFIG.durationMin} ${meridiem}`;
}

const SHIFT_ICON: Record<SlotShiftId, typeof Sunrise> = {
  morning: Sunrise,
  evening: Sun,
  night: Moon,
};

type Tab = "days" | "weekly";

/**
 * Availability management.
 *
 * Two things it can now do that it couldn't before, both because the backend grew the
 * endpoints: edit the **recurring weekly defaults** (GET/PUT /therapist/slots/schedule), which
 * previously could only be set once during onboarding; and see which upcoming days deviate from
 * those defaults (GET /therapist/slots/overrides).
 *
 * The day grid itself was a flat wrap of 16 identical buttons with no sense of morning vs
 * evening, no way to act on a whole block, and a legend the therapist had to infer from colour.
 * It's now grouped by shift with a per-shift select-all, an explicit legend, and a count summary
 * so "am I actually open tomorrow?" is answerable at a glance.
 *
 * Booked slots stay non-selectable: blocking an hour a patient has already booked would strand
 * that appointment, and there is no cancel-and-notify path that would make it safe.
 */
export default function AvailabilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("days");
  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["availability"],
    queryFn: availabilityApi.getAvailability,
  });

  const days = data ?? [];
  const day: AvailabilityDay | undefined = days[dayIndex];

  // Selecting hours only makes sense within one day; switching days must not carry them over.
  const selectDay = (index: number) => {
    setDayIndex(index);
    setSelected([]);
  };

  const toggleHour = (hour: number) => {
    setSelected((prev) => (prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour]));
  };

  /** Slots grouped into the backend's three shift buckets, in clock order. */
  const shiftGroups = useMemo(() => {
    const slots = day?.slots ?? [];
    return SLOT_CONFIG.shifts
      .map((shift) => ({
        ...shift,
        slots: slots
          .filter((s) => s.startHour >= shift.from && s.startHour <= shift.to)
          .sort((a, b) => a.startHour - b.startHour),
      }))
      .filter((g) => g.slots.length > 0);
  }, [day]);

  const counts = useMemo(() => {
    const slots = day?.slots ?? [];
    return {
      open: slots.filter((s) => s.status === "open").length,
      booked: slots.filter((s) => s.status === "booked").length,
      blocked: slots.filter((s) => s.status === "blocked").length,
    };
  }, [day]);

  const selectionState = useMemo(() => {
    if (!day || selected.length === 0) return { allBlocked: false };
    const picked = day.slots.filter((s) => selected.includes(s.startHour));
    return { allBlocked: picked.length > 0 && picked.every((s) => s.status === "blocked") };
  }, [day, selected]);

  /** Select or clear every changeable slot in a shift — booked hours are never included. */
  const toggleShift = (slots: AvailabilitySlot[]) => {
    const selectable = slots.filter((s) => s.status !== "booked").map((s) => s.startHour);
    const allPicked = selectable.length > 0 && selectable.every((h) => selected.includes(h));
    setSelected((prev) =>
      allPicked
        ? prev.filter((h) => !selectable.includes(h))
        : [...new Set([...prev, ...selectable])],
    );
  };

  const applyBlock = async (blocked: boolean) => {
    if (!day || selected.length === 0 || saving) return;
    setSaving(true);
    try {
      await availabilityApi.setSlotsBlocked(day.date, selected, blocked);
      showToast(
        blocked
          ? `${selected.length} slot${selected.length > 1 ? "s" : ""} blocked`
          : `${selected.length} slot${selected.length > 1 ? "s" : ""} reopened`,
        "success",
      );
      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: ["availability"] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't update those slots. Try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <GlassSurface
        fallbackClassName="bg-white"
        className="px-4 pb-2 border-b border-border"
        style={{ paddingTop: insets.top + 10 }}
      >
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8} className="w-8 h-8 items-center justify-center">
            <ChevronLeft size={22} color={COLORS.fg} />
          </Pressable>
          <Text className="text-[16px] font-extrabold text-fg flex-1">Availability</Text>
          {/* Leave is its own screen now, not a sheet hanging off whichever day happened to be
              selected — it applies to a date RANGE, and it lists the time off already booked. */}
          <Pressable
            onPress={() => router.push("/leave")}
            hitSlop={8}
            className="flex-row items-center active:opacity-70"
            style={{ gap: 5 }}
          >
            <CalendarOff size={16} color={COLORS.danger} />
            <Text className="text-danger text-[12px] font-bold">Time off</Text>
          </Pressable>
        </View>

        <View className="flex-row mt-2.5 rounded-[12px] p-[3px]" style={{ backgroundColor: "rgba(0,64,96,0.05)" }}>
          <TabButton label="By day" active={tab === "days"} onPress={() => setTab("days")} />
          <TabButton label="Weekly defaults" active={tab === "weekly"} onPress={() => setTab("weekly")} />
        </View>
      </GlassSurface>

      {tab === "weekly" ? (
        <WeeklyDefaults />
      ) : isLoading ? (
        <View className="px-3.5 pt-3" style={{ gap: 10 }}>
          <Skeleton height={56} radius={12} />
          <Skeleton height={70} radius={12} />
          <Skeleton height={220} radius={12} />
        </View>
      ) : isError ? (
        <View className="px-3.5 pt-3">
          <ErrorState
            icon={TriangleAlert}
            title="Couldn't load availability"
            badge="Error"
            description="We couldn't reach the server. Your schedule is unchanged — this is usually temporary."
            action={{ label: "Try again", onPress: () => refetch() }}
          />
        </View>
      ) : days.length === 0 ? (
        <View className="px-3.5 pt-3">
          <EmptyState
            icon={CalendarRange}
            title="No schedule published"
            description="Your bookable hours haven't been set up yet. Set your weekly defaults first, then block individual slots here."
          />
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-grow-0 border-b border-border bg-white"
            contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}
          >
            {days.map((d, i) => {
              const active = i === dayIndex;
              const blocked = d.slots.filter((s) => s.status === "blocked").length;
              const booked = d.slots.filter((s) => s.status === "booked").length;
              const fullyOff = d.slots.length > 0 && blocked === d.slots.length;
              // Day pills now carry their own state — the previous strip was 14 identical
              // labels, so finding the day you'd already blocked meant opening each one.
              return (
                <Pressable
                  key={d.rawDate}
                  onPress={() => selectDay(i)}
                  className={`px-3 py-1.5 rounded-[12px] items-center border ${
                    active ? "bg-accent border-accent" : "bg-white border-border"
                  }`}
                  style={{ minWidth: 62 }}
                >
                  <Text className={`text-[12px] font-extrabold ${active ? "text-white" : "text-fg"}`}>
                    {d.label}
                  </Text>
                  <View className="flex-row items-center mt-1" style={{ gap: 3 }}>
                    {fullyOff ? (
                      <Text className={`text-[9.5px] font-bold ${active ? "text-white/75" : "text-danger"}`}>
                        Off
                      </Text>
                    ) : (
                      <>
                        {booked > 0 && (
                          <View
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: active ? "#fff" : COLORS.success }}
                          />
                        )}
                        {blocked > 0 && (
                          <View
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: active ? "rgba(255,255,255,0.6)" : COLORS.danger }}
                          />
                        )}
                        <Text className={`text-[9.5px] font-bold ${active ? "text-white/75" : "text-muted"}`}>
                          {d.slots.length - blocked - booked} open
                        </Text>
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: insets.bottom + 150 }}
          >
            <View className="flex-row" style={{ gap: 8 }}>
              <SummaryTile label="Open" value={counts.open} color={COLORS.accent} />
              <SummaryTile label="Booked" value={counts.booked} color={COLORS.success} />
              <SummaryTile label="Blocked" value={counts.blocked} color={COLORS.danger} />
            </View>

            <View className="flex-row items-center flex-wrap mt-3" style={{ gap: 10 }}>
              <LegendDot color={COLORS.border} label="Open" outline />
              <LegendDot color={COLORS.success} label="Booked" />
              <LegendDot color={COLORS.danger} label="Blocked" />
              <LegendDot color={COLORS.accent} label="Selected" />
            </View>

            {shiftGroups.map((group) => {
              const Icon = SHIFT_ICON[group.id];
              const selectable = group.slots.filter((s) => s.status !== "booked");
              const allPicked =
                selectable.length > 0 && selectable.every((s) => selected.includes(s.startHour));
              return (
                <View key={group.id} className="mt-4">
                  <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
                    <Icon size={15} color={COLORS.accent} />
                    <Text className="text-[13px] font-extrabold text-fg">{group.label}</Text>
                    <Text className="text-muted text-[11px]">
                      {hourLabel(group.from)} – {hourLabel(group.to)}
                    </Text>
                    <View className="flex-1" />
                    {selectable.length > 0 && (
                      <Pressable onPress={() => toggleShift(group.slots)} hitSlop={6} className="active:opacity-70">
                        <Text className="text-accent text-[11.5px] font-bold">
                          {allPicked ? "Clear" : "Select all"}
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {group.slots.map((slot) => (
                      <SlotButton
                        key={slot.startHour}
                        slot={slot}
                        picked={selected.includes(slot.startHour)}
                        onPress={() => toggleHour(slot.startHour)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {selected.length > 0 && (
            <GlassSurface
              fallbackClassName="bg-white"
              className="absolute left-0 right-0 bottom-0 border-t border-border px-3.5 pt-3"
              style={{ paddingBottom: insets.bottom + 12, gap: 10 }}
            >
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Badge variant="accent" tone="solid" size="sm" dot={false}>
                  {`${selected.length} selected`}
                </Badge>
                <Text className="text-muted text-[11.5px] flex-1" numberOfLines={1}>
                  {selected
                    .slice()
                    .sort((a, b) => a - b)
                    .map(hourLabel)
                    .join(", ")}
                </Text>
              </View>
              <View className="flex-row" style={{ gap: 8 }}>
                <View className="flex-1">
                  <Button variant="secondary" fullWidth onPress={() => setSelected([])} disabled={saving}>
                    Clear
                  </Button>
                </View>
                <View className="flex-[2]">
                  <Button
                    variant={selectionState.allBlocked ? "success" : "primary"}
                    fullWidth
                    onPress={() => applyBlock(!selectionState.allBlocked)}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        {selectionState.allBlocked ? (
                          <Check size={15} color="#fff" />
                        ) : (
                          <Ban size={15} color="#fff" />
                        )}
                        <Text className="text-white font-bold text-[14px]">
                          {selectionState.allBlocked ? "Reopen slots" : "Block slots"}
                        </Text>
                      </>
                    )}
                  </Button>
                </View>
              </View>
            </GlassSurface>
          )}
        </>
      )}

    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 h-[32px] rounded-[10px] items-center justify-center ${active ? "bg-white" : ""}`}
      style={active ? { shadowColor: COLORS.nav, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 } : undefined}
    >
      <Text className={`text-[12.5px] font-bold ${active ? "text-accent" : "text-muted"}`}>{label}</Text>
    </Pressable>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="flex-1 bg-white border border-border rounded-[12px] py-2.5 items-center">
      <Text className="text-[18px] font-black" style={{ color }}>
        {value}
      </Text>
      <Text className="text-muted text-[10.5px] font-bold uppercase" style={{ letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}

function LegendDot({ color, label, outline }: { color: string; label: string; outline?: boolean }) {
  return (
    <View className="flex-row items-center" style={{ gap: 5 }}>
      <View
        className="w-2.5 h-2.5 rounded-[3px]"
        style={{
          backgroundColor: outline ? "transparent" : color,
          borderWidth: outline ? 1.5 : 0,
          borderColor: color,
        }}
      />
      <Text className="text-muted text-[11px] font-semibold">{label}</Text>
    </View>
  );
}

function SlotButton({
  slot,
  picked,
  onPress,
}: {
  slot: AvailabilitySlot;
  picked: boolean;
  onPress: () => void;
}) {
  const booked = slot.status === "booked";
  const blocked = slot.status === "blocked";

  const background = picked ? COLORS.accent : booked ? "rgba(35,145,73,0.1)" : blocked ? "rgba(207,66,56,0.08)" : "#fff";
  const borderColor = picked
    ? COLORS.accent
    : booked
      ? "rgba(35,145,73,0.3)"
      : blocked
        ? "rgba(207,66,56,0.3)"
        : COLORS.border;
  const textColor = picked ? "#fff" : booked ? COLORS.success : blocked ? COLORS.danger : COLORS.fg;

  return (
    <Pressable
      disabled={booked}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: picked, disabled: booked }}
      accessibilityLabel={`${slotRangeLabel(slot.startHour)}, ${slot.status}`}
      className="rounded-[12px] border px-2.5 py-2 items-start active:opacity-80"
      style={{ minWidth: 100, backgroundColor: background, borderColor }}
    >
      <View className="flex-row items-center" style={{ gap: 4 }}>
        {picked && <Check size={11} color="#fff" strokeWidth={3.5} />}
        <Text className="text-[12.5px] font-extrabold" style={{ color: textColor }}>
          {slotRangeLabel(slot.startHour)}
        </Text>
      </View>
      <Text className="text-[10px] font-bold mt-0.5" style={{ color: picked ? "rgba(255,255,255,0.75)" : COLORS.muted }}>
        {booked ? "Booked" : blocked ? "Blocked" : "Open"}
      </Text>
    </Pressable>
  );
}

/**
 * The recurring weekly defaults. Editing these is new — before the
 * GET/PUT /therapist/slots/schedule endpoints existed, a therapist's working shifts were fixed
 * at whatever they picked during final onboarding, with no way to change them in the app.
 *
 * Saves are explicit rather than per-tap: this rewrites the therapist's whole bookable week,
 * so an accidental tap shouldn't take effect silently.
 */
function WeeklyDefaults() {
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<WeeklySchedule | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["weekly-schedule"],
    queryFn: availabilityApi.getWeeklySchedule,
  });

  const schedule = draft ?? data?.schedule ?? {};
  const dirty = draft !== null;
  // The saved week exists but can't be served back (see `getWeeklySchedule`). Nothing to
  // show, yet the editor still has to open — saving over it is the only repair.
  const unreadable = !!data?.unreadable;

  const toggleShift = (dayId: string, shift: SlotShift) => {
    const current = schedule[dayId] ?? { shifts: [], disabledHours: [] };
    const shifts = current.shifts.includes(shift)
      ? current.shifts.filter((s) => s !== shift)
      : [...current.shifts, shift];
    setDraft({ ...schedule, [dayId]: { ...current, shifts } });
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      await availabilityApi.updateWeeklySchedule(draft);
      showToast("Weekly hours updated", "success");
      setDraft(null);
      // The day grid is generated from these defaults server-side, so it's stale now.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["availability"] }),
      ]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't save your weekly hours.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View className="px-3.5 pt-3" style={{ gap: 10 }}>
        <Skeleton height={64} radius={12} />
        <Skeleton height={64} radius={12} />
        <Skeleton height={64} radius={12} />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="px-3.5 pt-3">
        <ErrorState
          icon={TriangleAlert}
          title="Couldn't load your weekly hours"
          badge="Error"
          description="We couldn't reach the server. Your schedule is unchanged."
          action={{ label: "Try again", onPress: () => refetch() }}
        />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 130 }}
      >
        {unreadable ? (
          <View
            className="rounded-md border p-3 mb-3"
            style={{ backgroundColor: "rgba(240,68,56,0.06)", borderColor: COLORS.danger, gap: 4 }}
          >
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <TriangleAlert size={14} color={COLORS.danger} />
              <Text className="text-[12.5px] font-extrabold" style={{ color: COLORS.danger }}>
                We couldn&rsquo;t read your saved hours
              </Text>
            </View>
            <Text className="text-muted text-[11.5px]">
              Your bookable hours are still in force — this screen just can&rsquo;t show them. Set
              every day you work below and save; that replaces the whole week and fixes it.
            </Text>
          </View>
        ) : (
          <Text className="text-muted text-[12px] mb-3">
            Choose the shifts you normally work. Patients can only book inside these hours —
            blocking a one-off day is done on the &ldquo;By day&rdquo; tab.
          </Text>
        )}

        {WEEKDAYS.map((weekday) => {
          const daySchedule = schedule[weekday.id] ?? { shifts: [], disabledHours: [] };
          const off = daySchedule.shifts.length === 0;
          return (
            <GlassSurface
              fallbackClassName="bg-white"
              glassRadius={12}
              key={weekday.id}
              className="border border-border rounded-md p-3 mb-2.5"
              style={{ gap: 10 }}
            >
              <View className="flex-row items-center">
                <Text className="text-[13.5px] font-extrabold text-fg flex-1">{weekday.short}</Text>
                {off ? (
                  <Badge variant="neutral" size="sm">
                    Day off
                  </Badge>
                ) : (
                  <Badge variant="success" size="sm">
                    {`${daySchedule.shifts.length} shift${daySchedule.shifts.length > 1 ? "s" : ""}`}
                  </Badge>
                )}
              </View>
              <View className="flex-row" style={{ gap: 7 }}>
                {SLOT_CONFIG.shifts.map((shift) => {
                  const on = daySchedule.shifts.includes(shift.id);
                  const Icon = SHIFT_ICON[shift.id];
                  return (
                    <Pressable
                      key={shift.id}
                      onPress={() => toggleShift(weekday.id, shift.id)}
                      className="flex-1 rounded-[11px] border py-2 items-center active:opacity-80"
                      style={{
                        backgroundColor: on ? "rgba(0,64,96,0.06)" : "#fff",
                        borderColor: on ? COLORS.accent : COLORS.border,
                      }}
                    >
                      <Icon size={15} color={on ? COLORS.accent : COLORS.muted} />
                      <Text
                        className="text-[11px] font-bold mt-1"
                        style={{ color: on ? COLORS.accent : COLORS.muted }}
                      >
                        {shift.label}
                      </Text>
                      <Text className="text-[9.5px]" style={{ color: on ? COLORS.accent : COLORS.muted }}>
                        {hourLabel(shift.from)}–{hourLabel(shift.to)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassSurface>
          );
        })}
      </ScrollView>

      {dirty && (
        <GlassSurface
          fallbackClassName="bg-white"
          className="absolute left-0 right-0 bottom-0 border-t border-border px-3.5 pt-3 pb-6"
          style={{ gap: 8 }}
        >
          <View className="flex-row" style={{ gap: 8 }}>
            <View className="flex-1">
              <Button variant="secondary" fullWidth onPress={() => setDraft(null)} disabled={saving}>
                Discard
              </Button>
            </View>
            <View className="flex-[2]">
              <Button variant="primary" fullWidth onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : "Save weekly hours"}
              </Button>
            </View>
          </View>
        </GlassSurface>
      )}
    </View>
  );
}
