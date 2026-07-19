import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Share2, Phone, MessageSquare, Navigation, Play, CheckCircle2 } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar, Chip, Button } from "@/components/ui";
import { appointmentApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { callPatient as dialPatient } from "@/lib/services/callService";
import { COLORS } from "@/constants/config";
import { formatCurrency, getSessionTypeLabel } from "@/lib/utils/format";

export default function AppointmentDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useAppStore((s) => s.showToast);
  const { data: appointment } = useQuery({
    queryKey: ["appointment", id],
    queryFn: () => appointmentApi.getById(id),
    enabled: !!id,
  });

  if (!appointment) return <View className="flex-1 bg-bg" />;

  const callPatient = async () => {
    const phone = appointment.patientPhone ?? "+919876543210";
    await dialPatient(phone, appointment.id);
  };

  const steps = [
    { num: 1, title: "Navigate to patient", sub: "Route, call if needed", done: appointment.workflowStep > 1 },
    { num: 2, title: "Enter patient OTP", sub: "Patient provides 4-digit OTP to start the session timer", current: appointment.workflowStep === 2 },
    { num: 3, title: "Run treatment", sub: "Checklist, notes, photos, exercises", done: appointment.workflowStep > 3 },
    { num: 4, title: "Submit treatment record", sub: "Locks note and triggers payout review", done: appointment.workflowStep > 4 },
  ];

  return (
    <View className="flex-1 bg-bg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#003554", "#004060"]} className="relative overflow-hidden" style={{ height: 180 + insets.top }}>
          <View className="absolute left-0 right-0 p-3 flex-row items-center justify-between" style={{ top: insets.top }}>
            <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-md bg-white/90 items-center justify-center">
              <ChevronLeft size={18} color={COLORS.accent} />
            </Pressable>
            <Pressable onPress={() => showToast("Appointment shared")} className="w-10 h-10 rounded-md bg-white/90 items-center justify-center">
              <Share2 size={18} color={COLORS.accent} />
            </Pressable>
          </View>
          <View className="absolute bottom-3 left-3.5">
            <Text className="text-white text-[20px] font-extrabold">Session details</Text>
            <Chip variant="active">● {getSessionTypeLabel(appointment.type)} · Today {appointment.timeLabel} {appointment.meridiem}</Chip>
          </View>
        </LinearGradient>

        <View className="px-3.5 -mt-4" style={{ paddingBottom: 100 }}>
          <View className="bg-white border border-border rounded-md p-4" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.12, shadowRadius: 28, elevation: 6 }}>
            <View className="flex-row items-start" style={{ gap: 14 }}>
              <Avatar name={appointment.patientName} size={56} radius={16} />
              <View className="flex-1" style={{ gap: 5 }}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[17px] font-bold text-fg">{appointment.patientName}</Text>
                  <Chip variant="active">Confirmed</Chip>
                </View>
                <Text className="text-muted text-[12px]">{appointment.patientAge} years · {appointment.patientGender} · {appointment.condition}</Text>
                <Text className="text-muted text-[12px]">📅 Today, {appointment.timeLabel} {appointment.meridiem} · {getSessionTypeLabel(appointment.type)} · {formatCurrency(appointment.amount)}</Text>
              </View>
            </View>
            <View className="h-px bg-border my-3" />
            <View className="flex-row" style={{ gap: 8 }}>
              <Button variant="secondary" size="small" fullWidth={false} style={{ flex: 1 }} onPress={callPatient}>
                <Phone size={15} color={COLORS.accent} />
                <Text className="text-accent font-bold text-[12px]">Call</Text>
              </Button>
              <Button variant="secondary" size="small" fullWidth={false} style={{ flex: 1 }} onPress={() => showToast("Message service will be connected later")}>
                <MessageSquare size={15} color={COLORS.accent} />
                <Text className="text-accent font-bold text-[12px]">Message</Text>
              </Button>
            </View>
          </View>

          {appointment.distanceKm && (
            <View className="mt-3 bg-white border border-border rounded-lg overflow-hidden" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
              <View className="h-[160px] relative" style={{ backgroundColor: COLORS.primarySoft }}>
                <View className="absolute inset-0" style={{ backgroundColor: "rgba(0,64,96,0.06)" }} />
                <View className="absolute top-2.5 left-2.5 bg-white rounded-lg px-2.5 py-1">
                  <Text className="text-[12px] font-bold text-fg">📍 {appointment.address?.split(",")[0]}</Text>
                </View>
                <View className="absolute bottom-2.5 right-2.5">
                  <Chip variant="info">{appointment.distanceKm} km · {appointment.etaMin} min ETA</Chip>
                </View>
              </View>
              <View className="p-3" style={{ gap: 8 }}>
                <View className="flex-row" style={{ gap: 8 }}>
                  <RouteStat value={`${appointment.etaMin}`} label="min ETA" />
                  <RouteStat value={`${appointment.distanceKm}`} label="km" />
                  <RouteStat value={appointment.type === "home" ? "Home" : appointment.type === "clinic" ? "Clinic" : "Online"} label="Visit type" />
                </View>
                <Button onPress={() => router.push(`/session/route?appointmentId=${appointment.id}`)}>
                  <Navigation size={16} color="#fff" />
                  <Text className="text-white font-bold text-[14px]">Start navigation</Text>
                </Button>
              </View>
            </View>
          )}

          <View className="mt-3 bg-white border border-border rounded-md p-3.5">
            <View className="flex-row items-center justify-between mb-2.5">
              <Text className="text-[14px] font-bold text-fg">Session workflow</Text>
              <Chip variant="neutral">Step {appointment.workflowStep} of 4</Chip>
            </View>
            {steps.map((step) => (
              <View key={step.num} className="flex-row py-3 border-b border-border" style={{ gap: 10 }}>
                <View className={`w-7 h-7 rounded-full items-center justify-center ${step.done ? "bg-success/15" : step.current ? "bg-accent" : "bg-muted/10"}`}>
                  {step.done ? <CheckCircle2 size={16} color={COLORS.success} /> : <Text className={`text-[11px] font-extrabold ${step.current ? "text-white" : "text-muted"}`}>{step.num}</Text>}
                </View>
                <View className="flex-1" style={{ gap: 3 }}>
                  <Text className="text-[13px] font-bold text-fg">{step.title}</Text>
                  <Text className="text-muted text-[12px]">{step.sub}</Text>
                </View>
                {step.done && <Chip variant="active">Done</Chip>}
                {step.current && <Chip variant="pending">Now</Chip>}
              </View>
            ))}
          </View>

          {appointment.notes && (
            <View className="mt-3 bg-white border border-border rounded-md p-3.5" style={{ gap: 10 }}>
              <Text className="text-[14px] font-bold text-fg">Patient notes & history</Text>
              <View className="rounded-[10px] p-3" style={{ backgroundColor: "rgba(0,64,96,0.03)" }}>
                <Text className="text-[13px] text-fg leading-6">{appointment.notes}</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-muted text-[12px]">Payment</Text>
                <Chip variant="active">Paid · {formatCurrency(appointment.amount)}</Chip>
              </View>
              {appointment.insurance && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-muted text-[12px]">Insurance</Text>
                  <Text className="text-muted text-[12px]">{appointment.insurance}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 px-3.5 pb-4 pt-3 flex-row" style={{ gap: 10, backgroundColor: "rgba(233,246,254,0.95)" }}>
        <Button variant="secondary" onPress={() => router.push(`/session/route?appointmentId=${appointment.id}`)}>
          <Navigation size={16} color={COLORS.accent} />
          <Text className="text-accent font-bold text-[14px]">Navigate</Text>
        </Button>
        <Button onPress={() => router.push(`/session/otp?appointmentId=${appointment.id}`)}>
          <Play size={16} color="#fff" />
          <Text className="text-white font-bold text-[14px]">Start session</Text>
        </Button>
      </View>
    </View>
  );
}

function RouteStat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 items-center py-2 border-r border-border last:border-r-0">
      <Text className="text-[14px] font-extrabold text-fg">{value}</Text>
      <Text className="text-muted text-[10px] uppercase tracking-wide">{label}</Text>
    </View>
  );
}
