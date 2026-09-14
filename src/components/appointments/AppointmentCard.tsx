import { View, Text, Pressable } from "react-native";
import { Building2, ChevronRight, Clock3, Home, MapPin, Video } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Avatar, Badge, StatusBadge } from "@/components/ui";
import { COLORS } from "@/constants/config";
import {
  genderLabel,
  getSessionTypeLabel,
  getSessionTypeTheme,
  isMeaningfulCondition,
} from "@/lib/utils/format";
import type { Appointment } from "@/types";

/**
 * An appointment row, laid out as a schedule entry.
 *
 * Time on the left because it is what a schedule is scanned by; the patient leads the body because
 * it is what the therapist is looking for; state sits top-right, where the eye checks it.
 *
 * ## What changed in this pass, and why
 *
 *   - **Every row had the same subtitle.** List rows come from `mapBookingToAppointment`, which
 *     fills `condition` with the constant `"Therapy session"`, so the list read "Therapy session ·
 *     31y" down its whole length. `PatientCard` already suppressed its equivalent placeholder; this
 *     card never had. The subtitle is now age · gender, plus a condition only when one is real.
 *   - **Gender was on the row and never shown.** It is now, when recorded.
 *   - **List rows had no tap affordance.** The only chevron lived inside the address footer, and
 *     list rows never carry an address, so nothing said the card opened anything.
 *   - **Fewer equal-weight chips.** Status, visit type, progress and distance used to be four badges
 *     of identical weight wrapping onto a second line. Status stays the one coloured badge; visit
 *     type becomes an icon and label in its own colour, in a quiet footer with progress beside it.
 *   - **Visit progress is a bar,** because "2/6" in a badge answers "how far through?" less
 *     quickly than a bar that is a third full.
 *
 * `compact` drops the address footer — used where the card sits inside another card.
 */

const TYPE_ICON: Record<string, LucideIcon> = {
  home: Home,
  clinic: Building2,
  online: Video,
};

export function AppointmentCard({
  appointment,
  onPress,
  compact,
}: {
  appointment: Appointment;
  onPress?: () => void;
  compact?: boolean;
}) {
  const theme = getSessionTypeTheme(appointment.type);
  const TypeIcon = TYPE_ICON[appointment.type] ?? Home;
  const isDone = appointment.status === "completed";
  const isOff =
    appointment.status === "cancelled" ||
    appointment.status === "no_show" ||
    appointment.status === "expired";
  const isToday = appointment.dateLabel === "Today";

  const subtitle = [
    appointment.patientAge ? `${appointment.patientAge} yrs` : null,
    genderLabel(appointment.patientGender) || null,
    isMeaningfulCondition(appointment.condition) ? appointment.condition : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Visit N of M — only meaningful once the detail endpoint has been read, so it's absent on list
  // rows rather than shown as a misleading "1 of 1".
  const total = appointment.sessionCount ?? 0;
  const showProgress = total > 1;
  const current = showProgress
    ? Math.min((appointment.completedSessionCount ?? 0) + (isDone ? 0 : 1), total)
    : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        appointment.patientName,
        `${appointment.timeLabel} ${appointment.meridiem}`,
        appointment.dateLabel,
        getSessionTypeLabel(appointment.type),
      ]
        .filter(Boolean)
        .join(", ")}
      className="bg-white rounded-[18px] overflow-hidden active:opacity-95"
      style={{
        shadowColor: COLORS.nav,
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 3,
        // A cancelled or no-show visit is history, not something to act on — it recedes rather
        // than competing for attention with the visits that still need doing.
        opacity: isOff ? 0.7 : 1,
      }}
    >
      <View className="flex-row">
        {/* Visit-type rail. */}
        <View style={{ width: 4, backgroundColor: isOff ? COLORS.border : theme.solid }} />

        <View className="flex-1 p-3.5" style={{ gap: 12 }}>
          <View className="flex-row" style={{ gap: 12 }}>
            {/* Time block */}
            <View
              className="items-center justify-center rounded-[14px] py-2"
              style={{
                minWidth: 60,
                backgroundColor: isToday && !isOff ? theme.soft : "rgba(0,64,96,0.04)",
              }}
            >
              <Text
                className="text-[18px] font-black"
                style={{ color: isOff ? COLORS.muted : isToday ? theme.solid : COLORS.fg, letterSpacing: -0.5 }}
              >
                {appointment.timeLabel}
              </Text>
              <Text className="text-[9.5px] font-extrabold" style={{ color: COLORS.muted, letterSpacing: 1 }}>
                {appointment.meridiem}
              </Text>
              {appointment.dateLabel && (
                <Text
                  className="text-[9.5px] font-bold mt-1"
                  style={{ color: isToday && !isOff ? theme.solid : COLORS.muted }}
                  numberOfLines={1}
                >
                  {appointment.dateLabel}
                </Text>
              )}
            </View>

            {/* Patient block */}
            <View className="flex-1 justify-center" style={{ gap: 6 }}>
              <View className="flex-row items-start" style={{ gap: 10 }}>
                <Avatar name={appointment.patientName} url={appointment.patientAvatarUrl} size={40} radius={12} />
                <View className="flex-1" style={{ gap: 2 }}>
                  <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
                    <Text className="text-[15px] font-extrabold text-fg flex-shrink" numberOfLines={1}>
                      {appointment.patientName}
                    </Text>
                    <StatusBadge status={appointment.status} size="sm" />
                  </View>
                  {!!subtitle && (
                    <Text className="text-muted text-[12px]" numberOfLines={1}>
                      {subtitle}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Footer: visit type, progress, affordance */}
          <View
            className="flex-row items-center pt-2.5"
            style={{ gap: 10, borderTopWidth: 1, borderTopColor: "rgba(207,217,223,0.6)" }}
          >
            <View className="flex-row items-center" style={{ gap: 5 }}>
              <TypeIcon size={13} color={isOff ? COLORS.muted : theme.solid} />
              <Text
                className="text-[12px] font-bold"
                style={{ color: isOff ? COLORS.muted : theme.solid }}
              >
                {getSessionTypeLabel(appointment.type)}
              </Text>
            </View>

            {showProgress && (
              <View className="flex-row items-center flex-1" style={{ gap: 6 }}>
                <View className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(0,64,96,0.08)" }}>
                  <View
                    className="h-full rounded-full"
                    style={{ width: `${(current / total) * 100}%`, backgroundColor: theme.solid }}
                  />
                </View>
                <Text className="text-muted text-[11px] font-bold">
                  {`Visit ${current}/${total}`}
                </Text>
              </View>
            )}

            {appointment.distanceKm != null && (
              <Badge variant="accent" size="sm" dot={false} icon={MapPin}>
                {`${appointment.distanceKm} km`}
              </Badge>
            )}

            {!showProgress && <View className="flex-1" />}
            <ChevronRight size={16} color={COLORS.muted} />
          </View>

          {!compact && appointment.address && (
            <View
              className="flex-row items-center rounded-[10px] px-2.5 py-2"
              style={{ gap: 6, backgroundColor: "rgba(0,64,96,0.035)" }}
            >
              <MapPin size={12} color={COLORS.muted} />
              <Text className="text-muted text-[11.5px] flex-1" numberOfLines={1}>
                {appointment.address}
              </Text>
            </View>
          )}

          {!compact && !appointment.address && appointment.etaMin != null && (
            <View className="flex-row items-center" style={{ gap: 5 }}>
              <Clock3 size={12} color={COLORS.muted} />
              <Text className="text-muted text-[11.5px]">{appointment.etaMin} min away</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
