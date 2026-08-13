import { View, Text, Pressable } from "react-native";
import { ChevronRight, MapPin, Clock3 } from "lucide-react-native";
import { Avatar, Badge, StatusBadge } from "@/components/ui";
import { COLORS } from "@/constants/config";
import { getSessionTypeLabel, getSessionTypeTheme } from "@/lib/utils/format";
import type { Appointment } from "@/types";

/**
 * An appointment row, laid out as a schedule entry rather than a coloured tile.
 *
 * The previous card gave a 76px full-bleed gradient column to the time. It looked bold in
 * isolation but a list of them was a stack of saturated blocks with the patient — the thing the
 * therapist is actually scanning for — pushed into the remaining space. This inverts that: the
 * card is white, the patient leads, and the visit type is carried by a 3px accent rail plus a
 * badge instead of a full colour field. The time stays large because it's the second thing
 * scanned, but it sits on the card's own surface.
 *
 * `compact` drops the address footer — used where the card appears inside another card.
 */
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
  const isDone = appointment.status === "completed";
  const isOff =
    appointment.status === "cancelled" ||
    appointment.status === "no_show" ||
    appointment.status === "expired";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${appointment.patientName}, ${appointment.timeLabel} ${appointment.meridiem}`}
      className="bg-white rounded-[18px] overflow-hidden active:opacity-95"
      style={{
        shadowColor: COLORS.nav,
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 3,
        // A cancelled or no-show visit is history, not something to act on — it recedes rather
        // than competing for attention with the visits that still need doing.
        opacity: isOff ? 0.72 : 1,
      }}
    >
      <View className="flex-row">
        {/* Visit-type accent rail. Carries the same information the old gradient column did,
            in 3px instead of 76. */}
        <View style={{ width: 3, backgroundColor: isOff ? COLORS.border : theme.solid }} />

        <View className="flex-1 p-3.5" style={{ gap: 10 }}>
          <View className="flex-row items-start" style={{ gap: 12 }}>
            {/* Time block */}
            <View className="items-center" style={{ minWidth: 52 }}>
              <Text
                className="text-[19px] font-black"
                style={{ color: isOff ? COLORS.muted : COLORS.fg, letterSpacing: -0.5 }}
              >
                {appointment.timeLabel}
              </Text>
              <Text className="text-[10px] font-extrabold" style={{ color: COLORS.muted, letterSpacing: 1 }}>
                {appointment.meridiem}
              </Text>
              {appointment.dateLabel && (
                <View
                  className="mt-1.5 rounded-md px-1.5 py-0.5"
                  style={{ backgroundColor: appointment.dateLabel === "Today" ? theme.soft : "transparent" }}
                >
                  <Text
                    className="text-[9.5px] font-bold"
                    style={{ color: appointment.dateLabel === "Today" ? theme.solid : COLORS.muted }}
                    numberOfLines={1}
                  >
                    {appointment.dateLabel}
                  </Text>
                </View>
              )}
            </View>

            <View className="w-px self-stretch" style={{ backgroundColor: COLORS.border }} />

            {/* Patient block */}
            <View className="flex-1" style={{ gap: 8 }}>
              <View className="flex-row items-start" style={{ gap: 10 }}>
                <Avatar name={appointment.patientName} url={appointment.patientAvatarUrl} size={40} radius={12} />
                <View className="flex-1">
                  <Text className="text-[15px] font-extrabold text-fg" numberOfLines={1}>
                    {appointment.patientName}
                  </Text>
                  <Text className="text-muted text-[11.5px] mt-0.5" numberOfLines={1}>
                    {[appointment.condition, appointment.patientAge ? `${appointment.patientAge}y` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              </View>

              <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
                <StatusBadge status={appointment.status} size="sm" />
                <Badge variant="neutral" size="sm" dot={false}>
                  {getSessionTypeLabel(appointment.type)}
                </Badge>
                {/* Visit N of M — only meaningful once the detail endpoint has been read, so
                    it's absent on list rows rather than shown as a misleading "1 of 1". */}
                {appointment.sessionCount != null && appointment.sessionCount > 1 && (
                  <Badge variant="info" size="sm" dot={false}>
                    {`Visit ${Math.min((appointment.completedSessionCount ?? 0) + (isDone ? 0 : 1), appointment.sessionCount)}/${appointment.sessionCount}`}
                  </Badge>
                )}
                {appointment.distanceKm != null && (
                  <Badge variant="accent" size="sm" dot={false} icon={MapPin}>
                    {`${appointment.distanceKm} km`}
                  </Badge>
                )}
              </View>
            </View>
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
              <ChevronRight size={15} color={COLORS.muted} />
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
