import { useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Plus, X, Upload, Save, CheckCircle2 } from "lucide-react-native";
import { Avatar, Chip, Button, TextArea, Input, BottomSheet, useBottomSheet } from "@/components/ui";
import { useSessionStore } from "@/lib/stores/session.store";
import { useAppStore } from "@/lib/stores/app.store";
import { sessionApi, treatmentApi } from "@/lib/api/services";
import { COLORS } from "@/constants/config";

const PAIN_REGIONS = ["Lower back", "Upper back", "Neck", "Left shoulder", "Right shoulder", "Left knee", "Right knee", "Hip", "Ankle", "Wrist"];
const ASSESSMENT_TYPES = [
  { type: "rom", label: "📐 ROM Limited" },
  { type: "slr", label: "🦵 SLR+" },
  { type: "spasm", label: "💪 Spasm" },
  { type: "weakness", label: "⚡ Weakness" },
  { type: "swelling", label: "🔴 Swelling" },
  { type: "tenderness", label: "👆 Tenderness" },
];
const TREATMENT_TYPES = [
  { type: "mobilisation", label: "🤲 Mobilisation" },
  { type: "manipulation", label: "🔧 Manipulation" },
  { type: "tens", label: "⚡ TENS" },
  { type: "heat", label: "🔥 Heat" },
  { type: "massage", label: "💆 Massage" },
  { type: "taping", label: "🩹 Taping" },
  { type: "ultrasound", label: "🔊 Ultrasound" },
  { type: "exercise", label: "🏋️ Exercise Therapy" },
];
const EXERCISE_OPTIONS = ["Cat-Camel Stretch", "Knee-to-Chest", "Pelvic Tilt", "Bridges", "Bird-Dog", "McKenzie Extension", "Clamshell", "Wall Sit", "SLR", "Plank"];

export default function TreatmentFormScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const { sessionId, appointmentId, patientName, condition, elapsedSeconds, checklist, quickNote } = useSessionStore();
  const safeName = patientName ?? "Patient";
  const safeCondition = condition ?? "condition";
  const sheet = useBottomSheet();

  const [chiefComplaint, setChiefComplaint] = useState(`Chronic ${safeCondition.toLowerCase()} for 6 months. Worsens after prolonged sitting. L4-L5 disc bulge on MRI.`);
  const [painRegions, setPainRegions] = useState<string[]>(["Lower back"]);
  const [painScale, setPainScale] = useState(7);
  const [assessments, setAssessments] = useState<string[]>(["rom", "slr", "spasm"]);
  const [treatments, setTreatments] = useState<string[]>(["mobilisation", "tens", "massage"]);
  const [exercises, setExercises] = useState([
    { name: "Cat-Camel Stretch", reps: 10, sets: 2 },
    { name: "Knee-to-Chest", reps: 15, sets: 2 },
    { name: "Pelvic Tilt", reps: 15, sets: 3 },
  ]);
  const [clinicalNotes, setClinicalNotes] = useState("Patient responded well, reported 30% relief post-session. Anterior pelvic tilt observed — consider core strengthening focus next visit.");
  const [precautions, setPrecautions] = useState("Avoid forward bending, prolonged sitting. Use lumbar roll.");
  const [followUpRequired, setFollowUpRequired] = useState(true);
  const [followUpDate, setFollowUpDate] = useState("In 3–4 days — Jun 21, 2026");
  const [submitting, setSubmitting] = useState(false);

  const togglePainRegion = (region: string) => {
    setPainRegions((prev) => prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]);
  };
  const toggleAssessment = (type: string) => {
    setAssessments((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  };
  const toggleTreatment = (type: string) => {
    setTreatments((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  };
  const addExercise = () => setExercises((prev) => [...prev, { name: EXERCISE_OPTIONS[0], reps: 10, sets: 2 }]);
  const removeExercise = (idx: number) => setExercises((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await treatmentApi.submit({
        sessionId,
        appointmentId,
        chiefComplaint, painRegions, painScale, assessments, treatments, exercises,
        clinicalNotes, precautions, followUpRequired, followUpDate, elapsedSeconds, checklist, quickNote,
      });
      if (sessionId) {
        await sessionApi.complete(sessionId);
      }
      sheet.close();
      showToast("Session completed — payout queued");
      setTimeout(() => router.replace("/session/complete"), 500);
    } catch {
      showToast("Failed to submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const painDescs: Record<number, string> = {
    1: "No significant pain", 3: "Mild pain, manageable", 5: "Moderate, noticeable",
    7: "Severe. Activities limited", 10: "Emergency level pain",
  };

  return (
    <View className="flex-1 bg-bg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#003554", "#004060"]} className="h-[140px] relative overflow-hidden">
          <View className="absolute top-0 left-0 right-0 p-3 flex-row items-center justify-between">
            <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-md bg-white/90 items-center justify-center">
              <ChevronLeft size={18} color={COLORS.accent} />
            </Pressable>
            <Chip variant="pending">Draft</Chip>
          </View>
          <View className="absolute bottom-3 left-3.5">
            <Text className="text-white text-[19px] font-extrabold">Treatment form</Text>
          </View>
        </LinearGradient>

        <View className="px-3.5 pt-3" style={{ paddingBottom: 100 }}>
          <View className="bg-white border border-border rounded-md p-3 flex-row items-center mb-2" style={{ gap: 12, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
            <Avatar name={safeName} size={44} radius={12} />
            <View>
              <Text className="text-[14px] font-bold text-fg">{safeName}</Text>
              <Text className="text-muted text-[12px]">Home visit · Today · Rs 1,200</Text>
            </View>
          </View>

          <Section title="1 · Chief Complaint">
            <TextArea value={chiefComplaint} onChangeText={setChiefComplaint} placeholder="Chief complaint..." />
          </Section>

          <Section title="2 · Pain Location">
            <Text className="text-muted text-[11px] mb-2">Tap body region to mark pain area</Text>
            <View className="flex-row flex-wrap" style={{ gap: 7 }}>
              {PAIN_REGIONS.map((region) => (
                <Chip key={region} selectable selected={painRegions.includes(region)} onPress={() => togglePainRegion(region)}>
                  {region}
                </Chip>
              ))}
            </View>
            <Text className="text-muted text-[11px] mt-2">Selected: {painRegions.join(", ")}</Text>
          </Section>

          <Section title="3 · Pain Scale (VAS)">
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted text-[12px]">No pain</Text>
              <Text className="text-muted text-[12px]">Worst pain</Text>
            </View>
            <View className="flex-row" style={{ gap: 4 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                const sev = n <= 3 ? "low" : n <= 6 ? "med" : "high";
                const active = painScale === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setPainScale(n)}
                    className="flex-1 h-9 rounded-[9px] border-[1.5px] items-center justify-center"
                    style={{
                      borderColor: active ? (sev === "high" ? COLORS.danger : sev === "med" ? COLORS.warning : COLORS.accent) : COLORS.border,
                      backgroundColor: active ? (sev === "high" ? COLORS.danger : sev === "med" ? COLORS.warning : COLORS.accent) : "white",
                    }}
                  >
                    <Text className="text-[13px] font-extrabold" style={{ color: active ? "white" : COLORS.muted, fontFamily: "monospace" }}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-muted text-[12px] mt-2">Current: {painScale}/10 — {painDescs[painScale] ?? "Moderate"}</Text>
          </Section>

          <Section title="4 · Assessment & Treatment">
            <Text className="text-[12px] font-bold text-fg mb-1">Assessment findings</Text>
            <View className="flex-row flex-wrap mb-2" style={{ gap: 7 }}>
              {ASSESSMENT_TYPES.map((a) => (
                <Chip key={a.type} selectable selected={assessments.includes(a.type)} onPress={() => toggleAssessment(a.type)}>
                  {a.label}
                </Chip>
              ))}
            </View>
            <Text className="text-[12px] font-bold text-fg mb-1 mt-2">Treatment given</Text>
            <View className="flex-row flex-wrap" style={{ gap: 7 }}>
              {TREATMENT_TYPES.map((t) => (
                <Chip key={t.type} selectable selected={treatments.includes(t.type)} onPress={() => toggleTreatment(t.type)}>
                  {t.label}
                </Chip>
              ))}
            </View>
          </Section>

          <Section title="Exercises prescribed">
            {exercises.map((ex, idx) => (
              <View key={idx} className="flex-row items-center p-2 rounded-[10px] border border-border mb-2" style={{ gap: 6, backgroundColor: "rgba(0,64,96,0.02)" }}>
                <View className="flex-1 min-h-[30px] rounded-lg border border-border bg-white px-2 justify-center">
                  <Text className="text-[12px] font-semibold text-fg">{ex.name}</Text>
                </View>
                <View className="flex-row items-center" style={{ gap: 3 }}>
                  <Text className="text-[12px] font-bold text-fg">{ex.reps}</Text>
                  <Text className="text-muted text-[11px]">×</Text>
                  <Text className="text-[12px] font-bold text-fg">{ex.sets}</Text>
                </View>
                <Pressable onPress={() => removeExercise(idx)} className="w-6 h-6 rounded-lg items-center justify-center" style={{ backgroundColor: "rgba(207,66,56,0.08)" }}>
                  <X size={14} color={COLORS.danger} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={addExercise} className="h-[34px] rounded-[10px] border-[1.5px] border-dashed border-border items-center justify-center flex-row" style={{ gap: 5 }}>
              <Plus size={14} color={COLORS.accent} />
              <Text className="text-accent font-bold text-[12px]">Add exercise</Text>
            </Pressable>
          </Section>

          <Section title="Clinical notes">
            <TextArea value={clinicalNotes} onChangeText={setClinicalNotes} placeholder="Anything else..." />
          </Section>

          <Section title="5 · Precautions & Follow-up">
            <Input label="Precautions" value={precautions} onChangeText={setPrecautions} />
            <View className="mt-2">
              <Text className="text-[12px] font-bold text-fg mb-1.5">Follow-up required?</Text>
              <View className="flex-row rounded-[13px] border border-border p-[3px]" style={{ backgroundColor: "rgba(0,64,96,0.02)" }}>
                <Pressable
                  onPress={() => setFollowUpRequired(true)}
                  className={`flex-1 h-[34px] rounded-[10px] items-center justify-center ${followUpRequired ? "bg-white" : ""}`}
                  style={followUpRequired ? { shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 } : {}}
                >
                  <Text className={`text-[13px] font-bold ${followUpRequired ? "text-accent" : "text-muted"}`}>Yes</Text>
                </Pressable>
                <Pressable
                  onPress={() => setFollowUpRequired(false)}
                  className={`flex-1 h-[34px] rounded-[10px] items-center justify-center ${!followUpRequired ? "bg-white" : ""}`}
                  style={!followUpRequired ? { shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 } : {}}
                >
                  <Text className={`text-[13px] font-bold ${!followUpRequired ? "text-accent" : "text-muted"}`}>No</Text>
                </Pressable>
              </View>
            </View>
            {followUpRequired && (
              <Input label="Recommended next session" value={followUpDate} onChangeText={setFollowUpDate} />
            )}
          </Section>

          <Section title="6 · Attachments">
            <View className="flex-row items-center p-2.5 rounded-md border border-border mb-2.5" style={{ gap: 10 }}>
              <View className="w-14 h-14 rounded-[10px]" style={{ backgroundColor: COLORS.primarySoft }} />
              <View className="flex-1">
                <Text className="text-[13px] font-bold text-fg">session-photo-01.jpg</Text>
                <Text className="text-muted text-[12px]">2.1 MB · Uploaded</Text>
              </View>
              <Chip variant="active">✓</Chip>
            </View>
            <Pressable className="min-h-[90px] rounded-[14px] border-[1.5px] border-dashed items-center justify-center" style={{ backgroundColor: "rgba(0,64,96,0.02)", borderColor: "rgba(0,64,96,0.15)" }}>
              <Upload size={28} color={COLORS.muted} />
              <Text className="text-[12px] font-bold text-fg mt-1.5">Add more files</Text>
              <Text className="text-muted text-[11px]">Photo, PDF, MRI report</Text>
            </Pressable>
          </Section>

          <View style={{ gap: 10, paddingBottom: 20 }}>
            <Button variant="secondary" onPress={() => showToast("Draft saved — you can return any time")}>
              <Save size={16} color={COLORS.accent} />
              <Text className="text-accent font-bold text-[14px]">Save draft</Text>
            </Button>
            <Button variant="success" onPress={sheet.open}>
              <CheckCircle2 size={16} color="#fff" />
              <Text className="text-white font-bold text-[14px]">Submit & complete session</Text>
            </Button>
          </View>
        </View>
      </ScrollView>

      <BottomSheet visible={sheet.visible} onClose={sheet.close}>
        <Text className="text-[18px] font-bold text-fg">Complete this session?</Text>
        <Text className="text-muted text-[13px]">
          Treatment notes will be locked and sent to {safeName}. Payment of Rs 1,200 will move to payout review.
        </Text>
        <Button variant="success" onPress={handleSubmit} disabled={submitting}>
          <CheckCircle2 size={16} color="#fff" />
          <Text className="text-white font-bold text-[14px]">{submitting ? "Submitting..." : "Confirm and complete"}</Text>
        </Button>
        <Button variant="secondary" onPress={sheet.close}>Continue editing</Button>
      </BottomSheet>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white border border-border rounded-md p-3.5 mt-2">
      <Text className="text-[14px] font-bold text-accent mb-3">{title}</Text>
      {children}
    </View>
  );
}
