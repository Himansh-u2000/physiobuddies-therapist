import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Building2, CalendarDays, Check, Clock3, House, Play, Video } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { COLORS, SLOT_CONFIG } from "@/constants/config";
import { genderLabel } from "@/lib/utils/format";
import type { Appointment, AppointmentStatus } from "@/types";

/**
 * An appointment in the schedule list.
 *
 * Three stacked bands, top to bottom — *when* (session date + status), *who* (patient), and
 * *the slot* (time range + visit mode) — with "Start visit" as a full-width action on visits that
 * can still be started. Finished and cancelled visits drop the action and go quiet (grey icons,
 * slightly faded) so the eye lands on work that is still ahead.
 *
 * Tapping anywhere else on the card opens the appointment's details.
 *
 * ## Surfaces
 *
 * The list screen is white and the card carries the app's light-blue surface (`COLORS.card`) — the
 * reverse of the original, so cards read as objects on a page rather than holes in a tinted one.
 * The nesting alternates on purpose: blue card → white slot band → blue chips. Each layer contrasts
 * with the one it sits on; keeping the old white-on-white or blue-on-blue pairings would make the
 * slot band and chips disappear.
 *
 * Depth is kept quiet: a barely-there diagonal gradient across the same hue, a navy-tinted shadow
 * rather than black, and a 1px hairline so the edge stays crisp on a white page even where the
 * shadow is too faint to see (bright sunlight, low-end screens).
 */

/** Card surface: the brand light blue, with a subtle top-left → bottom-right falloff. */
const CARD_GRADIENT = ["#f1f9fe", "#e3f2fc"] as const;
const CARD_BORDER = "rgba(0,64,96,0.09)";
const DIVIDER = "rgba(0,64,96,0.08)";

const MODE: Record<Appointment["type"], { label: string; icon: LucideIcon }> = {
  home: { label: "Home Visit", icon: House },
  clinic: { label: "Clinic Visit", icon: Building2 },
  online: { label: "Online Visit", icon: Video },
};

type Tone = "success" | "warning" | "info" | "danger" | "neutral";

const TONE: Record<Tone, { border: string; fg: string; dot: string }> = {
  success: { border: "rgba(35,145,73,0.25)", fg: COLORS.successDark, dot: COLORS.success },
  warning: { border: "rgba(209,154,18,0.3)", fg: "#9a7108", dot: COLORS.warning },
  info: { border: "rgba(0,134,168,0.25)", fg: COLORS.info, dot: COLORS.info },
  danger: { border: "rgba(207,66,56,0.25)", fg: COLORS.danger, dot: COLORS.danger },
  neutral: { border: "rgba(94,107,119,0.2)", fg: COLORS.muted, dot: COLORS.muted },
};

/**
 * Status labels. "Completed" rather than the design's "Settled": nothing on a list row says the
 * visit has been *paid out*, and a word that implies money moved should only appear when it did.
 */
const STATUS: Record<AppointmentStatus, { label: string; tone: Tone; check?: boolean }> = {
  confirmed: { label: "Confirmed", tone: "success" },
  in_progress: { label: "In session", tone: "info" },
  pending: { label: "Awaiting payment", tone: "warning" },
  completed: { label: "Completed", tone: "neutral", check: true },
  cancelled: { label: "Cancelled", tone: "danger" },
  no_show: { label: "No show", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
};

/** Visits that can still be started (or resumed) from the list. */
export function canStartVisit(status: AppointmentStatus): boolean {
  return status === "confirmed" || status === "in_progress";
}

/** "2026-09-17" → "September 17, 2026". Parsed as a local date — `new Date(iso)` would be UTC. */
function fullDate(a: Appointment): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(a.date ?? "");
  if (!m) return a.dateLabel ?? "Date to be confirmed";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * "11:00 AM - 11:40 AM". The end comes from the server's own slot string when it sent one; rows
 * from the offline cache predate that field, so they fall back to start + the standard slot.
 */
export function slotRange(a: Appointment): string {
  const start = `${a.timeLabel} ${a.meridiem}`;
  if (a.endTimeLabel) return `${start} - ${a.endTimeLabel}`;
  const [h, mm] = a.timeLabel.split(":").map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return start;
  const startMin = ((h % 12) + (a.meridiem === "PM" ? 12 : 0)) * 60 + mm;
  const endMin = (startMin + SLOT_CONFIG.durationMin) % (24 * 60);
  const eh = Math.floor(endMin / 60);
  const em = endMin % 60;
  const h12 = eh % 12 === 0 ? 12 : eh % 12;
  return `${start} - ${String(h12).padStart(2, "0")}:${String(em).padStart(2, "0")} ${eh >= 12 ? "PM" : "AM"}`;
}

export function AppointmentCard({
  appointment,
  onPress,
  onStartVisit,
  resumable,
}: {
  appointment: Appointment;
  /** Opens the appointment's details. */
  onPress?: () => void;
  /** The "Start visit" button. Omit to hide it. */
  onStartVisit?: () => void;
  /** A session for this visit is already running on this device — label the action "Continue". */
  resumable?: boolean;
}) {
  const status = STATUS[appointment.status] ?? STATUS.pending;
  const tone = TONE[status.tone];
  const mode = MODE[appointment.type] ?? MODE.home;
  const ModeIcon = mode.icon;
  const settled = !canStartVisit(appointment.status) && appointment.status !== "pending";
  const iconColor = settled ? COLORS.muted : COLORS.accent;

  const demographics = [
    appointment.patientAge ? `${appointment.patientAge} yrs` : null,
    genderLabel(appointment.patientGender) || null,
  ]
    .filter(Boolean)
    .join(" • ");

  const showAction = !!onStartVisit && canStartVisit(appointment.status);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${appointment.patientName}, ${fullDate(appointment)}, ${slotRange(appointment)}, ${mode.label}, ${status.label}`}
      className="rounded-[24px] p-4 active:opacity-95"
      style={{
        // A solid fill under the gradient: iOS needs one to draw the shadow efficiently (without it
        // the shadow is traced around every child), and Android needs one for `elevation` at all.
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: CARD_BORDER,
        shadowColor: COLORS.nav,
        shadowOpacity: settled ? 0.05 : 0.1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: settled ? 2 : 4,
        opacity: settled ? 0.92 : 1,
      }}
    >
      {/* Behind the content, clipped to the card's corners. Not `overflow: hidden` on the card
          itself — that would clip the iOS shadow too. */}
      <LinearGradient
        pointerEvents="none"
        colors={CARD_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 23 }]}
      />

      {/* When + status */}
      <View
        className="flex-row items-center justify-between pb-3"
        style={{ borderBottomWidth: 1, borderBottomColor: DIVIDER }}
      >
        <View className="flex-row items-center flex-1" style={{ gap: 8 }}>
          <View
            className="w-8 h-8 rounded-[12px] items-center justify-center border"
            style={{
              backgroundColor: "#ffffff",
              borderColor: settled ? "rgba(94,107,119,0.15)" : "rgba(0,64,96,0.12)",
            }}
          >
            <CalendarDays size={15} color={iconColor} />
          </View>
          <View className="flex-shrink">
            <Text className="text-[10px] uppercase font-bold text-muted" style={{ letterSpacing: 0.8 }}>
              Session Date
            </Text>
            <Text className="text-[12.5px] font-bold text-fg mt-0.5" numberOfLines={1}>
              {fullDate(appointment)}
            </Text>
          </View>
        </View>

        <View
          className="flex-row items-center rounded-full px-2.5 py-1 border ml-2"
          // A solid white base under the tint: a translucent pill over the blue card mixes into a
          // muddy colour, and the status is the one thing on the card that must read instantly.
          style={{ gap: 5, backgroundColor: "#ffffff", borderColor: tone.border }}
        >
          {status.check ? (
            <Check size={12} color={COLORS.accent} strokeWidth={3} />
          ) : (
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: tone.dot }} />
          )}
          <Text className="text-[10.5px] font-bold uppercase" style={{ color: tone.fg, letterSpacing: 0.3 }}>
            {status.label}
          </Text>
        </View>
      </View>

      {/* Who */}
      <View className="flex-row items-center my-3.5" style={{ gap: 14 }}>
        <Avatar name={appointment.patientName} url={appointment.patientAvatarUrl} size={48} radius={16} />
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-fg" numberOfLines={1}>
            {appointment.patientName}
          </Text>
          {demographics ? (
            <Text className="text-[12.5px] font-semibold text-muted mt-0.5">{demographics}</Text>
          ) : null}
        </View>
      </View>

      {/* The slot */}
      <View
        className="rounded-[16px] p-3 border flex-row items-center justify-between"
        style={{
          backgroundColor: "#ffffff",
          borderColor: "rgba(0,64,96,0.06)",
          gap: 8,
          shadowColor: COLORS.nav,
          shadowOpacity: 0.04,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        }}
      >
        <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
          <View
            className="w-8 h-8 rounded-[12px] items-center justify-center border"
            style={{ backgroundColor: COLORS.card, borderColor: "rgba(0,64,96,0.08)" }}
          >
            <Clock3 size={15} color={iconColor} />
          </View>
          <View className="flex-shrink">
            <Text className="text-[10px] uppercase font-bold text-muted" style={{ letterSpacing: 0.4 }}>
              Slot Time
            </Text>
            <Text
              className="text-[12.5px] font-extrabold mt-0.5"
              style={{ color: settled ? COLORS.muted : COLORS.fg }}
              numberOfLines={1}
            >
              {slotRange(appointment)}
            </Text>
          </View>
        </View>
        <View
          className="flex-row items-center rounded-[12px] border px-2.5 py-1.5"
          style={{ gap: 5, backgroundColor: COLORS.card, borderColor: "rgba(0,64,96,0.08)" }}
        >
          <ModeIcon size={13} color={iconColor} />
          <Text className="text-[12px] font-bold" style={{ color: settled ? COLORS.muted : COLORS.fg }}>
            {mode.label}
          </Text>
        </View>
      </View>

      {showAction && (
        <Pressable
          onPress={onStartVisit}
          accessibilityRole="button"
          accessibilityLabel={`${resumable ? "Continue" : "Start"} visit with ${appointment.patientName}`}
          className="mt-3.5 h-12 rounded-[16px] flex-row items-center justify-center active:opacity-85"
          style={{
            gap: 8,
            backgroundColor: resumable ? COLORS.success : COLORS.accent,
            shadowColor: resumable ? COLORS.success : COLORS.accent,
            shadowOpacity: 0.25,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <Play size={15} color="#fff" fill="#fff" />
          <Text className="text-white font-bold text-[13.5px]">{resumable ? "Continue Visit" : "Start Visit"}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}
