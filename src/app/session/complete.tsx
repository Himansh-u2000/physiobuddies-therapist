import { useEffect, useState } from "react";
import { View, Text, ScrollView, BackHandler } from "react-native";
import { useRouter } from "expo-router";
import { CalendarClock, Check, CircleCheckBig, House, Timer, UserRound } from "lucide-react-native";
import { Avatar, Button } from "@/components/ui";
import { SectionLabel, VisitCard, VisitFooter, VisitHeader } from "@/components/session/VisitFlow";
import { useSessionStore } from "@/lib/stores/session.store";
import { COLORS } from "@/constants/config";
import { formatTime, getSessionTypeLabel } from "@/lib/utils/format";

/**
 * The end of the visit.
 *
 * Everything shown is what this device actually knows about the session that just finished.
 * The previous version was largely invented — "Session #14", "Today · 10:30 – 11:15 AM",
 * "Lumbar assessment + manual therapy", a ₹1,200 payout "queued" to "HDFC ending 2041", and a
 * list of things "taken care of" (follow-up scheduled, patient notified, two photos uploaded)
 * that nothing had checked. A therapist reading that would reasonably believe a payment and a
 * follow-up existed. Payout amounts live on the Earnings screen, which reads the real ledger.
 */
export default function SessionCompleteScreen() {
  const router = useRouter();
  const reset = useSessionStore((s) => s.reset);
  // Snapshot at mount, not a live subscription — the store is reset below as soon as this screen
  // is reached (the data is already durable in SQLite by now), and this screen needs to keep
  // showing it regardless of which exit the therapist takes.
  const [snap] = useState(() => {
    const s = useSessionStore.getState();
    return {
      patientName: s.patientName,
      patientId: s.patientId,
      condition: s.condition,
      type: s.type,
      elapsedSeconds: s.elapsedSeconds,
      startedAt: s.startedAt,
      checklistDone: s.checklist.filter((c) => c.done).length,
      checklistTotal: s.checklist.length,
      photoTaken: !!s.checklist.find((c) => c.id === "photo")?.done,
    };
  });

  useEffect(() => {
    reset();
  }, [reset]);

  // The finished visit's screens are still on the stack underneath (this screen replaced the
  // treatment form, which sits on the run-treatment screen). Android's back button would land on
  // a "Run treatment" screen for a session that has already ended — send it home instead.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/(app)");
      return true;
    });
    return () => sub.remove();
  }, [router]);

  const safeName = snap.patientName ?? "Patient";
  const endedAt = new Date();
  const startedAt = snap.startedAt ? new Date(snap.startedAt) : null;
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const timeRange = startedAt
    ? `${startedAt.toLocaleTimeString("en-IN", timeFmt)} – ${endedAt.toLocaleTimeString("en-IN", timeFmt)}`
    : endedAt.toLocaleTimeString("en-IN", timeFmt);

  return (
    <View className="flex-1 bg-bg">
      <VisitHeader title="Visit complete" step={4}>
        <View className="items-center pb-6 px-6">
          <View className="w-[76px] h-[76px] rounded-full items-center justify-center bg-white/15 border-2 border-white/30">
            <View className="w-14 h-14 rounded-full items-center justify-center" style={{ backgroundColor: COLORS.successLight }}>
              <Check size={30} color="#fff" strokeWidth={3} />
            </View>
          </View>
          <Text className="text-white text-[22px] font-black mt-3">Great work!</Text>
          <Text className="text-white/75 text-[13px] text-center mt-1 leading-5">
            {safeName}&apos;s treatment record is saved and this visit is marked complete.
          </Text>
        </View>
      </VisitHeader>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 24 }}>
        <VisitCard padded={false}>
          <View className="flex-row items-center p-4 border-b border-border" style={{ gap: 12 }}>
            <Avatar name={safeName} size={50} radius={15} />
            <View className="flex-1">
              <Text className="text-[16px] font-extrabold text-fg">{safeName}</Text>
              <Text className="text-muted text-[12px] mt-0.5" numberOfLines={1}>
                {snap.condition ?? "Therapy session"}
              </Text>
            </View>
            <View className="flex-row items-center rounded-full px-2.5 py-1 bg-success/10" style={{ gap: 4 }}>
              <CircleCheckBig size={12} color={COLORS.success} />
              <Text className="text-success text-[11px] font-bold">Done</Text>
            </View>
          </View>
          <View className="flex-row flex-wrap p-2">
            <Stat icon={Timer} label="Duration" value={formatTime(snap.elapsedSeconds)} mono />
            <Stat icon={CalendarClock} label="Today" value={timeRange} />
            <Stat icon={House} label="Visit type" value={getSessionTypeLabel(snap.type)} />
            <Stat
              icon={Check}
              label="Checklist"
              value={`${snap.checklistDone}/${snap.checklistTotal} steps`}
            />
          </View>
        </VisitCard>

        <SectionLabel>What happened</SectionLabel>
        <VisitCard className="py-1">
          <Milestone done title="Assessment saved" sub="Stored on this device and sent to the patient's treatment plan." />
          <Milestone done title="Visit marked complete" sub="If you're offline, it syncs automatically once you reconnect." />
          <Milestone
            done={snap.photoTaken}
            title={snap.photoTaken ? "Session photo captured" : "No session photo"}
            sub={snap.photoTaken ? "Uploads in the background." : "You can attach photos to the next visit."}
            last
          />
        </VisitCard>

        <Text className="text-muted text-[11.5px] text-center mt-4 px-4">
          Earnings for this visit appear on the Earnings screen once the payment is settled.
        </Text>
      </ScrollView>

      <VisitFooter>
        {snap.patientId ? (
          <Button
            variant="secondary"
            fullWidth={false}
            style={{ flex: 1 }}
            onPress={() => router.replace({ pathname: "/patient/[id]", params: { id: snap.patientId! } })}
          >
            <UserRound size={16} color={COLORS.accent} />
            <Text className="text-accent font-bold text-[14px]">Patient</Text>
          </Button>
        ) : (
          <Button variant="secondary" fullWidth={false} style={{ flex: 1 }} onPress={() => router.replace("/(app)/appointments")}>
            <Text className="text-accent font-bold text-[14px]">Appointments</Text>
          </Button>
        )}
        <Button fullWidth={false} style={{ flex: 1.6 }} onPress={() => router.replace("/(app)")}>
          <House size={16} color="#fff" />
          <Text className="text-white font-bold text-[14px]">Back to home</Text>
        </Button>
      </VisitFooter>
    </View>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View className="w-1/2 p-2">
      <View className="rounded-[12px] p-3" style={{ backgroundColor: COLORS.bg }}>
        <View className="flex-row items-center" style={{ gap: 5 }}>
          <Icon size={12} color={COLORS.muted} />
          <Text className="text-muted text-[10.5px] font-bold uppercase" style={{ letterSpacing: 0.4 }}>
            {label}
          </Text>
        </View>
        <Text
          className="text-[14px] font-extrabold text-fg mt-1"
          numberOfLines={1}
          style={mono ? { fontFamily: "monospace" } : undefined}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function Milestone({ title, sub, done, last }: { title: string; sub: string; done: boolean; last?: boolean }) {
  return (
    <View className={`flex-row py-3 ${last ? "" : "border-b border-border"}`} style={{ gap: 12 }}>
      <View
        className="w-7 h-7 rounded-full items-center justify-center"
        style={{ backgroundColor: done ? COLORS.success : COLORS.bg }}
      >
        {done ? <Check size={14} color="#fff" strokeWidth={3} /> : <View className="w-2 h-2 rounded-full bg-muted/40" />}
      </View>
      <View className="flex-1">
        <Text className="text-[13.5px] font-bold text-fg">{title}</Text>
        <Text className="text-muted text-[12px] mt-0.5">{sub}</Text>
      </View>
    </View>
  );
}
