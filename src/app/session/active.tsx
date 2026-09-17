import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Modal, ActivityIndicator, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView } from "expo-camera";
import * as Crypto from "expo-crypto";
import Svg, { Circle } from "react-native-svg";
import {
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  ClipboardCheck,
  Image as ImageIcon,
  NotebookPen,
  Pause,
  X,
} from "lucide-react-native";
import { Badge, BottomSheet, Button, ErrorState, useBottomSheet } from "@/components/ui";
import { SectionLabel, VisitCard, VisitFooter, VisitHeader } from "@/components/session/VisitFlow";
import { useAppStore } from "@/lib/stores/app.store";
import { useSessionStore } from "@/lib/stores/session.store";
import { useCamera } from "@/lib/hooks/useCamera";
import { useDatabase } from "@/lib/db/provider";
import { enqueuePhotoUpload } from "@/lib/db/repositories";
import { flushPendingPhotoUploads } from "@/lib/db/sync/syncEngine";
import { COLORS, SESSION_CONFIG } from "@/constants/config";
import { formatTime } from "@/lib/utils/format";

/**
 * Step 3 of the visit — run the treatment.
 *
 * Reached by *replacing* the OTP screen once the code is verified. The timer lives in the header
 * so it stays visible while the checklist scrolls, and the one forward action — on to the
 * treatment record — is pinned in the footer. The chips beside the timer are derived from the
 * checklist and the note; they used to be hardcoded ("Photo · 1 needed", "Note · Draft") and
 * never changed, whatever the therapist did.
 */
export default function ActiveSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  // Selectors, not a bare `useSessionStore()` — this screen must not re-subscribe to
  // `elapsedSeconds`, or the once-a-second `tick()` re-renders the checklist, note input, and
  // buttons along with the ring. Only <SessionTimerRing> below selects elapsedSeconds.
  const patientName = useSessionStore((s) => s.patientName);
  const condition = useSessionStore((s) => s.condition);
  const checklist = useSessionStore((s) => s.checklist);
  const toggleChecklistItem = useSessionStore((s) => s.toggleChecklistItem);
  const quickNote = useSessionStore((s) => s.quickNote);
  const setQuickNote = useSessionStore((s) => s.setQuickNote);
  const tick = useSessionStore((s) => s.tick);
  const endSession = useSessionStore((s) => s.endSession);
  // Only flips twice per session lifecycle — safe to subscribe to directly.
  const isActive = useSessionStore((s) => s.isActive);
  const sheet = useBottomSheet();
  const { db } = useDatabase();
  const { cameraRef, ensurePermission, takePhoto } = useCamera();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cameraPermissionBlocked, setCameraPermissionBlocked] = useState(false);

  useEffect(() => {
    // This screen stays mounted underneath /session/treatment and /session/complete. Gating on
    // isActive stops the interval the moment the session ends, so it can't re-persist a stale
    // "active" draft over the completed row.
    if (!isActive) return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [tick, isActive]);

  const handleOpenCamera = async () => {
    const status = await ensurePermission();
    if (!status.granted) {
      // canAskAgain === false means the OS won't prompt again — a toast would leave the therapist
      // re-tapping a button that can never succeed.
      if (!status.canAskAgain) {
        setCameraPermissionBlocked(true);
      } else {
        showToast("Camera permission required");
      }
      return;
    }
    setCameraPermissionBlocked(false);
    setCameraReady(false);
    setCameraVisible(true);
  };

  const handleCapturePhoto = async () => {
    if (!cameraReady) {
      showToast("Camera is still starting");
      return;
    }
    setUploadingPhoto(true);
    try {
      const photoUri = await takePhoto();
      if (!photoUri) {
        showToast("Failed to capture photo");
        return;
      }
      const sessionId = useSessionStore.getState().sessionId;
      if (!sessionId || !db) {
        showToast("No active session");
        return;
      }
      const fileName = `session-${sessionId}-${Date.now()}.jpg`;
      // Durable the moment this returns: the photo is already compressed and on-device, and the
      // queue row means the sync engine will upload it even if we're offline right now.
      await enqueuePhotoUpload(db, {
        id: Crypto.randomUUID(),
        sessionId,
        localUri: photoUri,
        fileName,
        mimeType: "image/jpeg",
      });
      if (!checklist.find((item) => item.id === "photo")?.done) {
        toggleChecklistItem("photo");
      }
      setCameraVisible(false);
      showToast("Photo saved — uploading", "success");
      flushPendingPhotoUploads(db).catch(() => {});
    } catch (e) {
      console.error("Photo capture failed:", e);
      showToast("Couldn't save photo. Try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const confirmPause = () => {
    sheet.close();
    endSession();
    showToast("Session paused — support notified");
    setTimeout(() => router.replace("/(app)/appointments"), 500);
  };

  const doneCount = checklist.filter((c) => c.done).length;
  const allDone = doneCount === checklist.length;
  const photoTaken = !!checklist.find((c) => c.id === "photo")?.done;
  const hasNote = quickNote.trim().length > 0;

  return (
    <View className="flex-1 bg-bg">
      <VisitHeader
        title="Run treatment"
        step={2}
        onBack={() => router.back()}
        right={
          <View
            className="flex-row items-center rounded-full bg-white/15 border border-white/20 px-2.5 py-1.5"
            style={{ gap: 6 }}
          >
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? COLORS.successLight : COLORS.warning }} />
            <Text className="text-white text-[11px] font-extrabold uppercase">{isActive ? "Live" : "Paused"}</Text>
          </View>
        }
      >
        <View
          className="mx-3.5 mb-4 rounded-lg bg-white/10 border border-white/15 p-3 flex-row items-center"
          style={{ gap: 14 }}
        >
          <SessionTimerRing />
          <View className="flex-1">
            <Text className="text-white text-[16px] font-extrabold" numberOfLines={1}>
              {patientName ?? "Patient"}
            </Text>
            <Text className="text-white/70 text-[12px] mt-0.5" numberOfLines={1}>
              {condition ?? "Therapy session"}
            </Text>
            <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
              <StatusChip label="OTP verified" done />
              <StatusChip label={photoTaken ? "Photo added" : "Photo needed"} done={photoTaken} />
              <StatusChip label={hasNote ? "Note added" : "No note yet"} done={hasNote} />
            </View>
          </View>
        </View>
      </VisitHeader>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
      >
        <View className="flex-row items-center justify-between mt-4 mb-2 px-1">
          <Text className="text-[11.5px] font-extrabold text-muted uppercase" style={{ letterSpacing: 0.8 }}>
            Treatment checklist
          </Text>
          <Badge variant={allDone ? "success" : "warning"} size="sm">
            {`${doneCount}/${checklist.length} done`}
          </Badge>
        </View>
        {/* The fastest read of "how far through am I". */}
        <View className="h-1.5 rounded-full overflow-hidden mb-2.5" style={{ backgroundColor: "rgba(0,64,96,0.1)" }}>
          <View
            className="h-full rounded-full"
            style={{ width: `${(doneCount / Math.max(checklist.length, 1)) * 100}%`, backgroundColor: COLORS.success }}
          />
        </View>
        <VisitCard padded={false} className="px-4 py-1">
          {checklist.map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => toggleChecklistItem(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.done }}
              className={`flex-row items-center py-3.5 active:opacity-70 ${i === checklist.length - 1 ? "" : "border-b border-border"}`}
              style={{ gap: 12 }}
            >
              <View
                className="w-6 h-6 rounded-[7px] items-center justify-center"
                style={{
                  backgroundColor: item.done ? COLORS.success : "transparent",
                  borderWidth: item.done ? 0 : 2,
                  borderColor: COLORS.border,
                }}
              >
                {item.done && <Check size={14} color="#fff" strokeWidth={3} />}
              </View>
              <Text className={`flex-1 text-[14px] font-semibold ${item.done ? "text-muted line-through" : "text-fg"}`}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </VisitCard>

        {cameraPermissionBlocked && (
          <View className="mt-3">
            <ErrorState
              icon={CameraOff}
              tone="warning"
              title="Camera access denied"
              badge="Permission"
              description="Camera permission is required to upload session photos. Enable it in your device settings to continue."
              action={{ label: "Open app settings", onPress: () => Linking.openSettings() }}
            />
          </View>
        )}

        <SectionLabel>Capture</SectionLabel>
        <View className="flex-row" style={{ gap: 10 }}>
          <Pressable
            onPress={handleOpenCamera}
            disabled={uploadingPhoto}
            accessibilityRole="button"
            className="flex-1 rounded-lg border border-border bg-white p-3.5 active:opacity-80"
            style={{ gap: 8, shadowColor: COLORS.nav, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 }}
          >
            <View
              className="w-10 h-10 rounded-[12px] items-center justify-center"
              style={{ backgroundColor: photoTaken ? "rgba(35,145,73,0.1)" : COLORS.primarySoft }}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : photoTaken ? (
                <ImageIcon size={19} color={COLORS.success} />
              ) : (
                <Camera size={19} color={COLORS.accent} />
              )}
            </View>
            <View>
              <Text className="text-[13.5px] font-bold text-fg">{photoTaken ? "Add another photo" : "Session photo"}</Text>
              <Text className="text-muted text-[11.5px]">{photoTaken ? "Saved to this visit" : "Tap to open the camera"}</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push("/session/treatment")}
            accessibilityRole="button"
            className="flex-1 rounded-lg border border-border bg-white p-3.5 active:opacity-80"
            style={{ gap: 8, shadowColor: COLORS.nav, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 }}
          >
            <View className="w-10 h-10 rounded-[12px] items-center justify-center" style={{ backgroundColor: COLORS.primarySoft }}>
              <ClipboardCheck size={19} color={COLORS.accent} />
            </View>
            <View>
              <Text className="text-[13.5px] font-bold text-fg">Assessment</Text>
              <Text className="text-muted text-[11.5px]">Filled in the treatment record</Text>
            </View>
          </Pressable>
        </View>

        <SectionLabel>Quick note</SectionLabel>
        <VisitCard padded={false} className="p-3">
          <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
            <NotebookPen size={14} color={COLORS.muted} />
            <Text className="text-muted text-[11.5px]">Anything to remember for the record.</Text>
          </View>
          <TextInput
            className="min-h-[96px] w-full rounded-[12px] px-3.5 py-2.5 text-[14px] text-fg"
            style={{ backgroundColor: COLORS.bg }}
            placeholder="e.g. L4-L5 mobilisation done. Pain 7→4. Responded well to traction…"
            placeholderTextColor={COLORS.muted}
            value={quickNote}
            onChangeText={setQuickNote}
            multiline
            textAlignVertical="top"
          />
        </VisitCard>
      </ScrollView>

      <VisitFooter hint={allDone ? "Checklist done — complete the treatment record to finish." : undefined}>
        <Button variant="danger" fullWidth={false} style={{ flex: 1 }} onPress={sheet.open}>
          <Pause size={16} color={COLORS.danger} />
          <Text className="text-danger font-bold text-[14px]">Pause</Text>
        </Button>
        <Button variant="success" fullWidth={false} style={{ flex: 2.2 }} onPress={() => router.push("/session/treatment")}>
          <Text className="text-white font-bold text-[14px]">Treatment record</Text>
          <ArrowRight size={16} color="#fff" />
        </Button>
      </VisitFooter>

      <BottomSheet visible={sheet.visible} onClose={sheet.close}>
        <Text className="text-[18px] font-bold text-fg">Pause this session?</Text>
        <Text className="text-muted text-[13px]">
          Use only for patient cancellation, safety concern, or emergency. The appointment will be flagged for support review. Session time is preserved.
        </Text>
        <Button variant="danger" onPress={confirmPause}>
          <Text className="text-danger font-bold text-[14px]">Pause session</Text>
        </Button>
        <Button variant="secondary" onPress={sheet.close}>
          Continue treatment
        </Button>
      </BottomSheet>

      <Modal visible={cameraVisible} animationType="slide" onRequestClose={() => setCameraVisible(false)} statusBarTranslucent>
        <View className="flex-1 bg-black">
          <CameraView
            ref={cameraRef}
            facing="back"
            mode="picture"
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => showToast("Camera failed to start")}
            style={{ flex: 1 }}
          />
          <View
            className="absolute left-0 right-0 top-0 px-4 flex-row justify-between items-center"
            style={{ paddingTop: insets.top + 8 }}
          >
            <Pressable onPress={() => setCameraVisible(false)} className="w-11 h-11 rounded-full bg-black/50 items-center justify-center">
              <X size={22} color="#fff" />
            </Pressable>
            <View className="rounded-full bg-black/50 px-3 py-1.5 flex-row items-center" style={{ gap: 6 }}>
              <View className={`w-2 h-2 rounded-full ${cameraReady ? "bg-success" : "bg-warning"}`} />
              <Text className="text-white text-[12px] font-bold">{cameraReady ? "Ready" : "Starting camera…"}</Text>
            </View>
          </View>
          <View
            className="absolute left-0 right-0 bottom-0 items-center bg-black/50"
            style={{ paddingBottom: insets.bottom + 24, paddingTop: 20 }}
          >
            <Text className="text-white/70 text-[12px] mb-4">Frame the treatment area, then tap to capture</Text>
            <Pressable
              onPress={handleCapturePhoto}
              disabled={!cameraReady || uploadingPhoto}
              className="w-[76px] h-[76px] rounded-full items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.28)", opacity: !cameraReady || uploadingPhoto ? 0.5 : 1 }}
            >
              <View className="w-[62px] h-[62px] rounded-full bg-white items-center justify-center">
                {uploadingPhoto ? (
                  <ActivityIndicator color={COLORS.accent} />
                ) : (
                  <View className="w-[52px] h-[52px] rounded-full border-2 border-black/10" style={{ backgroundColor: "#fff" }} />
                )}
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Isolated so the once-a-second tick only re-renders this ring, not the whole screen. */
function SessionTimerRing() {
  const elapsedSeconds = useSessionStore((s) => s.elapsedSeconds);
  const size = 92;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const progress = Math.min(elapsedSeconds / SESSION_CONFIG.defaultDurationSec, 1);
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - progress);

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLORS.successLight}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </Svg>
      <Text className="text-[17px] font-extrabold text-white" style={{ fontFamily: "monospace" }}>
        {formatTime(elapsedSeconds)}
      </Text>
      <Text className="text-white/60 text-[9px] font-bold uppercase">elapsed</Text>
    </View>
  );
}

function StatusChip({ label, done }: { label: string; done?: boolean }) {
  return (
    <View
      className="flex-row items-center rounded-full px-2 py-1"
      style={{ gap: 4, backgroundColor: done ? "rgba(52,158,84,0.3)" : "rgba(255,255,255,0.12)" }}
    >
      {done ? <Check size={10} color="#fff" strokeWidth={3} /> : <View className="w-1.5 h-1.5 rounded-full bg-white/60" />}
      <Text className="text-white text-[10.5px] font-bold">{label}</Text>
    </View>
  );
}
