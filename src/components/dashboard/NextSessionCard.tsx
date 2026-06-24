import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Navigation, Play } from "lucide-react-native";
import { Avatar, Chip } from "@/components/ui";
import { COLORS } from "@/constants/config";
import { formatCurrency, getSessionTypeIcon } from "@/lib/utils/format";
import type { Appointment } from "@/types";

interface NextSessionCardProps {
  appointment: Appointment;
}

export function NextSessionCard({ appointment }: NextSessionCardProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/session/appointment/${appointment.id}`)}
      className="bg-white border border-border rounded-[14px] overflow-hidden active:opacity-90"
      style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
    >
      <View className="h-24 relative" style={{ backgroundColor: COLORS.primarySoft }}>
        <View className="absolute inset-0" style={{ backgroundColor: "rgba(0,64,96,0.08)" }} />
        <View className="absolute top-2 left-2">
          <Chip variant="info">
            {getSessionTypeIcon(appointment.type)} {appointment.type === "home" ? "Home visit" : appointment.type === "clinic" ? "Clinic visit" : "Online"}
          </Chip>
        </View>
      </View>

      <View className="p-3" style={{ gap: 10 }}>
        <View className="flex-row items-start" style={{ gap: 12 }}>
          <View className="w-[54px] rounded-[11px] bg-primary-soft py-2 items-center">
            <Text className="text-[15px] font-extrabold text-accent">{appointment.timeLabel}</Text>
            <Text className="text-[10px] text-muted font-bold">{appointment.meridiem}</Text>
          </View>
          <View className="flex-1" style={{ gap: 5 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Avatar name={appointment.patientName} size={32} radius={9} />
                <Text className="text-[15px] font-bold text-fg">{appointment.patientName}</Text>
              </View>
              <Chip variant={appointment.paymentStatus === "paid" ? "active" : "pending"}>
                {appointment.paymentStatus === "paid" ? "Paid" : "Pending"}
              </Chip>
            </View>
            <Text className="text-muted text-[12px]">
              {appointment.condition} · {formatCurrency(appointment.amount)}
            </Text>
            {appointment.distanceKm && (
              <Text className="text-muted text-[12px]">
                📍 {appointment.address?.split(",")[0] ?? "Location"} · {appointment.distanceKm} km · {appointment.etaMin} min
              </Text>
            )}
          </View>
        </View>

        <View className="flex-row" style={{ gap: 7 }}>
          <TimelineStep label="Route" done={appointment.workflowStep > 1} />
          <TimelineStep label="OTP" current={appointment.workflowStep === 2} done={appointment.workflowStep > 2} />
          <TimelineStep label="Care" done={appointment.workflowStep > 3} />
          <TimelineStep label="Note" done={appointment.workflowStep > 4} />
        </View>
      </View>

      <View className="border-t border-border px-3 py-2 flex-row" style={{ gap: 8, backgroundColor: "rgba(245,255,254,0.6)" }}>
        <Pressable
          onPress={() => router.push(`/session/route?appointmentId=${appointment.id}`)}
          className="flex-1 h-[30px] rounded-lg bg-white border border-border flex-row items-center justify-center"
          style={{ gap: 4 }}
        >
          <Navigation size={14} color={COLORS.accent} />
          <Text className="text-accent font-bold text-[12px]">Navigate</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/session/otp?appointmentId=${appointment.id}`)}
          className="flex-1 h-[30px] rounded-lg flex-row items-center justify-center"
          style={{ gap: 4, backgroundColor: COLORS.accent }}
        >
          <Play size={14} color="#fff" />
          <Text className="text-white font-bold text-[12px]">Start session</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function TimelineStep({ label, done, current }: { label: string; done?: boolean; current?: boolean }) {
  return (
    <View
      className={`flex-1 min-h-[52px] rounded-[11px] border py-2 items-center justify-center ${done ? "bg-success/5 border-success/10" : current ? "bg-accent/5 border-accent/20" : "bg-white border-border"}`}
    >
      <Text className={`text-[12px] font-extrabold ${done ? "text-success" : current ? "text-accent" : "text-muted"}`}>
        {done ? "✓" : label}
      </Text>
      <Text className="text-[9px] font-bold text-muted">{label}</Text>
    </View>
  );
}
