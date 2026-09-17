import { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Clock3,
  FlaskConical,
  HelpCircle,
  KeyRound,
  RotateCw,
  Send,
  ShieldCheck,
} from "lucide-react-native";
import { Avatar, Button, OTPInput, Skeleton } from "@/components/ui";
import { appointmentApi, sessionApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useSessionStore } from "@/lib/stores/session.store";
import { SectionLabel, VisitCard, VisitFooter, VisitHeader } from "@/components/session/VisitFlow";
import { COLORS, OTP_CONFIG, SHOW_TEST_OTP, SLOT_CONFIG, SUPPORT_EMAIL } from "@/constants/config";
import { getSessionTypeLabel } from "@/lib/utils/format";
import { openSupportEmail } from "@/lib/utils/support";

/**
 * Step 2 of the visit — verify the patient's OTP, which is what starts the session.
 *
 * Two stages, one primary button. The footer's button is always the next thing to do: "Send OTP"
 * until a code has gone out, then "Verify & start treatment". A code the patient already has
 * (sent on an earlier attempt) can be typed straight in — a full code switches the button to
 * verify regardless, so nobody is forced to re-send just to reach the input.
 *
 * On success this *replaces* itself with the treatment screen: going back from there should land
 * on navigation, not on a code that has already been used.
 */
export default function SessionOtpScreen() {
  const router = useRouter();
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const showToast = useAppStore((s) => s.showToast);
  const therapist = useAuthStore((s) => s.therapist);
  const startSession = useSessionStore((s) => s.startSession);
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [hintOtp, setHintOtp] = useState<string | null>(null);

  const { data: appointment, isError, refetch } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => appointmentApi.getById(appointmentId),
    enabled: !!appointmentId,
  });

  const handleChangeCode = useCallback((c: string) => {
    setCode(c);
    setError(null);
  }, []);

  /**
   * The lifecycle endpoints key off the treatment SESSION, not the treatment plan that the
   * appointment list is keyed by. Passing `appointment.id` here would 404 ("Session not found").
   */
  const sessionTargetId = appointment?.currentSessionId;
  const codeComplete = code.length >= OTP_CONFIG.sessionOtpLength;

  /**
   * Ask the backend to issue the patient's code. The OTP does not exist until it's generated, and
   * the server enforces a window — 30 minutes before the slot to 2 hours after. Outside it the
   * call 400s with a readable explanation, surfaced verbatim.
   */
  const handleSendOtp = async () => {
    if (!sessionTargetId) return;
    setSending(true);
    try {
      const result = await sessionApi.generateOtp(sessionTargetId);
      setOtpSent(true);
      // TESTING ONLY — see SHOW_TEST_OTP. A production build never surfaces the code even if the
      // server keeps echoing it.
      setHintOtp(SHOW_TEST_OTP ? (result.otpCode ?? null) : null);
      showToast(result.message ?? "OTP sent to the patient", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't send the OTP. Try again.", "error");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!codeComplete) return;
    if (!sessionTargetId) {
      showToast("This appointment has no session left to start.", "error");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      const { sessionId } = await sessionApi.start(sessionTargetId, code);
      if (appointment) {
        startSession(sessionId, appointment.id, appointment.patientName, appointment.condition, appointment.patientId, appointment.type);
        // The server status just moved to `active`; the detail screen derives its workflow ticks
        // from it, so a stale cache would keep showing the OTP step as outstanding.
        queryClient.invalidateQueries({ queryKey: ["appointment", appointment.id] });
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      }
      showToast("OTP verified — session started", "success");
      router.replace("/session/active");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code didn't match. Ask the patient to check it again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleContactSupport = async () => {
    const opened = await openSupportEmail(
      therapist,
      `Physiobuddies Therapist — patient can't share session OTP (${appointment?.patientName ?? "visit"})`,
    );
    if (!opened) showToast(`Email us at ${SUPPORT_EMAIL}`, "info");
  };

  if (!appointment) {
    return isError ? (
      <StartSessionError onRetry={() => refetch()} onBack={() => router.back()} />
    ) : (
      <StartSessionSkeleton onBack={() => router.back()} />
    );
  }

  const visitOrdinal =
    appointment.completedSessionCount != null && appointment.sessionCount
      ? `Visit ${Math.min((appointment.completedSessionCount ?? 0) + 1, appointment.sessionCount)} of ${appointment.sessionCount}`
      : `${SLOT_CONFIG.durationMin} min session`;

  // The footer's one primary action, by stage.
  const showVerify = otpSent || codeComplete;

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <VisitHeader title="Verify patient OTP" step={1} onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 24 }}
      >
        <VisitCard>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Avatar name={appointment.patientName} size={52} radius={16} />
            <View className="flex-1">
              <Text className="text-[16px] font-extrabold text-fg">{appointment.patientName}</Text>
              <Text className="text-muted text-[12px] mt-0.5" numberOfLines={1}>
                {[appointment.patientAge ? `${appointment.patientAge} yrs` : null, appointment.patientGender, appointment.condition]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          </View>
          <View className="flex-row mt-3 rounded-[12px] overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
            <MetaCell icon={Clock3} label="Scheduled" value={`${appointment.dateLabel ?? "Today"} · ${appointment.timeLabel} ${appointment.meridiem ?? ""}`.trim()} />
            <View className="w-px bg-border my-2" />
            <MetaCell icon={KeyRound} label={getSessionTypeLabel(appointment.type)} value={visitOrdinal} />
          </View>
        </VisitCard>

        <SectionLabel>Start the session</SectionLabel>
        <VisitCard>
          {/* Stage 1 — send */}
          <StageRow
            index={1}
            done={otpSent}
            active={!otpSent}
            title={otpSent ? "Code sent to the patient" : "Send the code to the patient"}
            sub={
              otpSent
                ? "It's in their Physiobuddies app. A new code replaces the old one."
                : "Available from 30 minutes before the slot until 2 hours after."
            }
            action={
              otpSent ? (
                <Pressable
                  onPress={handleSendOtp}
                  disabled={sending}
                  hitSlop={8}
                  className="flex-row items-center rounded-full px-2.5 py-1.5 active:opacity-70"
                  style={{ gap: 5, backgroundColor: COLORS.primarySoft }}
                >
                  {sending ? <ActivityIndicator size="small" color={COLORS.accent} /> : <RotateCw size={12} color={COLORS.accent} />}
                  <Text className="text-accent text-[11.5px] font-bold">Resend</Text>
                </Pressable>
              ) : null
            }
          />

          <View className="ml-[13px] w-[2px] h-4" style={{ backgroundColor: otpSent ? COLORS.success : COLORS.border }} />

          {/* Stage 2 — enter */}
          <StageRow
            index={2}
            done={false}
            active={otpSent || code.length > 0}
            title={`Enter the ${OTP_CONFIG.sessionOtpLength}-digit code`}
            sub="Ask the patient to read it out once you're with them."
          />

          <View className="mt-3.5">
            {/* onChangeCode, not onComplete — the latter never fires on a deletion, so the code
                held here would go stale the moment a digit was backspaced. */}
            <OTPInput length={OTP_CONFIG.sessionOtpLength} onChangeCode={handleChangeCode} />
            {error ? (
              <View className="mt-2.5 rounded-[10px] px-3 py-2 bg-danger/5 border border-danger/20">
                <Text className="text-danger text-[12px] font-bold text-center">{error}</Text>
              </View>
            ) : (
              <Text className="text-muted text-[11.5px] text-center mt-2.5">
                The session timer starts as soon as the code is verified.
              </Text>
            )}
          </View>

          {/* TESTING ONLY. Rendered only when the server actually echoed a code and this build is
              allowed to show it — labelled so nobody mistakes it for a real affordance. */}
          {hintOtp && (
            <View
              className="mt-3 flex-row items-center rounded-[10px] border border-warning/30 px-2.5 py-2"
              style={{ backgroundColor: "rgba(209,154,18,0.08)", gap: 8 }}
            >
              <FlaskConical size={13} color={COLORS.warning} />
              <Text className="text-[11px] text-muted flex-1">
                Testing build — the patient&apos;s code is <Text className="font-extrabold text-fg">{hintOtp}</Text>
              </Text>
            </View>
          )}
        </VisitCard>

        {/* What to do when the patient can't read out a code. There is deliberately no
            "start without OTP" — no backend path accepts an unverified start. */}
        <View className="mt-3 rounded-lg p-3.5 bg-info/5 border border-info/15">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <HelpCircle size={15} color={COLORS.info} />
            <Text className="text-info text-[12.5px] font-bold">Patient can&apos;t find the code?</Text>
          </View>
          <Text className="text-muted text-[12px] mt-1.5 leading-[18px]">
            Resend it above. If it still doesn&apos;t arrive, support can verify the visit for you —
            a session can&apos;t start without a verified code.
          </Text>
          <Pressable onPress={handleContactSupport} hitSlop={6} className="mt-2 self-start active:opacity-70">
            <Text className="text-accent text-[12.5px] font-bold">Contact support →</Text>
          </Pressable>
        </View>
      </ScrollView>

      <VisitFooter>
        {showVerify ? (
          <Button
            variant="success"
            onPress={handleVerify}
            disabled={verifying || !sessionTargetId || !codeComplete}
          >
            {verifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <ShieldCheck size={17} color="#fff" />
                <Text className="text-white font-bold text-[15px]">
                  {codeComplete ? "Verify & start treatment" : `Enter all ${OTP_CONFIG.sessionOtpLength} digits`}
                </Text>
                {codeComplete && <ArrowRight size={16} color="#fff" />}
              </>
            )}
          </Button>
        ) : (
          <Button onPress={handleSendOtp} disabled={sending || !sessionTargetId}>
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Send size={16} color="#fff" />
                <Text className="text-white font-bold text-[15px]">
                  {sessionTargetId ? "Send OTP to patient" : "No session left to start"}
                </Text>
              </>
            )}
          </Button>
        )}
      </VisitFooter>
    </KeyboardAvoidingView>
  );
}

function StageRow({
  index,
  done,
  active,
  title,
  sub,
  action,
}: {
  index: number;
  done: boolean;
  active: boolean;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-start" style={{ gap: 12 }}>
      <View
        className="w-7 h-7 rounded-full items-center justify-center"
        style={{ backgroundColor: done ? COLORS.success : active ? COLORS.accent : COLORS.bg }}
      >
        {done ? (
          <Check size={14} color="#fff" strokeWidth={3} />
        ) : (
          <Text className={`text-[12px] font-extrabold ${active ? "text-white" : "text-muted"}`}>{index}</Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-[14px] font-bold text-fg">{title}</Text>
        <Text className="text-muted text-[12px] mt-0.5 leading-[17px]">{sub}</Text>
      </View>
      {action}
    </View>
  );
}

function MetaCell({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <View className="flex-1 px-3 py-2.5">
      <View className="flex-row items-center" style={{ gap: 5 }}>
        <Icon size={11} color={COLORS.muted} />
        <Text className="text-muted text-[10.5px] font-bold uppercase" style={{ letterSpacing: 0.4 }}>
          {label}
        </Text>
      </View>
      <Text className="text-[13px] font-bold text-fg mt-0.5" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Loading placeholder shaped like the loaded screen, with a working back button. */
function StartSessionSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-1 bg-bg">
      <VisitHeader title="Verify patient OTP" step={1} onBack={onBack} />
      <View className="px-3.5 pt-3.5" style={{ gap: 12 }}>
        <VisitCard>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Skeleton width={52} height={52} radius={16} />
            <View className="flex-1" style={{ gap: 7 }}>
              <Skeleton width="55%" height={16} />
              <Skeleton width="80%" height={12} />
            </View>
          </View>
          <View className="mt-3">
            <Skeleton height={52} radius={12} />
          </View>
        </VisitCard>
        <VisitCard>
          <View style={{ gap: 12 }}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="85%" height={12} />
            <View className="flex-row mt-2" style={{ gap: 8 }}>
              {Array.from({ length: OTP_CONFIG.sessionOtpLength }).map((_, i) => (
                <View key={i} className="flex-1">
                  <Skeleton height={52} radius={12} />
                </View>
              ))}
            </View>
          </View>
        </VisitCard>
      </View>
    </View>
  );
}

/** Shown when the detail fetch actually failed rather than merely being slow. */
function StartSessionError({ onRetry, onBack }: { onRetry: () => void; onBack: () => void }) {
  return (
    <View className="flex-1 bg-bg">
      <VisitHeader title="Verify patient OTP" step={1} onBack={onBack} />
      <View className="flex-1 items-center justify-center px-8" style={{ gap: 12 }}>
        <Text className="text-[15px] font-bold text-fg text-center">Couldn&apos;t load this appointment</Text>
        <Text className="text-muted text-[12.5px] text-center leading-5">
          The session can&apos;t be started until we can reach the server. This is usually temporary.
        </Text>
        <View className="flex-row" style={{ gap: 8 }}>
          <Button variant="secondary" fullWidth={false} onPress={onRetry}>
            <Text className="text-accent font-bold text-[13px]">Try again</Text>
          </Button>
          <Button variant="secondary" fullWidth={false} onPress={onBack}>
            <Text className="text-accent font-bold text-[13px]">Go back</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
