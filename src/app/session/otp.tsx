import { useState, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Lock, Send, ShieldCheck } from "lucide-react-native";
import { Avatar, Badge, Button, OTPInput, PaymentBadge } from "@/components/ui";
import { appointmentApi, sessionApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { useSessionStore } from "@/lib/stores/session.store";
import { COLORS, OTP_CONFIG, SLOT_CONFIG } from "@/constants/config";
import { getSessionTypeLabel } from "@/lib/utils/format";

export default function SessionOtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const showToast = useAppStore((s) => s.showToast);
  const startSession = useSessionStore((s) => s.startSession);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [hintOtp, setHintOtp] = useState<string | null>(null);

  const { data: appointment } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => appointmentApi.getById(appointmentId),
    enabled: !!appointmentId,
  });

  const handleComplete = useCallback((c: string) => setCode(c), []);

  /**
   * The lifecycle endpoints key off the treatment SESSION, not the treatment plan that the
   * appointment list is keyed by. Passing `appointment.id` here would 404 ("Session not found").
   */
  const sessionTargetId = appointment?.currentSessionId;

  /**
   * Ask the backend to issue the patient's code. This is a required first step — the OTP does
   * not exist until it's generated — and it enforces a window server-side: 30 minutes before
   * the scheduled start to 2 hours after. Outside it the call 400s with a readable explanation,
   * which is surfaced verbatim rather than replaced with a generic failure.
   */
  const handleSendOtp = async () => {
    if (!sessionTargetId) return;
    setSending(true);
    try {
      const result = await sessionApi.generateOtp(sessionTargetId);
      setOtpSent(true);
      // Dev/staging echoes the code back so the flow is testable on one handset.
      setHintOtp(result.otpCode ?? null);
      showToast(result.message ?? "OTP sent to the patient", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't send the OTP. Try again.", "error");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (code.length < OTP_CONFIG.sessionOtpLength) {
      setError(true);
      showToast("Enter all 4 digits.");
      return;
    }
    if (!sessionTargetId) {
      showToast("This appointment has no session left to start.", "error");
      return;
    }
    setError(false);
    setLoading(true);
    try {
      const { sessionId } = await sessionApi.start(sessionTargetId, code);
      if (appointment) {
        startSession(sessionId, appointment.id, appointment.patientName, appointment.condition, appointment.patientId, appointment.type);
      }
      showToast("Session started — timer running");
      setTimeout(() => router.replace("/session/active"), 500);
    } catch (e) {
      setError(true);
      showToast(
        e instanceof Error ? e.message : "Incorrect OTP. Ask patient to refresh their app.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFlaggedStart = async () => {
    if (!appointment) return;
    setLoading(true);
    try {
      const { sessionId } = await sessionApi.startFlagged(appointmentId);
      startSession(sessionId, appointment.id, appointment.patientName, appointment.condition, appointment.patientId, appointment.type);
      showToast("Supervisor notified - flagged start recorded");
      setTimeout(() => router.replace("/session/active"), 500);
    } catch {
      showToast("Unable to start flagged session");
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) return <View className="flex-1 bg-bg" />;

  return (
    <View className="flex-1 bg-bg">
      <View className="px-3.5 flex-row items-center justify-between" style={{ paddingTop: insets.top + 12 }}>
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
                <Badge variant="info" size="sm">{getSessionTypeLabel(appointment.type)}</Badge>
                <PaymentBadge status={appointment.paymentStatus} size="sm" />
              </View>
            </View>
          </View>
          <View className="h-px bg-border my-3" />
          <View className="rounded-[10px] p-2.5 flex-row" style={{ backgroundColor: "rgba(0,64,96,0.03)", gap: 8 }}>
            <View className="flex-1">
              <Text className="text-muted text-[11px]">Appointment</Text>
              <Text className="text-[13px] font-bold text-fg">
                {appointment.dateLabel ?? "Scheduled"} · {appointment.timeLabel} {appointment.meridiem}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-muted text-[11px]">Visit</Text>
              <Text className="text-[13px] font-bold text-fg">
                {appointment.completedSessionCount != null && appointment.sessionCount
                  ? `${Math.min((appointment.completedSessionCount ?? 0) + 1, appointment.sessionCount)} of ${appointment.sessionCount}`
                  : `${SLOT_CONFIG.durationMin} min`}
              </Text>
            </View>
          </View>
        </View>

        <View className="bg-white border border-border rounded-md p-5 items-center mt-3 flex flex-col gap-2">
          <View className="w-13 h-13 rounded-[14px] bg-primary-soft items-center justify-center mb-3" style={{ width: 52, height: 52 }}>
            <Lock size={26} color={COLORS.accent} />
          </View>
          <Text className="text-[18px] font-bold text-fg">
            {otpSent ? "Enter patient OTP" : "Send the patient their OTP"}
          </Text>
          <Text className="text-muted text-[13px] mt-1.5 text-center">
            {otpSent
              ? "Ask the patient for the 4-digit code that just arrived in their Physiobuddies app"
              : "The code is generated when you arrive. It can be sent from 30 minutes before the slot until 2 hours after."}
          </Text>

          {!otpSent && (
            <Button className="mt-4" onPress={handleSendOtp} disabled={sending || !sessionTargetId}>
              <Send size={16} color="#fff" />
              <Text className="text-white font-bold text-[14px]">
                {sending ? "Sending..." : "Send OTP to patient"}
              </Text>
            </Button>
          )}

          <View className="mt-4.5 w-full">
            {/* onChangeCode, not onComplete — the latter never fires on a deletion, so the
                code held here would go stale the moment a digit was backspaced. */}
            <OTPInput length={OTP_CONFIG.sessionOtpLength} onChangeCode={handleComplete} />
            {error && (
              <Text className="text-danger text-[12px] font-bold mt-2.5 text-center">
                Incorrect OTP. Ask the patient to check the code again.
              </Text>
            )}
          </View>

          {/* Gated on a complete code rather than firing and reporting failure afterwards:
              tapping with 0 digits used to send the therapist a "enter all 4 digits" toast that
              read like the OTP had been rejected by the patient. Also gated on there being a
              session to start at all — without one the call 404s. */}
          <Button
            className="mt-2"
            onPress={handleVerify}
            disabled={loading || !sessionTargetId || code.length < OTP_CONFIG.sessionOtpLength}
          >
            <ShieldCheck size={16} color="#fff" />
            <Text className="text-white font-bold text-[14px]">{loading ? "Starting..." : "Verify & start session"}</Text>
          </Button>
          <Text className="text-muted text-[11px] mt-2.5">Session timer starts after OTP is verified</Text>
          {otpSent && (
            <Pressable onPress={handleSendOtp} disabled={sending} hitSlop={6} className="mt-1 active:opacity-70">
              <Text className="text-accent text-[12px] font-bold">
                {sending ? "Resending..." : "Resend OTP"}
              </Text>
            </Pressable>
          )}
          {/* The dev backend echoes the generated code back in the response. Shown only when it
              actually does — never as a hardcoded "demo OTP", which would be wrong against a
              real server and would teach the therapist to try a code that can't work. */}
          {hintOtp && (
            <Text className="text-muted/50 text-[10px] mt-1">Code issued: {hintOtp}</Text>
          )}
        </View>

        <View className="bg-danger/5 border border-danger/10 rounded-md p-3 mt-2.5">
          <Text className="text-danger text-[12px] font-bold">⚠️ Patient can&apos;t share OTP?</Text>
          <Text className="text-muted text-[12px] mt-1">
            Only proceed without OTP if the patient is unable (elderly, emergency). This will be flagged for review.
          </Text>
          <Button variant="danger" size="small" onPress={handleFlaggedStart} disabled={loading}>
            <Text className="text-danger font-bold text-[12px]">{loading ? "Starting..." : "Start without OTP (flagged)"}</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
