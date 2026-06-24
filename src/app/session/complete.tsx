import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle2 } from "lucide-react-native";
import { Avatar, Button } from "@/components/ui";
import { useSessionStore } from "@/lib/stores/session.store";
import { COLORS } from "@/constants/config";
import { formatTime } from "@/lib/utils/format";

export default function SessionCompleteScreen() {
  const router = useRouter();
  const { patientName, condition, elapsedSeconds, reset } = useSessionStore();

  const handleDone = () => {
    reset();
    router.replace("/(app)");
  };

  const safeName = patientName ?? "Patient";

  return (
    <View className="flex-1 bg-bg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
        <LinearGradient colors={["#003554", "#006071"]} className="pt-12 pb-16 px-6 items-center relative overflow-hidden">
          <View className="absolute inset-0 opacity-5" style={{ backgroundColor: "white" }} />
          <View className="w-[72px] h-[72px] rounded-full bg-white/15 border-2 border-white/30 items-center justify-center mb-4">
            <CheckCircle2 size={36} color="#fff" />
          </View>
          <Text className="text-white text-[22px] font-black tracking-tight">Session completed!</Text>
          <Text className="text-white/70 text-[13px] text-center mt-1.5 leading-5">
            Treatment record submitted. Patient history,{"\n"}attachments, and payout are all updated.
          </Text>
        </LinearGradient>

        <View className="mx-4 -mt-7 bg-surface-strong rounded-lg border-[1.5px] border-border overflow-hidden relative z-10" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.12, shadowRadius: 28, elevation: 6 }}>
          <View className="flex-row items-center p-4 border-b border-border" style={{ gap: 12 }}>
            <Avatar name={safeName} size={52} radius={26} />
            <View className="flex-1">
              <Text className="text-[15px] font-extrabold text-fg">{safeName}</Text>
              <Text className="text-muted text-[12px]">Session #14 · Home visit</Text>
            </View>
            <Text className="text-success text-[11px] font-bold bg-success/10 px-2 py-1 rounded-full">Done</Text>
          </View>
          <SummaryRow label="Date & time" value="Today · 10:30 – 11:15 AM" />
          <SummaryRow label="Duration" value={formatTime(elapsedSeconds)} mono />
          <SummaryRow label="Treatment" value={`Lumbar assessment + manual therapy`} />
          <SummaryRow label="Follow-up" value="In 3–4 days · Clinic visit" last />
        </View>

        <LinearGradient colors={["#138840", "#239149"]} className="mx-4 mt-3.5 rounded-lg p-4 flex-row items-center justify-between overflow-hidden">
          <View>
            <Text className="text-white/75 text-[12px] mb-1">Session payout queued</Text>
            <Text className="text-white text-[26px] font-black" style={{ fontFamily: "monospace" }}>₹1,200</Text>
          </View>
          <Text className="text-[28px]">💸</Text>
        </LinearGradient>

        <View className="mx-4 mt-3.5 bg-surface-strong rounded-md border-[1.5px] border-border overflow-hidden">
          <View className="px-4 py-3 border-b border-border">
            <Text className="text-[13px] font-extrabold text-fg">Everything's taken care of</Text>
          </View>
          <Milestone title="Patient record updated" sub="Treatment details, assessment notes, and prescribed exercises saved to patient history." />
          <Milestone title="Payout queued — ₹1,200" sub="Will be included in Monday's weekly settlement to HDFC ending 2041." />
          <Milestone title="Follow-up scheduled" sub="Reminder set for next appointment. Patient has been notified." />
          <Milestone title="Session photos uploaded" sub="2 assessment photos saved to the patient file." last />
        </View>

        <View className="mx-4 mt-4" style={{ gap: 10 }}>
          <Text className="text-[13px] font-bold text-muted uppercase tracking-wide">What's next</Text>
          <Button variant="secondary" onPress={() => router.replace("/(app)/patients")}>
            <Text className="text-accent font-bold text-[14px]">View {safeName.split(" ")[0]}'s full profile</Text>
          </Button>
          <Button variant="secondary" onPress={() => router.replace("/(app)/appointments")}>
            <Text className="text-accent font-bold text-[14px]">Back to appointments</Text>
          </Button>
          <Button onPress={handleDone}>
            <Text className="text-white font-bold text-[14px]">Return to dashboard</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

function SummaryRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <View className={`flex-row items-center justify-between px-4 py-3 ${last ? "" : "border-b border-border"}`}>
      <Text className="text-muted text-[12px]">{label}</Text>
      <Text className={`text-[13px] font-bold text-fg ${mono ? "" : ""}`} style={mono ? { fontFamily: "monospace" } : undefined}>{value}</Text>
    </View>
  );
}

function Milestone({ title, sub, last }: { title: string; sub: string; last?: boolean }) {
  return (
    <View className={`flex-row p-3.5 ${last ? "" : "border-b border-border"}`} style={{ gap: 12 }}>
      <View className="w-8 h-8 rounded-full bg-success items-center justify-center flex-shrink-0">
        <Text className="text-white text-[14px] font-bold">✓</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[13px] font-bold text-fg">{title}</Text>
        <Text className="text-muted text-[12px] mt-0.5">{sub}</Text>
      </View>
    </View>
  );
}
