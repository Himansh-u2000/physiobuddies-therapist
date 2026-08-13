import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Navigation, Play, MapPin, ChevronRight } from "lucide-react-native";
import { Avatar, StatusBadge } from "@/components/ui";
import { COLORS } from "@/constants/config";
import { getSessionTypeIcon, getSessionTypeLabel, getSessionTypeTheme } from "@/lib/utils/format";
import type { Appointment } from "@/types";

/**
 * The dashboard's "what's next" card.
 *
 * Rebuilt around a countdown-style hero strip and a real progress track. The old version led
 * with a tall gradient banner whose only content was a type pill and the time, then floated a
 * patient row over the seam — a lot of vertical space spent before reaching anything actionable.
 * Here the gradient is a compact strip that carries the *time* at display size, and the four
 * workflow steps became a single connected track instead of four boxes that each repeated their
 * own label twice.
 */
export function NextSessionCard({ appointment }: { appointment: Appointment }) {
  const router = useRouter();
  const theme = getSessionTypeTheme(appointment.type);
  const live = appointment.status === "in_progress";

  return (
    <Pressable
      onPress={() => router.push(`/session/appointment/${appointment.id}`)}
      className="bg-white rounded-[20px] overflow-hidden active:opacity-95"
      style={{ shadowColor: COLORS.nav, shadowOpacity: 0.14, shadowRadius: 22, elevation: 5 }}
    >
      <LinearGradient
        colors={theme.grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="px-4 py-3.5 relative overflow-hidden"
      >
        <View className="absolute -right-10 -top-12 w-32 h-32 rounded-full bg-white/10" />
        <View className="absolute -right-2 top-8 w-20 h-20 rounded-full bg-white/5" />

        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white/70 text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: 1 }}>
              {live ? "Session in progress" : "Next session"}
            </Text>
            <View className="flex-row items-baseline mt-1" style={{ gap: 5 }}>
              <Text className="text-white text-[30px] font-black" style={{ letterSpacing: -1 }}>
                {appointment.timeLabel}
              </Text>
              <Text className="text-white/80 text-[13px] font-extrabold">{appointment.meridiem}</Text>
              {appointment.dateLabel && (
                <Text className="text-white/70 text-[12px] font-bold">· {appointment.dateLabel}</Text>
              )}
            </View>
          </View>
          <View className="items-end" style={{ gap: 6 }}>
            <View className="flex-row items-center rounded-lg bg-white/20 px-2.5 py-1" style={{ gap: 5 }}>
              <Text className="text-[12px]">{getSessionTypeIcon(appointment.type)}</Text>
              <Text className="text-white text-[11px] font-bold">{getSessionTypeLabel(appointment.type)}</Text>
            </View>
            {appointment.sessionCount != null && appointment.sessionCount > 1 && (
              <Text className="text-white/75 text-[10.5px] font-bold">
                Visit {Math.min((appointment.completedSessionCount ?? 0) + 1, appointment.sessionCount)} of{" "}
                {appointment.sessionCount}
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>

      <View className="px-3.5 pt-3" style={{ gap: 11 }}>
        <View className="flex-row items-center" style={{ gap: 11 }}>
          <Avatar name={appointment.patientName} url={appointment.patientAvatarUrl} size={44} radius={13} />
          <View className="flex-1">
            <Text className="text-[15.5px] font-extrabold text-fg" numberOfLines={1}>
              {appointment.patientName}
            </Text>
            <Text className="text-muted text-[12px] mt-0.5" numberOfLines={1}>
              {[appointment.condition, appointment.patientAge ? `${appointment.patientAge}y` : null]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <StatusBadge status={appointment.status} size="sm" />
        </View>

        {appointment.address && (
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <MapPin size={13} color={COLORS.muted} />
            <Text className="text-muted text-[12px] flex-1" numberOfLines={1}>
              {appointment.address}
              {appointment.distanceKm != null ? ` · ${appointment.distanceKm} km` : ""}
              {appointment.etaMin != null ? ` · ${appointment.etaMin} min` : ""}
            </Text>
            <ChevronRight size={14} color={COLORS.muted} />
          </View>
        )}

        <WorkflowTrack step={appointment.workflowStep} accent={theme.solid} />
      </View>

      <View
        className="mt-3 px-3.5 py-2.5 flex-row border-t border-border"
        style={{ gap: 8, backgroundColor: theme.soft }}
      >
        <Pressable
          onPress={() => router.push(`/session/route?appointmentId=${appointment.id}`)}
          className="flex-1 h-[36px] rounded-[10px] bg-white border border-border flex-row items-center justify-center active:opacity-80"
          style={{ gap: 5 }}
        >
          <Navigation size={14} color={theme.solid} />
          <Text className="font-bold text-[12.5px]" style={{ color: theme.solid }}>
            Navigate
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(live ? "/session/active" : `/session/otp?appointmentId=${appointment.id}`)}
          className="flex-1 h-[36px] rounded-[10px] flex-row items-center justify-center active:opacity-90"
          style={{ gap: 5, backgroundColor: theme.solid }}
        >
          <Play size={14} color="#fff" />
          <Text className="text-white font-bold text-[12.5px]">{live ? "Resume" : "Start session"}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const STEPS = ["Route", "OTP", "Care", "Notes"] as const;

/**
 * The Route → OTP → Care → Notes progress, as one connected track.
 *
 * `step` is 1-based and comes from `workflowStepFor` in the mappers; 0 means the visit is
 * cancelled/no-show, in which case nothing is "in progress" and every node stays inert.
 */
function WorkflowTrack({ step, accent }: { step: number; accent: string }) {
  return (
    <View className="flex-row items-center">
      {STEPS.map((label, i) => {
        const index = i + 1;
        const done = step > index;
        const current = step === index;
        return (
          <View key={label} className="flex-1 flex-row items-center">
            <View className="items-center" style={{ gap: 3, width: 40 }}>
              <View
                className="w-[9px] h-[9px] rounded-full"
                style={{
                  backgroundColor: done ? COLORS.success : current ? accent : COLORS.border,
                  // A ring marks the step you're on, so "current" is distinguishable from
                  // "done" without relying on the green/navy hue difference alone.
                  borderWidth: current ? 3 : 0,
                  borderColor: current ? `${accent}33` : "transparent",
                }}
              />
              <Text
                className="text-[9.5px] font-bold"
                style={{ color: done ? COLORS.success : current ? accent : COLORS.muted }}
              >
                {label}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <View
                className="flex-1 h-[2px] -mt-3.5 rounded-full"
                style={{ backgroundColor: done ? COLORS.success : COLORS.border }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
