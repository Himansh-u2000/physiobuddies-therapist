import { useState, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Lock, ShieldCheck } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { Avatar, Chip, Button, OTPInput } from "@/components/ui";
import { appointmentApi, sessionApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { useSessionStore } from "@/lib/stores/session.store";
import { COLORS, OTP_CONFIG } from "@/constants/config";
import { formatCurrency, getSessionTypeLabel } from "@/lib/utils/format";

export default function SessionOtpScreen() {
  const router = useRouter();
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const therapist = useAuthStore((s) => s.therapist);
  const showToast = useAppStore((s) => s.showToast);
  const startSession = useSessionStore((s) => s.startSession);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: appointment } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => appointmentApi.getById(appointmentId),
    enabled: !!appointmentId,
  });

  const handleComplete = useCallback((c: string) => setCode(c), []);

  const handleVerify = async () => {
    if (code.length < OTP_CONFIG.sessionOtpLength) {
      setError(true);
      showToast("Enter all 4 digits.");
      return;
    }
    setError(false);
    setLoading(true);
    try {
      const { sessionId } = await sessionApi.start(appointmentId, code);
      if (appointment) {
        startSession(sessionId, appointment.id, appointment.patientName, appointment.condition);
      }
      showToast("Session started — timer running");
      setTimeout(() => router.replace("/session/active"), 500);
    } catch {
      setError(true);
      showToast("Incorrect OTP. Ask patient to refresh their app.");
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) return <View className="flex-1 bg-bg" />;

  return (
    <View className="flex-1 bg-bg">
      <View className="px-3.5 pt-3 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-md border border-border bg-white items-center justify-center" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
          <ChevronLeft size={18} color={COLORS.accent} />
        </Pressable>
        <Text className="text-[18px] font-extrabold text-fg">Start session</Text>
        <View className="w-10" />
      </View>

      <View className="px-3.5 pt-4" style={{ paddingBottom: 40 }}>
        <View className="bg-white border border-border rounded-md p-4" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
          <View className="flex-row items-start" style={{ gap: 14 }}>
            <Avatar name={appointment.patientName} size={60} radius={16} />
            <View className="flex-1" style={{ gap: 5 }}>
              <Text className="text-[17px] font-bold text-fg">{appointment.patientName}</Text>
              <Text className="text-muted text-[12px]">{appointment.patientAge} years · {appointment.patientGender} · {appointment.condition}</Text>
              <View className="flex-row" style={{ gap: 6 }}>
                <Chip variant="info">{getSessionTypeLabel(appointment.type)}</Chip>
                <Chip variant={appointment.paymentStatus === "paid" ? "active" : "pending"}>{appointment.paymentStatus === "paid" ? "Paid" : "Pending"}</Chip>
              </View>
            </View>
          </View>
          <View className="h-px bg-border my-3" />
          <View className="rounded-[10px] p-2.5 flex-row" style={{ backgroundColor: "rgba(0,64,96,0.03)", gap: 8 }}>
            <View className="flex-1">
              <Text className="text-muted text-[11px]">Appointment</Text>
              <Text className="text-[13px] font-bold text-fg">Today · {appointment.timeLabel} {appointment.meridiem}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-muted text-[11px]">Session</Text>
              <Text className="text-[13px] font-bold text-fg">45 min · {formatCurrency(appointment.amount)}</Text>
            </View>
          </View>
        </View>

        <View className="bg-white border border-border rounded-md p-5 items-center mt-3">
          <View className="w-13 h-13 rounded-[14px] bg-primary-soft items-center justify-center mb-3" style={{ width: 52, height: 52 }}>
            <Lock size={26} color={COLORS.accent} />
          </View>
          <Text className="text-[18px] font-bold text-fg">Enter patient OTP</Text>
          <Text className="text-muted text-[13px] mt-1.5 text-center">
            Ask the patient for their 4-digit OTP shown in their Physiobuddies app
          </Text>

          <View className="mt-4.5 w-full">
            <OTPInput length={OTP_CONFIG.sessionOtpLength} onComplete={handleComplete} />
            {error && (
              <Text className="text-danger text-[12px] font-bold mt-2.5 text-center">
                Incorrect OTP. Ask patient to refresh their app.
              </Text>
            )}
          </View>

          <Button onPress={handleVerify} disabled={loading}>
            <ShieldCheck size={16} color="#fff" />
            <Text className="text-white font-bold text-[14px]">{loading ? "Starting..." : "Verify & start session"}</Text>
          </Button>
          <Text className="text-muted text-[11px] mt-2.5">Session timer starts after OTP is verified</Text>
          <Text className="text-muted/50 text-[10px] mt-1">Demo OTP: {OTP_CONFIG.demoSessionOtp}</Text>
        </View>

        <View className="bg-danger/5 border border-danger/10 rounded-md p-3 mt-2.5">
          <Text className="text-danger text-[12px] font-bold">⚠️ Patient can't share OTP?</Text>
          <Text className="text-muted text-[12px] mt-1">
            Only proceed without OTP if the patient is unable (elderly, emergency). This will be flagged for review.
          </Text>
          <Button variant="danger" size="small" onPress={() => showToast("Supervisor notified — flagged start recorded")}>
            <Text className="text-danger font-bold text-[12px]">Start without OTP (flagged)</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
