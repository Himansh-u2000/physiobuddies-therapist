import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CalendarDays, ChevronLeft, FileText, MessageSquare, Phone, Stethoscope } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar, Button, Chip, Skeleton } from "@/components/ui";
import { appointmentApi, patientApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { callPatient as dialPatient } from "@/lib/services/callService";
import { COLORS } from "@/constants/config";
import { formatCurrency, getSessionTypeLabel } from "@/lib/utils/format";
import type { Appointment } from "@/types";

const DUMMY_PHONE = "+919876543210";

export default function PatientProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useAppStore((s) => s.showToast);

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => patientApi.getById(id),
    enabled: !!id,
  });

  const { data: appointments } = useQuery({
    queryKey: ["appointments"],
    queryFn: appointmentApi.list,
  });

  const patientAppointments = appointments?.filter((appointment) => appointment.patientId === id) ?? [];
  const nextAppointment = patientAppointments[0];

  const callPatient = async () => {
    const phone = patient?.phone ?? DUMMY_PHONE;
    await dialPatient(phone, nextAppointment?.id);
  };

  if (isLoading || !patient) {
    return (
      <View className="flex-1 bg-bg px-3.5 pt-12" style={{ gap: 12 }}>
        <Skeleton height={190} radius={18} />
        <Skeleton height={110} radius={14} />
        <Skeleton height={160} radius={14} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
        <LinearGradient colors={["#003554", "#006071"]} className="px-3.5 pt-12 pb-7">
          <View className="flex-row items-center justify-between mb-5">
            <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-md bg-white/90 items-center justify-center">
              <ChevronLeft size={18} color={COLORS.accent} />
            </Pressable>
            <Chip variant="active">{patient.totalSessions} sessions</Chip>
          </View>

          <View className="flex-row items-center" style={{ gap: 14 }}>
            <Avatar name={patient.name} url={patient.avatarUrl} size={68} radius={22} />
            <View className="flex-1">
              <Text className="text-white text-[22px] font-black" numberOfLines={1}>{patient.name}</Text>
              <Text className="text-white/75 text-[12px] mt-1">{patient.age} years | {patient.gender} | {patient.phone}</Text>
              <View className="flex-row flex-wrap mt-3" style={{ gap: 7 }}>
                {patient.tags.map((tag) => (
                  <View key={tag} className="min-h-[24px] rounded-full bg-white/15 border border-white/20 px-2.5 items-center justify-center">
                    <Text className="text-[10px] leading-[12px] font-bold text-white text-center">{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </LinearGradient>

        <View className="px-3.5 -mt-3" style={{ gap: 12 }}>
          <View className="bg-white border border-border rounded-lg p-4" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.12, shadowRadius: 20, elevation: 5 }}>
            <View className="flex-row" style={{ gap: 10 }}>
              <Button variant="secondary" fullWidth={false} style={{ flex: 1 }} onPress={callPatient}>
                <Phone size={16} color={COLORS.accent} />
                <Text className="text-accent font-bold text-[13px]">Call</Text>
              </Button>
              <Button variant="secondary" fullWidth={false} style={{ flex: 1 }} onPress={() => showToast("Message service will be connected later")}>
                <MessageSquare size={16} color={COLORS.accent} />
                <Text className="text-accent font-bold text-[13px]">Message</Text>
              </Button>
            </View>
          </View>

          <InfoCard icon={<Stethoscope size={18} color={COLORS.accent} />} title="Clinical summary">
            <Text className="text-[15px] font-extrabold text-fg">{patient.condition}</Text>
            <Text className="text-muted text-[12px] leading-5 mt-1">
              Ongoing physiotherapy plan with pain tracking, exercise progression, and visit notes. Keep local treatment drafts synced before completing payout review.
            </Text>
            {patient.address && (
              <Text className="text-muted text-[12px] leading-5 mt-2">Address: {patient.address}</Text>
            )}
          </InfoCard>

          <InfoCard icon={<CalendarDays size={18} color={COLORS.accent} />} title="Next session">
            {nextAppointment ? (
              <AppointmentRow appointment={nextAppointment} onPress={() => router.push(`/session/appointment/${nextAppointment.id}`)} />
            ) : (
              <Text className="text-muted text-[12px]">No upcoming sessions in the current cache.</Text>
            )}
          </InfoCard>

          <InfoCard icon={<FileText size={18} color={COLORS.accent} />} title="Patient workflow">
            <WorkflowStep title="Review history" detail="Check condition, recent notes, tags, and active appointment." done />
            <WorkflowStep title="Start appointment" detail="Open session details, navigate, verify OTP, and run treatment." done={!!nextAppointment} />
            <WorkflowStep title="Document treatment" detail="Submit assessment, exercises, photos, precautions, and follow-up plan." />
            <WorkflowStep title="Sync record" detail="Queue offline updates and sync to backend when online." />
          </InfoCard>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <View className="bg-white border border-border rounded-lg p-4" style={{ gap: 12, shadowColor: COLORS.nav, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 }}>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <View className="w-9 h-9 rounded-[12px] bg-primary-soft items-center justify-center">{icon}</View>
        <Text className="text-[15px] font-extrabold text-fg">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function AppointmentRow({ appointment, onPress }: { appointment: Appointment; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="rounded-[14px] bg-bg border border-border p-3 active:opacity-85" style={{ gap: 8 }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[14px] font-extrabold text-fg">{appointment.timeLabel} {appointment.meridiem}</Text>
        <Chip variant={appointment.paymentStatus === "paid" ? "active" : "pending"}>{formatCurrency(appointment.amount)}</Chip>
      </View>
      <Text className="text-muted text-[12px]">{getSessionTypeLabel(appointment.type)} | {appointment.condition}</Text>
      {appointment.address && <Text className="text-muted text-[11px]" numberOfLines={2}>{appointment.address}</Text>}
    </Pressable>
  );
}

function WorkflowStep({ title, detail, done }: { title: string; detail: string; done?: boolean }) {
  return (
    <View className="flex-row py-2.5 border-b border-border last:border-b-0" style={{ gap: 10 }}>
      <View className={`w-7 h-7 rounded-full items-center justify-center ${done ? "bg-success" : "bg-muted/10"}`}>
        <Text className={`text-[12px] font-black ${done ? "text-white" : "text-muted"}`}>{done ? "OK" : "-"}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[13px] font-bold text-fg">{title}</Text>
        <Text className="text-muted text-[12px] leading-5 mt-0.5">{detail}</Text>
      </View>
    </View>
  );
}
