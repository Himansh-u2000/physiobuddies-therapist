import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { Camera, FileText, Pause, CheckCircle2, Circle as CircleIcon } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { Chip, Button, BottomSheet, useBottomSheet } from "@/components/ui";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { useSessionStore } from "@/lib/stores/session.store";
import { useCamera } from "@/lib/hooks/useCamera";
import { COLORS, SESSION_CONFIG } from "@/constants/config";
import { formatTime } from "@/lib/utils/format";

export default function ActiveSessionScreen() {
  const router = useRouter();
  const therapist = useAuthStore((s) => s.therapist);
  const showToast = useAppStore((s) => s.showToast);
  const { patientName, condition, elapsedSeconds, checklist, toggleChecklistItem, quickNote, setQuickNote, tick, endSession } = useSessionStore();
  const sheet = useBottomSheet();
  const { ensurePermission, takePhoto } = useCamera();
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      tick();
      forceUpdate((n) => n + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [tick]);

  const handleUploadPhoto = async () => {
    const granted = await ensurePermission();
    if (!granted) {
      showToast("Camera permission required");
      return;
    }
    showToast("Camera opened for session photo");
  };

  const handlePause = () => {
    sheet.open();
  };

  const confirmPause = () => {
    sheet.close();
    endSession();
    showToast("Session paused — support notified");
    setTimeout(() => router.replace("/(app)/appointments"), 500);
  };

  const doneCount = checklist.filter((c) => c.done).length;
  const progress = Math.min(elapsedSeconds / SESSION_CONFIG.defaultDurationSec, 1);
  const circumference = 2 * Math.PI * 60;
  const dashOffset = circumference * (1 - progress);

  return (
    <View className="flex-1 bg-bg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-3.5 pt-3 pb-8">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-[20px] font-extrabold text-fg">Active session</Text>
          <Chip variant="active">● Running</Chip>
        </View>

        <LinearGradient colors={["#00486b", "#006071"]} className="rounded-md p-5 items-center" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.28, shadowRadius: 32, elevation: 10 }}>
          <View className="relative items-center justify-center mb-3.5">
            <Svg width={140} height={140} style={{ transform: [{ rotate: "-90deg" }] }}>
              <Circle cx={70} cy={70} r={60} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={8} />
              <Circle
                cx={70}
                cy={70}
                r={60}
                fill="none"
                stroke={COLORS.successLight}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </Svg>
            <View className="absolute items-center">
              <Text className="text-[22px] font-extrabold text-white" style={{ fontFamily: "monospace" }}>{formatTime(elapsedSeconds)}</Text>
              <Text className="text-white/60 text-[10px] font-bold">elapsed</Text>
            </View>
          </View>
          <Text className="text-white text-[18px] font-bold">{patientName}</Text>
          <Text className="text-white/70 text-[12px] mt-1">{condition} · Home visit</Text>
          <View className="flex-row mt-3.5" style={{ gap: 6 }}>
            <StatusBadge label="OTP" sub="Verified" active />
            <StatusBadge label="Care" sub="Active" active />
            <StatusBadge label="Photo" sub="1 needed" />
            <StatusBadge label="Note" sub="Draft" />
          </View>
        </LinearGradient>

        <View className="mt-2.5">
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="text-[17px] font-bold text-fg">Treatment checklist</Text>
            <Chip variant={doneCount === checklist.length ? "active" : "pending"}>{doneCount}/{checklist.length} done</Chip>
          </View>
          <View style={{ gap: 8 }}>
            {checklist.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => toggleChecklistItem(item.id)}
                className={`flex-row items-center justify-between p-3 rounded-md border ${item.done ? "bg-success/5 border-success/10" : "bg-white border-border"}`}
                style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
              >
                <View className="flex-row items-center flex-1" style={{ gap: 8 }}>
                  {item.done ? <CheckCircle2 size={16} color={COLORS.success} /> : <CircleIcon size={16} color={COLORS.muted} />}
                  <Text className={`text-[13px] font-semibold ${item.done ? "text-muted line-through" : "text-fg"}`}>{item.label}</Text>
                </View>
                <View className={`w-5 h-5 rounded border-2 ${item.done ? "bg-success border-success" : "border-border"}`}>
                  {item.done && <Text className="text-white text-[12px] text-center font-bold">✓</Text>}
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mt-3" style={{ gap: 10 }}>
          <View>
            <Text className="text-[12px] font-bold text-fg mb-1.5">Quick session note</Text>
            <TextInput
              className="min-h-[88px] w-full rounded-[13px] border-[1.5px] border-border bg-white px-3.5 py-2.5 text-[14px] text-fg"
              placeholder="L4-L5 mobilisation done. Pain scale improved 7→4. Patient responded well to traction…"
              placeholderTextColor={COLORS.muted}
              value={quickNote}
              onChangeText={setQuickNote}
              multiline
              textAlignVertical="top"
            />
          </View>
          <View className="flex-row" style={{ gap: 10 }}>
            <Button variant="secondary" onPress={handleUploadPhoto}>
              <Camera size={16} color={COLORS.accent} />
              <Text className="text-accent font-bold text-[14px]">Upload photo</Text>
            </Button>
            <Button onPress={() => router.push("/session/treatment")}>
              <FileText size={16} color="#fff" />
              <Text className="text-white font-bold text-[14px]">End & document</Text>
            </Button>
          </View>
          <Button variant="danger" onPress={handlePause}>
            <Pause size={16} color={COLORS.danger} />
            <Text className="text-danger font-bold text-[14px]">Pause / Emergency stop</Text>
          </Button>
        </View>
      </ScrollView>

      <BottomSheet visible={sheet.visible} onClose={sheet.close}>
        <Text className="text-[18px] font-bold text-fg">Pause this session?</Text>
        <Text className="text-muted text-[13px]">
          Use only for patient cancellation, safety concern, or emergency. The appointment will be flagged for support review. Session time is preserved.
        </Text>
        <Button variant="danger" onPress={confirmPause}>
          <Text className="text-danger font-bold text-[14px]">Pause session</Text>
        </Button>
        <Button variant="secondary" onPress={sheet.close}>Continue treatment</Button>
      </BottomSheet>
    </View>
  );
}

function StatusBadge({ label, sub, active }: { label: string; sub: string; active?: boolean }) {
  return (
    <View className={`flex-1 rounded-[10px] py-2 items-center ${active ? "bg-white/20 border border-white/25" : "bg-white/10"}`}>
      <Text className="text-white text-[13px] font-bold">{label}</Text>
      <Text className="text-white/70 text-[10px]">{sub}</Text>
    </View>
  );
}
