import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import {
  CalendarOff,
  CalendarX2,
  ChevronLeft,
  Info,
  TriangleAlert,
} from "lucide-react-native";
import { Button, Chip, EmptyState, ErrorState, Skeleton, TextArea } from "@/components/ui";
import { availabilityApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";
import { formatDateLabel, toIsoDate } from "@/lib/utils/format";
import { GlassSurface } from "@/components/ui/Glass";

/**
 * Time off.
 *
 * Was a bottom sheet with a single reason field that always applied leave to exactly one day —
 * the day the availability screen happened to be showing — even though `POST /therapist/leaves`
 * has taken `{ startDate, endDate }` since it was written. A therapist going away for a week had
 * no way to say so; the app sent `startDate === endDate` and threw the rest of the endpoint away.
 *
 * It also gave no sight of leave already applied, and reported the server's most common refusal
 * ("you have active bookings during this period" — the backend rejects the whole range if a
 * single booked slot falls inside it) as a generic "couldn't apply for leave".
 *
 * What the backend supports, and therefore what this screen offers:
 *  - `POST /therapist/leaves` — a real date RANGE, optional reason.
 *  - `GET /therapist/slots/overrides` — upcoming dates that deviate from the weekly default;
 *    the ones flagged `isOff` are days already taken off. Read-only.
 *  - There is **no** cancel/delete-leave route and no list-leaves route (BACKEND_TODO §1.9), so
 *    this screen does not pretend leave can be withdrawn in-app.
 */

type Field = "start" | "end";

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayCount(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T00:00:00`).getTime();
  const b = new Date(`${endIso}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Saturday + Sunday of the current week, or the coming one once the weekend has passed. */
function nextWeekend(): { start: string; end: string } {
  const today = startOfToday();
  const daysUntilSat = (6 - today.getDay() + 7) % 7;
  const sat = addDays(today, daysUntilSat);
  return { start: toIsoDate(sat), end: toIsoDate(addDays(sat, 1)) };
}

export default function LeaveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();

  const today = useMemo(() => startOfToday(), []);
  const [start, setStart] = useState(() => toIsoDate(today));
  const [end, setEnd] = useState(() => toIsoDate(today));
  const [reason, setReason] = useState("");
  const [field, setField] = useState<Field>("start");
  const [saving, setSaving] = useState(false);

  const { data: overrides, isLoading, isError, refetch } = useQuery({
    queryKey: ["schedule-overrides"],
    queryFn: availabilityApi.getOverrides,
  });

  const daysOff = (overrides ?? []).filter((o) => o.isOff);
  const days = dayCount(start, end);
  const invalidRange = days === 0;

  /** Moving the start past the end drags the end with it, rather than leaving an invalid range. */
  const setStartDate = (iso: string) => {
    setStart(iso);
    if (new Date(`${iso}T00:00:00`) > new Date(`${end}T00:00:00`)) setEnd(iso);
  };

  const applyPreset = (startIso: string, endIso: string) => {
    setStart(startIso);
    setEnd(endIso);
  };

  const submit = async () => {
    if (invalidRange || saving) return;
    setSaving(true);
    try {
      await availabilityApi.applyLeave(start, end, reason.trim() || undefined);
      showToast(
        days === 1 ? "Leave applied for 1 day" : `Leave applied for ${days} days`,
        "success",
      );
      setReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["availability"] }),
        queryClient.invalidateQueries({ queryKey: ["schedule-overrides"] }),
      ]);
      router.back();
    } catch (e) {
      // The server's own wording is more useful than anything generic — especially the booked
      // -sessions refusal, which tells the therapist exactly why the range was rejected.
      showToast(
        e instanceof Error && e.message
          ? e.message
          : "Couldn't apply for leave. Please try again.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const activeIso = field === "start" ? start : end;
  const pickerValue = new Date(`${activeIso}T00:00:00`);
  // The end date can never precede the start; the start can never be in the past (the backend
  // rejects a leave period that has already ended).
  const pickerMin = field === "start" ? today : new Date(`${start}T00:00:00`);

  return (
    <View className="flex-1 bg-bg">
      <GlassSurface
        fallbackClassName="bg-white"
        className="px-4 pb-2.5 border-b border-border"
        style={{ paddingTop: insets.top + 10 }}
      >
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="w-8 h-8 items-center justify-center active:opacity-70"
          >
            <ChevronLeft size={22} color={COLORS.fg} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[16px] font-extrabold text-fg">Time off</Text>
            <Text className="text-muted text-[11px]">Block a range of days you can&apos;t work</Text>
          </View>
        </View>
      </GlassSurface>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 28, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          className="bg-white border border-border rounded-lg p-3.5"
          style={{ gap: 12, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 }}
        >
          <Text className="text-[14px] font-extrabold text-fg">When are you away?</Text>

          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <Chip variant="info" onPress={() => applyPreset(toIsoDate(today), toIsoDate(today))}>
              Today
            </Chip>
            <Chip
              variant="info"
              onPress={() => applyPreset(toIsoDate(addDays(today, 1)), toIsoDate(addDays(today, 1)))}
            >
              Tomorrow
            </Chip>
            <Chip
              variant="info"
              onPress={() => {
                const w = nextWeekend();
                applyPreset(w.start, w.end);
              }}
            >
              This weekend
            </Chip>
            <Chip
              variant="info"
              onPress={() => applyPreset(toIsoDate(today), toIsoDate(addDays(today, 6)))}
            >
              Next 7 days
            </Chip>
          </View>

          <View className="flex-row" style={{ gap: 8 }}>
            <DateField
              label="From"
              value={start}
              active={field === "start"}
              onPress={() => setField("start")}
            />
            <DateField
              label="To"
              value={end}
              active={field === "end"}
              onPress={() => setField("end")}
            />
          </View>

          <View className="rounded-[12px] bg-bg border border-border px-3 py-2.5">
            <Text className="text-[12px] font-bold text-fg">
              {invalidRange
                ? "Pick an end date on or after the start date"
                : days === 1
                  ? `1 day off · ${formatDateLabel(start)}`
                  : `${days} days off · ${formatDateLabel(start)} – ${formatDateLabel(end)}`}
            </Text>
            <Text className="text-muted text-[11px] mt-0.5">
              Every slot in this range stops accepting new bookings.
            </Text>
          </View>

          <View>
            <Text className="text-[12px] font-bold text-fg mb-1">
              Choose the {field === "start" ? "start" : "end"} date
            </Text>
            <DateTimePicker
              value={pickerValue}
              mode="date"
              minimumDate={pickerMin}
              presentation="inline"
              onValueChange={(_, date) =>
                field === "start" ? setStartDate(toIsoDate(date)) : setEnd(toIsoDate(date))
              }
            />
          </View>

          <TextArea
            label="Reason (optional)"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Family function, medical leave, travel"
          />

          {/* Stated before submitting rather than discovered as a rejection: the backend refuses
              the ENTIRE range if even one booked session falls inside it. */}
          <View className="flex-row rounded-[12px] bg-warning/5 border border-warning/20 p-3" style={{ gap: 8 }}>
            <TriangleAlert size={15} color={COLORS.warning} />
            <Text className="flex-1 text-muted text-[11.5px] leading-[17px]">
              Leave can only be applied to a range with{" "}
              <Text className="text-fg font-bold">no booked sessions</Text>. If a patient is already
              booked on any of these days, cancel or reschedule that visit first, then apply again.
            </Text>
          </View>

          <Button onPress={submit} disabled={saving || invalidRange}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <CalendarOff size={16} color="#fff" />
                <Text className="text-white font-bold text-[14px]">
                  {invalidRange ? "Pick a valid range" : days === 1 ? "Apply for 1 day" : `Apply for ${days} days`}
                </Text>
              </>
            )}
          </Button>
        </View>

        <View
          className="bg-white border border-border rounded-lg p-3.5"
          style={{ gap: 10, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 }}
        >
          <Text className="text-[14px] font-extrabold text-fg">Upcoming days off</Text>

          {isLoading ? (
            <View style={{ gap: 8 }}>
              <Skeleton height={44} radius={12} />
              <Skeleton height={44} radius={12} />
            </View>
          ) : isError ? (
            <ErrorState
              icon={TriangleAlert}
              title="Couldn't load your schedule"
              badge="Error"
              description="Your existing time off is still in place — this is just the list failing to load."
              action={{ label: "Try again", onPress: () => refetch() }}
            />
          ) : daysOff.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              tone="neutral"
              title="No time off booked"
              description="Days you take off will be listed here so you can see them at a glance."
            />
          ) : (
            <>
              {daysOff.map((o) => (
                <View
                  key={o.date}
                  className="flex-row items-center rounded-[12px] bg-bg border border-border px-3 py-2.5"
                  style={{ gap: 10 }}
                >
                  <CalendarOff size={15} color={COLORS.danger} />
                  <View className="flex-1">
                    <Text className="text-[13px] font-bold text-fg">{o.label}</Text>
                    <Text className="text-muted text-[11px]">{formatDateLabel(o.date)}</Text>
                  </View>
                  <Text className="text-danger text-[11px] font-bold">Off</Text>
                </View>
              ))}
              <View className="flex-row items-start mt-0.5" style={{ gap: 7 }}>
                <Info size={13} color={COLORS.muted} />
                <Text className="flex-1 text-muted text-[11px] leading-[16px]">
                  Leave can&apos;t be withdrawn from the app yet — there is no cancel endpoint for
                  it. To reopen a day you&apos;ve taken off, contact support.
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function DateField({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`flex-1 rounded-[12px] border px-3 py-2.5 active:opacity-80 ${
        active ? "border-accent bg-primary-soft" : "border-border bg-white"
      }`}
    >
      <Text className={`text-[10px] font-bold uppercase ${active ? "text-accent" : "text-muted"}`}>
        {label}
      </Text>
      <Text className="text-[13px] font-bold text-fg mt-0.5" numberOfLines={1}>
        {formatDateLabel(value)}
      </Text>
    </Pressable>
  );
}
