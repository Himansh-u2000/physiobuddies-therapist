import { View, Text, Pressable } from "react-native";
import { CalendarCheck2, CalendarClock, ChevronRight, ClipboardList } from "lucide-react-native";
import { Avatar } from "@/components/ui";
import { COLORS } from "@/constants/config";
import { formatRelativeDay, genderLabel, isMeaningfulCondition } from "@/lib/utils/format";
import type { Patient } from "@/types";

/**
 * A patient in the roster list.
 *
 * Built against what the data actually contains rather than what the type allows. The roster is
 * derived from `GET /therapist/sessions/my-bookings` (there is no therapist-facing patients
 * endpoint — BACKEND_TODO §4.2), so it can honestly fill: name, age, gender (when recorded), a
 * booking count, and the date of the latest booking.
 *
 * ## What changed in this pass, and why
 *
 *   - **"Last seen" was sometimes a future date.** The latest booking can be upcoming, and the card
 *     printed it under "Last seen". It now reads "Next visit" for a future date.
 *   - **The count said "sessions" but counted bookings.** The derivation adds one per treatment
 *     plan, and a plan holds many sessions — a patient on a six-visit course read "1 session".
 *     Labelled as what it is.
 *   - **A recency status in words.** The coloured rail was the only place recency lived at a
 *     glance. "Active" / "Follow up" now sits beside the name, so the rail is reinforcement rather
 *     than the sole carrier — it has to survive greyscale and direct sunlight — and the therapist
 *     can triage the list for who needs a follow-up without reading dates.
 *   - **Unrecorded gender is simply absent,** instead of the derivation's old "male" default.
 */

type Recency = { label: string; color: string; soft: string } | null;

/** Whole days from today to an ISO date — negative is past, positive is upcoming. */
function daysFromToday(iso?: string): number | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((date.getTime() - start) / 86_400_000);
}

/**
 * Where this patient sits in their care.
 *
 * Upcoming or seen within two weeks is mid-course. Two weeks to ~six is the window where a
 * therapist would normally check in, which is the one worth flagging. Beyond that the label is
 * dropped rather than shouting "inactive" at most of a long roster.
 */
function recencyOf(days: number | null): Recency {
  if (days === null) return null;
  // Upcoming (positive) or within the last fortnight.
  if (days >= -14) {
    return { label: "Active", color: COLORS.success, soft: "rgba(35,145,73,0.10)" };
  }
  if (days >= -45) {
    return { label: "Follow up", color: COLORS.warning, soft: "rgba(209,154,18,0.12)" };
  }
  return null;
}

interface PatientCardProps {
  patient: Patient;
  onPress: () => void;
}

export function PatientCard({ patient, onPress }: PatientCardProps) {
  const days = daysFromToday(patient.lastVisit);
  const recency = recencyOf(days);
  const upcoming = days !== null && days > 0;

  // `age: 0` is the derivation's "unknown", not a newborn.
  const meta = [patient.age > 0 ? `${patient.age} yrs` : null, genderLabel(patient.gender) || null]
    .filter(Boolean)
    .join(" · ");

  const bookings = patient.totalSessions;
  const bookingsLabel = bookings === 1 ? "booking" : "bookings";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        patient.name,
        meta,
        recency?.label,
        `${bookings} ${bookingsLabel}`,
      ]
        .filter(Boolean)
        .join(", ")}
      className="bg-white border border-border rounded-[18px] mb-3 active:opacity-90 overflow-hidden flex-row"
      style={{ shadowColor: COLORS.nav, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 }}
    >
      <View style={{ width: 4, backgroundColor: recency?.color ?? COLORS.border }} />

      <View className="flex-1 p-3.5" style={{ gap: 12 }}>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Avatar name={patient.name} url={patient.avatarUrl} size={48} radius={14} />

          <View className="flex-1" style={{ gap: 3 }}>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Text className="text-[15.5px] font-extrabold text-fg flex-shrink" numberOfLines={1}>
                {patient.name}
              </Text>
              {recency && (
                <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: recency.soft }}>
                  <Text className="text-[10px] font-extrabold" style={{ color: recency.color }}>
                    {recency.label}
                  </Text>
                </View>
              )}
            </View>
            {!!meta && <Text className="text-muted text-[12px]">{meta}</Text>}
            {isMeaningfulCondition(patient.condition) && (
              <Text className="text-accent text-[12px] font-bold" numberOfLines={1}>
                {patient.condition}
              </Text>
            )}
          </View>

          <ChevronRight size={18} color={COLORS.muted} />
        </View>

        <View className="flex-row rounded-[12px] overflow-hidden" style={{ backgroundColor: "rgba(0,64,96,0.04)" }}>
          <Stat
            icon={<ClipboardList size={13} color={COLORS.accent} />}
            label="Bookings"
            value={String(bookings)}
            emphasis
          />
          <View className="w-px my-2" style={{ backgroundColor: COLORS.border }} />
          <Stat
            icon={
              upcoming ? (
                <CalendarCheck2 size={13} color={COLORS.success} />
              ) : (
                <CalendarClock size={13} color={COLORS.accent} />
              )
            }
            label={upcoming ? "Next visit" : "Last seen"}
            value={patient.lastVisit ? formatRelativeDay(patient.lastVisit) : "No visits yet"}
          />
        </View>

        {patient.tags.length > 0 && (
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {patient.tags.map((tag) => (
              <View
                key={tag}
                className="min-h-[24px] rounded-full bg-primary-soft border border-accent/10 px-2.5 items-center justify-center"
              >
                <Text className="text-[10px] leading-[12px] font-bold text-accent">{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

function Stat({
  icon,
  label,
  value,
  emphasis,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View className={`${emphasis ? "" : "flex-1"} px-3 py-2`} style={emphasis ? { minWidth: 96 } : undefined}>
      <View className="flex-row items-center" style={{ gap: 5 }}>
        {icon}
        <Text className="text-[10px] font-bold text-muted uppercase" style={{ letterSpacing: 0.4 }}>
          {label}
        </Text>
      </View>
      <Text
        className={`${emphasis ? "text-[17px] font-black" : "text-[13px] font-bold"} text-fg mt-0.5`}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
