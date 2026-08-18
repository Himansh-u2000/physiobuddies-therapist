import { View, Text, Pressable } from "react-native";
import { CalendarClock, ChevronRight, Repeat2 } from "lucide-react-native";
import { Avatar } from "@/components/ui";
import { COLORS } from "@/constants/config";
import { formatRelativeDay } from "@/lib/utils/format";
import type { Patient } from "@/types";

/**
 * A patient in the roster list.
 *
 * Rebuilt against what the data actually contains rather than what the type allows. The roster
 * is derived from `GET /therapist/sessions/my-bookings` (there is no therapist-facing patients
 * endpoint — BACKEND_TODO §4.2), and that derivation can only fill four fields honestly: name,
 * age/gender, a visit count, and a last-visit date. `condition` comes back as the literal
 * string "Therapy" for every patient, `tags` is always `[]`, and `phone` is always `""`.
 *
 * The previous card gave its largest element — a bordered box captioned "PRIMARY CONDITION" —
 * to that constant "Therapy", rendered an always-empty tag row beneath it, and printed the one
 * genuinely useful field (last visit) as small grey text at the bottom. It also showed the
 * session count twice: once as a badge clipped to the avatar, once as a chip beside the name.
 * So the card was mostly furniture around a placeholder.
 *
 * Now: identity first, then the two real facts as labelled stats, and the placeholder fields
 * render only when they carry something. Recency also drives a left rail — but it is never the
 * only carrier of that information, the same rule `Badge` follows, since the rail has to survive
 * greyscale and direct sunlight.
 */

/** The derivation's stand-in for a condition it doesn't have. Not worth a line of the card. */
const PLACEHOLDER_CONDITION = "therapy";

function isMeaningfulCondition(condition: string): boolean {
  const c = condition.trim().toLowerCase();
  return c.length > 0 && c !== PLACEHOLDER_CONDITION;
}

/** Recent enough that the therapist is mid-course with this patient. */
function railColor(lastVisit?: string): string {
  if (!lastVisit) return COLORS.border;
  const date = new Date(`${lastVisit}T00:00:00`);
  if (Number.isNaN(date.getTime())) return COLORS.border;
  const days = (Date.now() - date.getTime()) / 86_400_000;
  if (days <= 14) return COLORS.success;
  if (days <= 45) return COLORS.warning;
  return COLORS.border;
}

interface PatientCardProps {
  patient: Patient;
  onPress: () => void;
}

export function PatientCard({ patient, onPress }: PatientCardProps) {
  const showCondition = isMeaningfulCondition(patient.condition);
  // `age: 0` is the derivation's "unknown", not a newborn — rendering "0y · male" made every
  // patient whose age the booking payload omits look like bad data.
  const meta = [patient.age > 0 ? `${patient.age}y` : null, patient.gender]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${patient.name}, ${patient.totalSessions} visits`}
      className="bg-white border border-border rounded-lg mb-3 active:opacity-90 overflow-hidden flex-row"
      style={{ shadowColor: COLORS.nav, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 }}
    >
      <View style={{ width: 4, backgroundColor: railColor(patient.lastVisit) }} />

      <View className="flex-1 p-3.5">
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Avatar name={patient.name} url={patient.avatarUrl} size={48} radius={16} />

          <View className="flex-1">
            <Text className="text-[15px] font-extrabold text-fg" numberOfLines={1}>
              {patient.name}
            </Text>
            {!!meta && <Text className="text-muted text-[11px] mt-0.5 capitalize">{meta}</Text>}
            {showCondition && (
              <Text className="text-accent text-[12px] font-bold mt-1" numberOfLines={1}>
                {patient.condition}
              </Text>
            )}
          </View>

          <ChevronRight size={18} color={COLORS.muted} />
        </View>

        <View className="flex-row mt-3 rounded-[12px] bg-bg border border-border overflow-hidden">
          <Stat
            icon={<Repeat2 size={13} color={COLORS.accent} />}
            label="Visits"
            value={
              patient.totalSessions === 1 ? "1 session" : `${patient.totalSessions} sessions`
            }
          />
          <View className="w-px bg-border" />
          <Stat
            icon={<CalendarClock size={13} color={COLORS.accent} />}
            label="Last seen"
            value={patient.lastVisit ? formatRelativeDay(patient.lastVisit) : "No visits yet"}
          />
        </View>

        {patient.tags.length > 0 && (
          <View className="flex-row flex-wrap mt-2.5" style={{ gap: 6 }}>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1 px-3 py-2">
      <View className="flex-row items-center" style={{ gap: 5 }}>
        {icon}
        <Text className="text-[10px] font-bold text-muted uppercase" style={{ letterSpacing: 0.4 }}>
          {label}
        </Text>
      </View>
      <Text className="text-[13px] font-bold text-fg mt-1" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
