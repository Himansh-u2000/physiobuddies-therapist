import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CalendarX2, Check, Moon, Sun, Sunrise, TriangleAlert } from "lucide-react-native";
import { BottomSheet, Button, Input, Skeleton } from "@/components/ui";
import { appointmentApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS, SLOT_CONFIG } from "@/constants/config";
import { formatDateLabel } from "@/lib/utils/format";
import {
  isBookableSlot,
  RESCHEDULE_REASON_MAX,
  slotDuration,
  slotRangeLabel,
} from "@/lib/utils/reschedule";
import type { AvailabilitySlot } from "@/types";

interface RescheduleSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The treatment SESSION id — `appointment.currentSessionId`, not the plan id. */
  sessionId: string;
  /** The plan id the detail screen is keyed by, for cache invalidation. */
  appointmentId: string;
  patientName: string;
}

const SHIFT_ICON = { morning: Sunrise, evening: Sun, night: Moon } as const;

type Pick = { isoDate: string; startMinute: number; durationMinutes: number };

/**
 * Move a visit to another open slot.
 *
 * Shows only what the server will accept: open slots in the days it offers (the next three — a
 * server limit, stated in the copy so an empty week isn't read as a bug). Booked, held, blocked and
 * too-soon slots are omitted rather than drawn disabled: the therapist is choosing *where to go*,
 * and a grid of greyed-out hours makes the few real options harder to find. The current slot is
 * called out at the top so the move is always "from → to".
 *
 * The server re-checks the slot on submit, so a slot taken in the meantime fails with its own
 * message; the list is refetched so the stale choice disappears.
 */
export function RescheduleSheet({ visible, onClose, sessionId, appointmentId, patientName }: RescheduleSheetProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useAppStore((s) => s.showToast);

  const [dayIndex, setDayIndex] = useState(0);
  const [picked, setPicked] = useState<Pick | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["reschedule-options", sessionId],
    queryFn: () => appointmentApi.getRescheduleOptions(sessionId),
    enabled: visible && !!sessionId,
    // Slot availability changes minute to minute — never reuse a list from an earlier opening.
    staleTime: 0,
    gcTime: 0,
  });

  const days = useMemo(
    () =>
      (data?.days ?? []).map((d) => ({
        ...d,
        open: d.slots.filter(isBookableSlot).sort((a, b) => a.startTime - b.startTime),
      })),
    [data],
  );
  const totalOpen = days.reduce((n, d) => n + d.open.length, 0);
  const day = days[dayIndex];

  const groups = useMemo(() => {
    const slots = day?.open ?? [];
    return SLOT_CONFIG.shifts
      .map((shift) => ({
        ...shift,
        slots: slots.filter((s) => s.startHour >= shift.from && s.startHour <= shift.to),
      }))
      .filter((g) => g.slots.length > 0);
  }, [day]);

  const close = () => {
    if (saving) return;
    setPicked(null);
    setReason("");
    setDayIndex(0);
    onClose();
  };

  const selectSlot = (slot: AvailabilitySlot) => {
    if (!day) return;
    setPicked({ isoDate: day.date, startMinute: slot.startTime, durationMinutes: slotDuration(slot) });
  };

  const confirm = async () => {
    if (!picked || saving) return;
    setSaving(true);
    try {
      await appointmentApi.rescheduleSession(sessionId, { ...picked, reason });
      showToast(
        `Moved to ${formatDateLabel(picked.isoDate)}, ${slotRangeLabel(picked.startMinute, picked.durationMinutes)}. ${patientName} will be notified.`,
        "success",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] }),
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["availability"] }),
      ]);
      setSaving(false);
      close();
    } catch (e) {
      setSaving(false);
      // The server's own reason is the useful one ("slot already held", "too close to start").
      showToast(e instanceof Error && e.message ? e.message : "Couldn't reschedule. Try another slot.", "error");
      setPicked(null);
      refetch();
    }
  };

  const current =
    data && data.currentStartMinute != null
      ? `${formatDateLabel(data.currentDate)}, ${slotRangeLabel(
          data.currentStartMinute,
          data.currentDurationMinutes ?? SLOT_CONFIG.durationMin,
        )}`
      : null;

  return (
    <BottomSheet visible={visible} onClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ gap: 4 }}>
          <Text className="text-[17px] font-extrabold text-fg">Reschedule visit</Text>
          <Text className="text-muted text-[12.5px]">
            Pick a new slot for {patientName}. They&apos;ll be notified; payment is unaffected.
          </Text>
        </View>

        {current && (
          <View
            className="flex-row items-center rounded-[12px] px-3 py-2.5 mt-3"
            style={{ gap: 8, backgroundColor: COLORS.card }}
          >
            <CalendarClock size={15} color={COLORS.muted} />
            <Text className="text-muted text-[12px]">Currently</Text>
            <Text className="text-fg text-[12.5px] font-bold flex-1" numberOfLines={1}>
              {current}
            </Text>
          </View>
        )}

        <ScrollView
          style={{ maxHeight: 360 }}
          contentContainerStyle={{ paddingTop: 12, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={44} radius={12} />
              <Skeleton height={120} radius={12} />
            </View>
          ) : isError ? (
            <View className="items-center py-4" style={{ gap: 8 }}>
              <TriangleAlert size={22} color={COLORS.warning} />
              <Text className="text-fg text-[13px] font-bold text-center">Couldn&apos;t load open slots</Text>
              <Button variant="secondary" fullWidth={false} onPress={() => refetch()}>
                <Text className="text-accent font-bold text-[13px]">Try again</Text>
              </Button>
            </View>
          ) : totalOpen === 0 ? (
            <View className="items-center py-4" style={{ gap: 8 }}>
              <CalendarX2 size={24} color={COLORS.muted} />
              <Text className="text-fg text-[13.5px] font-bold text-center">
                No open slots in the next 3 days
              </Text>
              <Text className="text-muted text-[12px] text-center" style={{ maxWidth: 280 }}>
                Visits can only be moved within the next three days. Open more hours in your
                availability, then try again.
              </Text>
              <Button
                variant="secondary"
                fullWidth={false}
                onPress={() => {
                  close();
                  router.push("/availability");
                }}
              >
                <Text className="text-accent font-bold text-[13px]">Open availability</Text>
              </Button>
            </View>
          ) : (
            <>
              {/* Days */}
              <View className="flex-row" style={{ gap: 8 }}>
                {days.map((d, i) => {
                  const active = i === dayIndex;
                  return (
                    <Pressable
                      key={d.date}
                      onPress={() => setDayIndex(i)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      className="flex-1 rounded-[12px] border py-2 items-center"
                      style={{
                        backgroundColor: active ? COLORS.accent : "#fff",
                        borderColor: active ? COLORS.accent : COLORS.border,
                      }}
                    >
                      <Text className={`text-[12.5px] font-extrabold ${active ? "text-white" : "text-fg"}`}>
                        {d.label}
                      </Text>
                      <Text className={`text-[10.5px] font-semibold mt-0.5 ${active ? "text-white/80" : "text-muted"}`}>
                        {d.open.length === 0 ? "Full" : `${d.open.length} open`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {groups.length === 0 ? (
                <Text className="text-muted text-[12.5px] text-center py-3">
                  Nothing open on this day — try another.
                </Text>
              ) : (
                groups.map((g) => {
                  const Icon = SHIFT_ICON[g.id as keyof typeof SHIFT_ICON] ?? Sun;
                  return (
                    <View key={g.id} style={{ gap: 8 }}>
                      <View className="flex-row items-center" style={{ gap: 6 }}>
                        <Icon size={14} color={COLORS.accent} />
                        <Text className="text-[12.5px] font-bold text-fg">{g.label}</Text>
                      </View>
                      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {g.slots.map((slot) => {
                          const selected =
                            picked?.isoDate === day?.date && picked?.startMinute === slot.startTime;
                          return (
                            <Pressable
                              key={slot.startTime}
                              onPress={() => selectSlot(slot)}
                              accessibilityRole="radio"
                              accessibilityState={{ checked: selected }}
                              className="rounded-[12px] border px-3 py-2 flex-row items-center active:opacity-80"
                              style={{
                                gap: 5,
                                backgroundColor: selected ? COLORS.accent : "#fff",
                                borderColor: selected ? COLORS.accent : COLORS.border,
                              }}
                            >
                              {selected && <Check size={12} color="#fff" strokeWidth={3} />}
                              <Text
                                className="text-[12.5px] font-bold"
                                style={{ color: selected ? "#fff" : COLORS.fg }}
                              >
                                {slotRangeLabel(slot.startTime, slotDuration(slot))}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
              )}

              <Input
                label="Reason (optional)"
                value={reason}
                onChangeText={setReason}
                maxLength={RESCHEDULE_REASON_MAX}
                placeholder="e.g. Running late from a previous visit"
              />
            </>
          )}
        </ScrollView>

        <View className="flex-row mt-3" style={{ gap: 8 }}>
          <View className="flex-1">
            <Button variant="secondary" onPress={close} disabled={saving}>
              Cancel
            </Button>
          </View>
          <View className="flex-[2]">
            <Button onPress={confirm} disabled={!picked || saving || isRefetching}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-[14px]">
                  {picked ? "Confirm new time" : "Pick a slot"}
                </Text>
              )}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}
