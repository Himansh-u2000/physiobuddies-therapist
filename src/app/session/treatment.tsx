import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Crypto from "expo-crypto";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  Check,
  Upload,
  Save,
  CheckCircle2,
  FileText,
  Activity,
  Stethoscope,
  ClipboardList,
  NotebookPen,
  Calendar,
  TriangleAlert,
  Paperclip,
} from "lucide-react-native";
import {
  Avatar,
  Badge,
  Button,
  TextArea,
  BottomSheet,
  useBottomSheet,
  Slider,
  PainSlider,
  painSeverityColor,
} from "@/components/ui";
import { BodyMap } from "@/components/session/BodyMap";
import { DatePickerSheet } from "@/components/session/DatePickerSheet";
import {
  Field,
  SegmentedField,
  MultiSelectField,
  BooleanField,
  TextField,
} from "@/components/session/FormFields";
import { useSessionStore } from "@/lib/stores/session.store";
import { useAppStore } from "@/lib/stores/app.store";
import { useDatabase } from "@/lib/db/provider";
import {
  upsertTreatmentDraft,
  upsertSessionDraft,
  getSessionById,
  getPhotosForSession,
  enqueuePhotoUpload,
} from "@/lib/db/repositories";
import type { SessionPhotoRow } from "@/lib/db/repositories";
import { flushPendingSync, flushPendingPhotoUploads } from "@/lib/db/sync/syncEngine";
import { pickDocument, MAX_UPLOAD_BYTES } from "@/lib/hooks/useFilePicker";
import { privateImageSource, useFileAuthToken } from "@/lib/utils/privateFile";
import { COLORS } from "@/constants/config";
import {
  ASSESSMENT_TYPES,
  ASSISTIVE_DEVICES,
  CHIEF_COMPLAINTS,
  DURATIONS,
  FALL_RISK_OPTIONS,
  FUNCTIONAL_LIMITATIONS,
  MOBILITY_STATUSES,
  PAIN_CHARACTERISTICS,
  PROBLEMS_IDENTIFIED,
  ROM_OPTIONS,
  STRENGTH_OPTIONS,
  TREATMENT_ITEMS,
  VISIT_FREQUENCIES,
  conditionalBlockFor,
} from "@/constants/clinical";
import { toIsoDate, formatDateLabel } from "@/lib/utils/format";
import type {
  AssessmentType,
  ClinicalAssessmentInput,
  DurationOfSymptoms,
  ExercisePrescribed,
  FallRisk,
  MuscleStrength,
  RangeOfMotion,
  VisitFrequency,
} from "@/types";

/**
 * The clinical assessment / treatment form.
 *
 * Rebuilt around the backend's real `ClinicalAssessment` model. The previous version collected
 * a shape of the app's own invention and POSTed it to an endpoint that was an unimplemented
 * stub — so none of it was ever stored. Now every field here maps to a real column (see
 * `mapAssessmentToPayload`), and the enum-valued fields offer exactly the values the schema
 * accepts.
 *
 * Usability changes, in rough order of how much time they save mid-session:
 *  - **Numbers are sliders.** Pain score, treatment days, reps, sets and the cardiopulmonary
 *    vitals were all number-pad `TextInput`s: tap, wait for keyboard, type, dismiss. Now they're
 *    one drag, with ± buttons for exact values.
 *  - **Nothing is pre-filled with fake data.** It used to open with an invented chief complaint,
 *    a 7/10 pain score, three findings and three exercises already selected, all describing a
 *    fictional patient. A therapist skimming to the end would have filed that as a real record.
 *  - **Conditional sections follow the assessment type.** Surgery details only appear for a
 *    post-surgical assessment, vitals only for cardiopulmonary — matching what the backend
 *    actually persists, instead of asking for data it silently drops.
 *  - **The step you're on can't be skipped past silently.** Required fields are validated per
 *    step, and the header shows what's still missing rather than failing at submit.
 */

interface Phase {
  key: string;
  label: string;
  icon: typeof FileText;
}

const PHASES: Phase[] = [
  { key: "assessment", label: "Assessment", icon: FileText },
  { key: "pain", label: "Pain", icon: Activity },
  { key: "findings", label: "Findings", icon: Stethoscope },
  { key: "plan", label: "Plan", icon: ClipboardList },
  { key: "notes", label: "Notes", icon: NotebookPen },
  { key: "review", label: "Review", icon: CheckCircle2 },
];
const LAST_PHASE = PHASES.length - 1;

function defaultFollowUpDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return toIsoDate(d);
}

export default function TreatmentFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  const { db } = useDatabase();
  const { sessionId, appointmentId, patientId, patientName, condition } = useSessionStore();
  const safeName = patientName ?? "Patient";
  const sheet = useBottomSheet();

  const [phase, setPhase] = useState(0);

  // --- Step 1: core assessment ---
  const [assessmentType, setAssessmentType] = useState<AssessmentType>("ORTHO");
  const [chiefComplaint, setChiefComplaint] = useState<string[]>([]);
  const [complaintNote, setComplaintNote] = useState("");
  const [durationOfSymptoms, setDurationOfSymptoms] =
    useState<DurationOfSymptoms>("ONE_TO_FOUR_WEEKS");

  // --- Step 2: pain ---
  const [painRegions, setPainRegions] = useState<string[]>([]);
  const [painScore, setPainScore] = useState(0);
  const [painCharacteristics, setPainCharacteristics] = useState<string[]>([]);

  // --- Step 3: objective findings ---
  const [rom, setRom] = useState<RangeOfMotion>("Full");
  const [muscleStrength, setMuscleStrength] = useState<MuscleStrength>("Normal");
  const [mobilityStatus, setMobilityStatus] = useState<string>("Independent");
  const [assistiveDevice, setAssistiveDevice] = useState<string>("None");
  const [fallRisk, setFallRisk] = useState<FallRisk>("Low");
  const [functionalLimitations, setFunctionalLimitations] = useState<string[]>([]);
  // Conditional blocks — only one is ever persisted, chosen by assessmentType.
  const [surgeryType, setSurgeryType] = useState("");
  const [dateOfSurgery, setDateOfSurgery] = useState<string>("");
  const [surgeryDatePickerOpen, setSurgeryDatePickerOpen] = useState(false);
  const [sportPlayed, setSportPlayed] = useState("");
  const [mechanismOfInjury, setMechanismOfInjury] = useState("");
  const [cognitiveStatus, setCognitiveStatus] = useState("");
  const [muscleTone, setMuscleTone] = useState("");
  const [heartRateBpm, setHeartRateBpm] = useState(72);
  const [bloodPressureSys, setBloodPressureSys] = useState(120);
  const [bloodPressureDia, setBloodPressureDia] = useState(80);
  const [spo2Percentage, setSpo2Percentage] = useState(98);
  const [oxygenSupportType, setOxygenSupportType] = useState("");

  // --- Step 4: plan ---
  const [problemsIdentified, setProblemsIdentified] = useState<string[]>([]);
  const [treatmentPlanItems, setTreatmentPlanItems] = useState<string[]>([]);
  const [visitFrequency, setVisitFrequency] = useState<VisitFrequency>("Alternate_Days");
  const [suggestedTreatmentDays, setSuggestedTreatmentDays] = useState(6);
  const [hepGiven, setHepGiven] = useState(false);
  const [exercises, setExercises] = useState<ExercisePrescribed[]>([]);
  const [pickingExerciseId, setPickingExerciseId] = useState<string | null>(null);

  // --- Step 5: notes ---
  const [therapistNotes, setTherapistNotes] = useState("");
  const [precautions, setPrecautions] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(true);
  const [followUpDate, setFollowUpDate] = useState(defaultFollowUpDate);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const conditionalBlock = conditionalBlockFor(assessmentType);

  // The session's captured photos ARE its attachments. Re-read on focus so a photo taken via
  // the session camera is here on the way back.
  const [photos, setPhotos] = useState<SessionPhotoRow[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!db || !sessionId) return;
      let cancelled = false;
      getPhotosForSession(db, sessionId)
        .then((rows) => {
          if (!cancelled) setPhotos(rows);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [db, sessionId]),
  );

  // Uploaded clinical files live behind `GET /api/v1/file/:id`, so a thumbnail needs the
  // bearer token attached. Without it expo-image issues an unauthenticated GET, gets a 401 and
  // renders an empty box with no error — a silent failure, which is why the token is read here
  // rather than left to each Image.
  const fileToken = useFileAuthToken();
  const [attaching, setAttaching] = useState(false);

  /**
   * Attach a clinical document (X-ray, referral, lab report) to this session.
   *
   * Queued locally first, exactly like a camera capture: the file is on-device the moment the
   * picker returns, so attaching succeeds in a basement with no signal and the upload drains
   * when connectivity comes back. Uploading inline instead would throw offline and lose the
   * attachment — the failure the photo queue was built to end.
   */
  const handleAttachDocument = async () => {
    if (!db || !sessionId) {
      showToast("No active session", "error");
      return;
    }
    setAttaching(true);
    try {
      const file = await pickDocument();
      if (!file) return; // cancelled — not an error, say nothing
      if (file.size != null && file.size > MAX_UPLOAD_BYTES) {
        showToast(
          `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please choose one under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
          "error",
        );
        return;
      }
      await enqueuePhotoUpload(db, {
        id: Crypto.randomUUID(),
        sessionId,
        localUri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
        kind: "document",
      });
      const rows = await getPhotosForSession(db, sessionId);
      setPhotos(rows);
      showToast("Document attached — uploading");
      // Best-effort immediate push; no-ops offline and the queue retries.
      flushPendingPhotoUploads(db).catch(() => {});
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't attach that file.", "error");
    } finally {
      setAttaching(false);
    }
  };

  const togglePainRegion = (region: string) => {
    setPainRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region],
    );
  };

  const addExercise = () =>
    setExercises((prev) => [...prev, { id: Crypto.randomUUID(), name: "", reps: 10, sets: 3 }]);
  const removeExercise = (id: string) =>
    setExercises((prev) => prev.filter((ex) => ex.id !== id));
  const setExerciseName = (id: string, name: string) =>
    setExercises((prev) => prev.map((ex) => (ex.id === id ? { ...ex, name } : ex)));
  const setExerciseCount = (id: string, key: "reps" | "sets", value: number) =>
    setExercises((prev) => prev.map((ex) => (ex.id === id ? { ...ex, [key]: value } : ex)));

  /**
   * What's still missing on each step. Surfaced as you go rather than at submit — discovering
   * on the last screen that step 1 was incomplete means paging back through five steps.
   */
  const missingByPhase = useMemo<Record<number, string[]>>(() => {
    const missing: Record<number, string[]> = {};
    const step1: string[] = [];
    if (chiefComplaint.length === 0) step1.push("a chief complaint");
    if (step1.length) missing[0] = step1;

    const step4: string[] = [];
    if (problemsIdentified.length === 0) step4.push("at least one problem identified");
    if (treatmentPlanItems.length === 0) step4.push("at least one treatment given");
    if (step4.length) missing[3] = step4;

    return missing;
  }, [chiefComplaint, problemsIdentified, treatmentPlanItems]);

  const blockingIssues = useMemo(
    () => Object.values(missingByPhase).flat(),
    [missingByPhase],
  );

  /** Assemble the exact payload the backend stores. */
  const buildClinical = useCallback((): ClinicalAssessmentInput => {
    const notes = [therapistNotes.trim(), precautions.trim() && `Precautions: ${precautions.trim()}`]
      .filter(Boolean)
      .join("\n\n");

    return {
      assessmentType,
      // The free-text elaboration rides along as an extra complaint entry so it isn't lost —
      // the backend has no separate narrative field for it.
      chiefComplaint: complaintNote.trim()
        ? [...chiefComplaint, complaintNote.trim()]
        : chiefComplaint,
      durationOfSymptoms,
      painScore,
      painCharacteristics,
      rom,
      muscleStrength,
      mobilityStatus,
      assistiveDevice,
      fallRisk,
      functionalLimitations,
      // Only the block matching the assessment type is sent — the backend drops the others.
      ...(conditionalBlock === "surgical"
        ? { surgeryType: surgeryType.trim() || undefined, dateOfSurgery: dateOfSurgery || undefined }
        : {}),
      ...(conditionalBlock === "sports"
        ? {
            sportPlayed: sportPlayed.trim() || undefined,
            mechanismOfInjury: mechanismOfInjury.trim() || undefined,
          }
        : {}),
      ...(conditionalBlock === "neuro"
        ? {
            cognitiveStatus: cognitiveStatus.trim() || undefined,
            muscleTone: muscleTone.trim() || undefined,
          }
        : {}),
      ...(conditionalBlock === "cardiopulmonary"
        ? {
            heartRateBpm,
            bloodPressureSys,
            bloodPressureDia,
            spo2Percentage,
            oxygenSupportType: oxygenSupportType.trim() || undefined,
          }
        : {}),
      problemsIdentified,
      treatmentPlanItems,
      visitFrequency,
      suggestedTreatmentDays,
      hepGiven,
      therapistNotes: notes || undefined,
      // Only photos that have finished uploading have a server URL to reference. The rest are
      // still in the upload queue and will be on the server shortly, but this record can't
      // point at a URL that doesn't exist yet.
      documentUrls: photos.map((p) => p.remoteUrl).filter((u): u is string => !!u),
    };
  }, [
    assessmentType, chiefComplaint, complaintNote, durationOfSymptoms, painScore,
    painCharacteristics, rom, muscleStrength, mobilityStatus, assistiveDevice, fallRisk,
    functionalLimitations, conditionalBlock, surgeryType, dateOfSurgery, sportPlayed,
    mechanismOfInjury, cognitiveStatus, muscleTone, heartRateBpm, bloodPressureSys,
    bloodPressureDia, spo2Percentage, oxygenSupportType, problemsIdentified, treatmentPlanItems,
    visitFrequency, suggestedTreatmentDays, hepGiven, therapistNotes, precautions, photos,
  ]);

  /** Persist locally. Local-first — this succeeds regardless of connectivity. */
  const persistTreatment = async () => {
    if (!db || !sessionId || !appointmentId) return false;
    await upsertTreatmentDraft(db, {
      id: Crypto.randomUUID(),
      sessionId,
      appointmentId,
      patientId: patientId ?? "",
      patientName: safeName,
      chiefComplaint: [...chiefComplaint, complaintNote.trim()].filter(Boolean).join(", "),
      painRegions,
      painScales: painRegions.length ? { [painRegions[0]]: painScore } : {},
      assessmentFindings: problemsIdentified.map((label) => ({
        id: label,
        type: label,
        label,
        details: {},
      })),
      treatmentsGiven: treatmentPlanItems.map((label) => ({
        id: label,
        type: label,
        label,
        details: {},
      })),
      exercises: exercises
        .filter((ex) => ex.name.trim())
        .map((ex) => ({ ...ex, reps: ex.reps || 1, sets: ex.sets || 1 })),
      clinicalNotes: therapistNotes,
      precautions,
      followUpRequired,
      followUpDate: followUpRequired ? followUpDate : undefined,
      // Photos upload on their own queue, so the treatment record references them by file name
      // — unique per capture, and what `uploadSessionPhoto` sends as the multipart `name`.
      attachments: photos.map((p) => p.fileName),
      clinical: buildClinical(),
      syncStatus: "pending",
      idempotencyKey: Crypto.randomUUID(),
    });
    return true;
  };

  const handleSaveDraft = async () => {
    const saved = await persistTreatment().catch(() => false);
    showToast(saved ? "Draft saved — you can return any time" : "Couldn't save draft — no active session");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const saved = await persistTreatment();
      if (!saved || !db || !sessionId) throw new Error("No active session to complete");

      // Mark the session completed locally FIRST — that's what makes it (and its treatment)
      // eligible for the sync queue. Durable the moment this returns, independent of the
      // network call right after.
      const session = await getSessionById(db, sessionId);
      if (!session) {
        showToast("Saved locally, but couldn't find the session record. Contact support if this persists.");
        return;
      }
      await upsertSessionDraft(db, {
        id: session.id,
        appointmentId: session.appointmentId,
        patientId: session.patientId,
        patientName: session.patientName,
        condition: session.condition,
        type: session.type,
        status: "completed",
        startedAt: session.startedAt,
        endedAt: Date.now(),
        elapsedSeconds: session.elapsedSeconds,
        checklist: session.checklist,
        quickNote: session.quickNote,
        syncStatus: "pending",
      });
      // Stops active.tsx's tick interval (still mounted underneath) from re-persisting a stale
      // "active" draft over the row just marked completed.
      useSessionStore.getState().completeSession();

      // Best-effort immediate push; offline it no-ops and useSyncEngine picks it up on reconnect.
      flushPendingSync(db).catch(() => {});

      sheet.close();
      showToast("Session completed — assessment saved");
      setTimeout(() => router.replace("/session/complete"), 500);
    } catch {
      showToast("Couldn't complete session. It's saved locally — try again from here.");
    } finally {
      setSubmitting(false);
    }
  };

  const isLastPhase = phase === LAST_PHASE;
  const goNext = () => setPhase((p) => Math.min(p + 1, LAST_PHASE));
  const goBack = () => setPhase((p) => Math.max(p - 1, 0));
  const stepMissing = missingByPhase[phase];

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient colors={["#003554", "#004060"]} className="relative overflow-hidden" style={{ paddingTop: insets.top }}>
        <View className="px-3.5 py-3 flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-md bg-white/90 items-center justify-center">
            <ChevronLeft size={18} color={COLORS.accent} />
          </Pressable>
          <Text className="text-white text-[16px] font-extrabold">Clinical assessment</Text>
          <Pressable onPress={handleSaveDraft} className="rounded-md bg-white/15 px-2.5 py-2">
            <Save size={16} color="#fff" />
          </Pressable>
        </View>
        <PhaseStepper phase={phase} onSelect={setPhase} missing={missingByPhase} />
      </LinearGradient>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 28 }}
      >
        <View
          className="bg-white border border-border rounded-md p-3 flex-row items-center mb-2"
          style={{ gap: 12, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
        >
          <Avatar name={safeName} size={44} radius={12} />
          <View className="flex-1">
            <Text className="text-[14px] font-bold text-fg">{safeName}</Text>
            <Text className="text-muted text-[12px]">{condition ?? "Therapy session"}</Text>
          </View>
          <Badge variant="info" size="sm" dot={false}>
            {ASSESSMENT_TYPES.find((t) => t.value === assessmentType)?.label ?? "Assessment"}
          </Badge>
        </View>

        {stepMissing && (
          <View className="flex-row bg-warning/8 border border-warning/30 rounded-md p-2.5 mb-2" style={{ gap: 8 }}>
            <TriangleAlert size={15} color={COLORS.warning} style={{ marginTop: 1 }} />
            <Text className="flex-1 text-[11.5px] text-fg/80">
              Still needed on this step: {stepMissing.join(", ")}.
            </Text>
          </View>
        )}

        {phase === 0 && (
          <Section title="What are you assessing?">
            <Field label="Assessment type" hint="Decides which extra clinical details are recorded" required>
              <SegmentedField options={ASSESSMENT_TYPES} value={assessmentType} onChange={setAssessmentType} />
            </Field>
            <Field label="Chief complaint" hint="Pick everything that applies" required>
              <MultiSelectField
                options={CHIEF_COMPLAINTS}
                values={chiefComplaint}
                onChange={setChiefComplaint}
                addPlaceholder="Other complaint…"
              />
            </Field>
            <Field label="In the patient's words (optional)">
              <TextArea
                value={complaintNote}
                onChangeText={setComplaintNote}
                placeholder="e.g. Worsens after prolonged sitting; L4-L5 disc bulge on MRI"
              />
            </Field>
            <Field label="How long have symptoms lasted?" required>
              <SegmentedField options={DURATIONS} value={durationOfSymptoms} onChange={setDurationOfSymptoms} />
            </Field>
          </Section>
        )}

        {phase === 1 && (
          <>
            <Section title="Pain">
              <Field label="Pain score" hint="Ask the patient to rate their pain right now">
                <PainSlider value={painScore} onChange={setPainScore} label="" />
                <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                  <View
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: painSeverityColor(painScore) }}
                  />
                  <Text className="text-[11.5px] font-semibold" style={{ color: painSeverityColor(painScore) }}>
                    {painScore === 0
                      ? "No pain reported"
                      : painScore <= 3
                        ? "Mild"
                        : painScore <= 6
                          ? "Moderate"
                          : "Severe"}
                  </Text>
                </View>
              </Field>
              <Field label="Pain character" hint="How the patient describes it">
                <MultiSelectField
                  options={PAIN_CHARACTERISTICS}
                  values={painCharacteristics}
                  onChange={setPainCharacteristics}
                />
              </Field>
            </Section>

            <Section title="Pain location">
              <Text className="text-muted text-[11.5px] -mt-1">
                Tap body regions to mark pain areas — tap again to unmark
              </Text>
              <BodyMap selected={painRegions} onToggle={togglePainRegion} />
            </Section>
          </>
        )}

        {phase === 2 && (
          <>
            <Section title="Objective findings">
              <Field label="Range of motion" required>
                <SegmentedField options={ROM_OPTIONS} value={rom} onChange={setRom} />
              </Field>
              <Field label="Muscle strength" required>
                <SegmentedField options={STRENGTH_OPTIONS} value={muscleStrength} onChange={setMuscleStrength} />
              </Field>
            </Section>

            <Section title="Mobility">
              <Field label="Mobility status">
                <SegmentedField
                  options={MOBILITY_STATUSES.map((v) => ({ value: v, label: v }))}
                  value={mobilityStatus}
                  onChange={setMobilityStatus}
                />
              </Field>
              <Field label="Assistive device">
                <SegmentedField
                  options={ASSISTIVE_DEVICES.map((v) => ({ value: v, label: v }))}
                  value={assistiveDevice}
                  onChange={setAssistiveDevice}
                />
              </Field>
              <Field label="Fall risk">
                <SegmentedField options={FALL_RISK_OPTIONS} value={fallRisk} onChange={setFallRisk} />
              </Field>
              <Field label="Functional limitations">
                <MultiSelectField
                  options={FUNCTIONAL_LIMITATIONS}
                  values={functionalLimitations}
                  onChange={setFunctionalLimitations}
                />
              </Field>
            </Section>

            {conditionalBlock === "surgical" && (
              <Section title="Surgical details">
                <Field label="Surgery type">
                  <TextField value={surgeryType} onChangeText={setSurgeryType} placeholder="e.g. ACL reconstruction" />
                </Field>
                <Field label="Date of surgery">
                  <Pressable
                    onPress={() => setSurgeryDatePickerOpen(true)}
                    className="h-[42px] rounded-[11px] border border-border bg-white px-3 flex-row items-center justify-between"
                  >
                    <Text className={`text-[13.5px] ${dateOfSurgery ? "text-fg font-semibold" : "text-muted"}`}>
                      {dateOfSurgery ? formatDateLabel(dateOfSurgery) : "Select a date"}
                    </Text>
                    <Calendar size={16} color={COLORS.accent} />
                  </Pressable>
                </Field>
              </Section>
            )}

            {conditionalBlock === "sports" && (
              <Section title="Sports details">
                <Field label="Sport played">
                  <TextField value={sportPlayed} onChangeText={setSportPlayed} placeholder="e.g. Cricket" />
                </Field>
                <Field label="Mechanism of injury">
                  <TextField
                    value={mechanismOfInjury}
                    onChangeText={setMechanismOfInjury}
                    placeholder="e.g. Twisting fall while fielding"
                  />
                </Field>
              </Section>
            )}

            {conditionalBlock === "neuro" && (
              <Section title="Neurological details">
                <Field label="Cognitive status">
                  <TextField value={cognitiveStatus} onChangeText={setCognitiveStatus} placeholder="e.g. Alert and oriented" />
                </Field>
                <Field label="Muscle tone">
                  <TextField value={muscleTone} onChangeText={setMuscleTone} placeholder="e.g. Spasticity, MAS 2" />
                </Field>
              </Section>
            )}

            {conditionalBlock === "cardiopulmonary" && (
              <Section title="Vitals">
                <Slider
                  label="Heart rate"
                  unit=" bpm"
                  value={heartRateBpm}
                  onChange={setHeartRateBpm}
                  min={30}
                  max={200}
                />
                <Slider
                  label="Blood pressure (systolic)"
                  unit=" mmHg"
                  value={bloodPressureSys}
                  onChange={setBloodPressureSys}
                  min={70}
                  max={220}
                />
                <Slider
                  label="Blood pressure (diastolic)"
                  unit=" mmHg"
                  value={bloodPressureDia}
                  onChange={setBloodPressureDia}
                  min={40}
                  max={140}
                />
                <Slider
                  label="SpO₂"
                  unit="%"
                  value={spo2Percentage}
                  onChange={setSpo2Percentage}
                  min={70}
                  max={100}
                  colorForValue={(v) => (v >= 95 ? COLORS.success : v >= 90 ? COLORS.warning : COLORS.danger)}
                />
                <Field label="Oxygen support">
                  <TextField
                    value={oxygenSupportType}
                    onChangeText={setOxygenSupportType}
                    placeholder="e.g. Room air, nasal cannula 2L"
                  />
                </Field>
              </Section>
            )}
          </>
        )}

        {phase === 3 && (
          <>
            <Section title="Problems & treatment">
              <Field label="Problems identified" required>
                <MultiSelectField
                  options={PROBLEMS_IDENTIFIED}
                  values={problemsIdentified}
                  onChange={setProblemsIdentified}
                />
              </Field>
              <Field label="Treatment given" hint="Techniques used in this session" required>
                <MultiSelectField
                  options={TREATMENT_ITEMS}
                  values={treatmentPlanItems}
                  onChange={setTreatmentPlanItems}
                />
              </Field>
            </Section>

            <Section title="Recommended schedule">
              <Field label="Visit frequency">
                <SegmentedField options={VISIT_FREQUENCIES} value={visitFrequency} onChange={setVisitFrequency} />
              </Field>
              <Slider
                label="Suggested treatment days"
                unit=" days"
                value={suggestedTreatmentDays}
                onChange={setSuggestedTreatmentDays}
                min={1}
                max={30}
              />
              <Field label="Home exercise programme given?">
                <BooleanField value={hepGiven} onChange={setHepGiven} />
              </Field>
            </Section>

            {hepGiven && (
              <Section title="Exercises prescribed">
                {exercises.length === 0 && (
                  <Text className="text-muted text-[11.5px] -mt-1">
                    Add the exercises you demonstrated, with their reps and sets.
                  </Text>
                )}
                {exercises.map((ex, index) => (
                  <View
                    key={ex.id}
                    className="rounded-[13px] border border-border p-3"
                    style={{ gap: 12, backgroundColor: "rgba(0,64,96,0.02)" }}
                  >
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <Text className="text-muted text-[11px] font-extrabold">{index + 1}</Text>
                      <Pressable
                        onPress={() => setPickingExerciseId(ex.id)}
                        className="flex-1 h-[38px] rounded-[11px] border border-border bg-white px-3 flex-row items-center justify-between"
                      >
                        <Text className={`text-[13px] ${ex.name ? "font-semibold text-fg" : "text-muted"}`}>
                          {ex.name || "Choose an exercise"}
                        </Text>
                        <ChevronDown size={15} color={COLORS.muted} />
                      </Pressable>
                      <Pressable
                        onPress={() => removeExercise(ex.id)}
                        accessibilityLabel="Remove exercise"
                        className="w-8 h-8 rounded-[10px] items-center justify-center"
                        style={{ backgroundColor: "rgba(207,66,56,0.08)" }}
                      >
                        <X size={15} color={COLORS.danger} />
                      </Pressable>
                    </View>
                    {/* Reps and sets were 2-3 character number inputs. Sliders here are
                        strictly faster: the values live in a narrow, well-known range. */}
                    <Slider
                      label="Reps"
                      value={ex.reps}
                      onChange={(v) => setExerciseCount(ex.id, "reps", v)}
                      min={1}
                      max={30}
                    />
                    <Slider
                      label="Sets"
                      value={ex.sets}
                      onChange={(v) => setExerciseCount(ex.id, "sets", v)}
                      min={1}
                      max={10}
                    />
                  </View>
                ))}
                <Pressable
                  onPress={addExercise}
                  className="h-[38px] rounded-[11px] border-[1.5px] border-dashed border-border items-center justify-center flex-row"
                  style={{ gap: 5 }}
                >
                  <Plus size={14} color={COLORS.accent} />
                  <Text className="text-accent font-bold text-[12px]">Add exercise</Text>
                </Pressable>
              </Section>
            )}
          </>
        )}

        {phase === 4 && (
          <>
            <Section title="Clinical notes">
              <TextArea
                value={therapistNotes}
                onChangeText={setTherapistNotes}
                placeholder="Patient response, reasoning, anything the next session should know…"
              />
            </Section>

            <Section title="Precautions & follow-up">
              <Field label="Precautions">
                <TextField
                  value={precautions}
                  onChangeText={setPrecautions}
                  placeholder="e.g. Avoid forward bending; use lumbar roll"
                />
              </Field>
              <Field label="Follow-up required?">
                <BooleanField value={followUpRequired} onChange={setFollowUpRequired} />
              </Field>
              {followUpRequired && (
                <Field label="Recommended next session">
                  <Pressable
                    onPress={() => setDatePickerOpen(true)}
                    className="h-[42px] rounded-[11px] border border-border bg-white px-3 flex-row items-center justify-between"
                  >
                    <Text className="text-[13.5px] font-semibold text-fg">{formatDateLabel(followUpDate)}</Text>
                    <Calendar size={16} color={COLORS.accent} />
                  </Pressable>
                </Field>
              )}
            </Section>

            <Section title="Attachments">
              {photos.length === 0 ? (
                <Text className="text-muted text-[11.5px] -mt-1">
                  No photos or documents attached to this session yet.
                </Text>
              ) : (
                photos.map((file) => {
                  const uploaded = file.syncStatus === "synced";
                  const stuck = file.syncStatus === "error";
                  return (
                    <View
                      key={file.id}
                      className="flex-row items-center p-2.5 rounded-md border border-border"
                      style={{ gap: 10 }}
                    >
                      <AttachmentThumb file={file} token={fileToken} />
                      <View className="flex-1">
                        <Text className="text-[12.5px] font-bold text-fg" numberOfLines={1}>
                          {file.fileName}
                        </Text>
                        <Text className="text-muted text-[11.5px]">
                          {uploaded ? "Uploaded" : stuck ? "Couldn't upload — will retry" : "Saved on device — uploading"}
                        </Text>
                      </View>
                      <View
                        className={`w-6 h-6 rounded-full items-center justify-center ${uploaded ? "bg-success/15" : stuck ? "bg-danger/15" : "bg-warning/15"}`}
                      >
                        {uploaded ? (
                          <Check size={13} color={COLORS.success} />
                        ) : (
                          <Upload size={12} color={stuck ? COLORS.danger : COLORS.warning} />
                        )}
                      </View>
                    </View>
                  );
                })
              )}
              <View className="flex-row" style={{ gap: 10 }}>
                <Pressable
                  onPress={() => router.push("/session/active")}
                  className="flex-1 min-h-[82px] rounded-[14px] border-[1.5px] border-dashed items-center justify-center active:opacity-80"
                  style={{ backgroundColor: "rgba(0,64,96,0.02)", borderColor: "rgba(0,64,96,0.15)" }}
                >
                  <Upload size={24} color={COLORS.muted} />
                  <Text className="text-[12px] font-bold text-fg mt-1.5">Add a photo</Text>
                  <Text className="text-muted text-[11px]">Session camera</Text>
                </Pressable>
                <Pressable
                  onPress={handleAttachDocument}
                  disabled={attaching}
                  className="flex-1 min-h-[82px] rounded-[14px] border-[1.5px] border-dashed items-center justify-center active:opacity-80"
                  style={{
                    backgroundColor: "rgba(0,64,96,0.02)",
                    borderColor: "rgba(0,64,96,0.15)",
                    opacity: attaching ? 0.6 : 1,
                  }}
                >
                  <Paperclip size={24} color={COLORS.muted} />
                  <Text className="text-[12px] font-bold text-fg mt-1.5">
                    {attaching ? "Opening…" : "Attach a document"}
                  </Text>
                  <Text className="text-muted text-[11px]">X-ray, report, PDF</Text>
                </Pressable>
              </View>
              <Text className="text-muted text-[11px] leading-4">
                Files are stored privately — only you, this patient and an admin can open them.
              </Text>
            </Section>
          </>
        )}

        {phase === 5 && (
          <Section title="Review before submitting">
            <ReviewRow
              label="Assessment"
              value={ASSESSMENT_TYPES.find((t) => t.value === assessmentType)?.label ?? assessmentType}
              onEdit={() => setPhase(0)}
            />
            <ReviewRow
              label="Chief complaint"
              value={
                [...chiefComplaint, complaintNote.trim()].filter(Boolean).join(", ") || "Not recorded"
              }
              onEdit={() => setPhase(0)}
            />
            <ReviewRow
              label="Duration"
              value={DURATIONS.find((d) => d.value === durationOfSymptoms)?.label ?? "—"}
              onEdit={() => setPhase(0)}
            />
            <ReviewRow
              label="Pain"
              value={`${painScore}/10${painCharacteristics.length ? ` · ${painCharacteristics.join(", ")}` : ""}${painRegions.length ? ` · ${painRegions.join(", ")}` : ""}`}
              onEdit={() => setPhase(1)}
            />
            <ReviewRow
              label="ROM / strength"
              value={`${ROM_OPTIONS.find((r) => r.value === rom)?.label} ROM · ${STRENGTH_OPTIONS.find((s) => s.value === muscleStrength)?.label} strength`}
              onEdit={() => setPhase(2)}
            />
            <ReviewRow
              label="Problems"
              value={problemsIdentified.join(", ") || "None recorded"}
              onEdit={() => setPhase(3)}
            />
            <ReviewRow
              label="Treatment"
              value={treatmentPlanItems.join(", ") || "None recorded"}
              onEdit={() => setPhase(3)}
            />
            <ReviewRow
              label="Plan"
              value={`${VISIT_FREQUENCIES.find((v) => v.value === visitFrequency)?.label} · ${suggestedTreatmentDays} days · HEP ${hepGiven ? `given (${exercises.filter((e) => e.name.trim()).length} exercises)` : "not given"}`}
              onEdit={() => setPhase(3)}
            />
            <ReviewRow
              label="Follow-up"
              value={followUpRequired ? formatDateLabel(followUpDate) : "Not required"}
              onEdit={() => setPhase(4)}
              isLast
            />
          </Section>
        )}
      </ScrollView>

      <View className="px-3.5 pt-2.5 border-t border-border bg-white" style={{ paddingBottom: insets.bottom + 12, gap: 8 }}>
        <View className="flex-row" style={{ gap: 8 }}>
          <Button
            variant="secondary"
            fullWidth={false}
            style={{ flex: 1 }}
            onPress={goBack}
            disabled={phase === 0}
          >
            <ChevronLeft size={16} color={COLORS.accent} />
            <Text className="text-accent font-bold text-[14px]">Back</Text>
          </Button>
          {isLastPhase ? (
            <Button
              variant="success"
              fullWidth={false}
              // No hand-rolled `opacity` here: `Button` owns the disabled look now, and dimming
              // the whole button was what made this exact control — the one at the end of the
              // clinical form — fade to an unreadable white-on-white box when it was blocked.
              style={{ flex: 2 }}
              onPress={sheet.open}
              disabled={blockingIssues.length > 0}
            >
              <CheckCircle2 size={16} color="#fff" />
              <Text className="text-white font-bold text-[14px]">Submit & complete</Text>
            </Button>
          ) : (
            <Button fullWidth={false} style={{ flex: 2 }} onPress={goNext}>
              <Text className="text-white font-bold text-[14px]">Next · {PHASES[phase + 1].label}</Text>
              <ChevronRight size={16} color="#fff" />
            </Button>
          )}
        </View>
      </View>

      <BottomSheet visible={pickingExerciseId !== null} onClose={() => setPickingExerciseId(null)}>
        <Text className="text-[16px] font-bold text-fg">Choose exercise</Text>
        <ScrollView style={{ maxHeight: 360 }}>
          {EXERCISE_LIBRARY.map((name) => {
            const active = exercises.find((ex) => ex.id === pickingExerciseId)?.name === name;
            return (
              <Pressable
                key={name}
                onPress={() => {
                  if (pickingExerciseId) setExerciseName(pickingExerciseId, name);
                  setPickingExerciseId(null);
                }}
                className={`flex-row items-center justify-between rounded-[10px] px-3 py-3 ${active ? "bg-accent/5" : ""}`}
              >
                <Text className={`text-[14px] ${active ? "font-bold text-accent" : "font-semibold text-fg"}`}>{name}</Text>
                {active && <CheckCircle2 size={16} color={COLORS.accent} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>

      <DatePickerSheet
        visible={datePickerOpen}
        initialDate={followUpDate}
        onClose={() => setDatePickerOpen(false)}
        onSelect={setFollowUpDate}
      />

      <DatePickerSheet
        visible={surgeryDatePickerOpen}
        initialDate={dateOfSurgery || toIsoDate(new Date())}
        onClose={() => setSurgeryDatePickerOpen(false)}
        onSelect={setDateOfSurgery}
      />

      <BottomSheet visible={sheet.visible} onClose={sheet.close}>
        <Text className="text-[18px] font-bold text-fg">Complete this session?</Text>
        <Text className="text-muted text-[13px]">
          The assessment will be saved to {safeName}&apos;s treatment plan and this visit will be
          marked complete. You won&apos;t be able to edit it afterwards.
        </Text>
        <Button variant="success" onPress={handleSubmit} disabled={submitting}>
          <CheckCircle2 size={16} color="#fff" />
          <Text className="text-white font-bold text-[14px]">{submitting ? "Submitting..." : "Confirm and complete"}</Text>
        </Button>
        <Button variant="secondary" onPress={sheet.close}>Continue editing</Button>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

/** Common physiotherapy home-exercise prescriptions. Client-side — there's no backend catalog. */
const EXERCISE_LIBRARY = [
  "Cat-Camel Stretch",
  "Knee-to-Chest",
  "Pelvic Tilt",
  "Bridging",
  "Bird Dog",
  "Clamshell",
  "Straight Leg Raise",
  "Wall Squat",
  "Heel Slides",
  "Quadriceps Setting",
  "Calf Raises",
  "Shoulder Pendulum",
  "Scapular Retraction",
  "Neck Isometrics",
  "Ankle Pumps",
];

/**
 * The step rail. Steps with something outstanding get a warning dot, so an incomplete step is
 * visible from any other step rather than only when you reach it.
 */
function PhaseStepper({
  phase,
  onSelect,
  missing,
}: {
  phase: number;
  onSelect: (i: number) => void;
  missing: Record<number, string[]>;
}) {
  return (
    <View className="px-3.5 pb-3">
      <View className="flex-row items-center">
        {PHASES.map((p, i) => {
          const done = i < phase;
          const current = i === phase;
          const incomplete = !!missing[i];
          const Icon = p.icon;
          return (
            <View key={p.key} className="flex-1 flex-row items-center">
              <Pressable onPress={() => onSelect(i)} accessibilityLabel={`Go to ${p.label}`}>
                <View
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: done && !incomplete ? COLORS.successLight : current ? "#fff" : "rgba(255,255,255,0.15)",
                  }}
                >
                  {done && !incomplete ? (
                    <Check size={15} color="#fff" />
                  ) : (
                    <Icon size={15} color={current ? COLORS.accent : "#fff"} />
                  )}
                </View>
                {incomplete && (
                  <View
                    className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-[1.5px]"
                    style={{ backgroundColor: COLORS.warning, borderColor: COLORS.nav }}
                  />
                )}
              </Pressable>
              {i < PHASES.length - 1 && (
                <View
                  className="flex-1 h-[2px]"
                  style={{ backgroundColor: done ? COLORS.successLight : "rgba(255,255,255,0.15)" }}
                />
              )}
            </View>
          );
        })}
      </View>
      <Text className="text-white text-[13px] font-bold mt-2">
        Step {phase + 1} of {PHASES.length} · {PHASES[phase].label}
      </Text>
    </View>
  );
}

/**
 * Thumbnail for one attachment, with a local-first / private-remote-fallback chain.
 *
 * The on-device copy is preferred: no network, no token, byte-identical to what was uploaded.
 * But `localUri` points into the app's cache, which the OS is free to evict — the row still
 * holds the path, so a plain `??` chain can't detect it and would render a permanently broken
 * box. `onError` is the only signal that the local file is gone, so the fallback is wired to it
 * rather than to a null check.
 *
 * The fallback is the private `/file/:id` url, which 401s without an `Authorization` header —
 * hence `privateImageSource`. If that fails too (still uploading, so no remote yet; or the token
 * has rotated) it degrades to the same file glyph a PDF gets, never to an empty frame.
 */
function AttachmentThumb({ file, token }: { file: SessionPhotoRow; token: string | null }) {
  const [localFailed, setLocalFailed] = useState(false);
  const size = { width: 52, height: 52, borderRadius: 10, backgroundColor: COLORS.primarySoft };

  const isImage = file.mimeType.startsWith("image/");
  const uri = localFailed ? file.remoteUrl : file.localUri;
  const source = isImage ? privateImageSource(uri, token) : null;

  if (!source) {
    return (
      <View className="items-center justify-center" style={size}>
        <FileText size={22} color={COLORS.accent} />
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={size}
      contentFit="cover"
      onError={() => setLocalFailed(true)}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white border border-border rounded-md p-3.5 mt-2" style={{ gap: 16 }}>
      <Text className="text-[14px] font-bold text-accent">{title}</Text>
      {children}
    </View>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
  isLast,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  isLast?: boolean;
}) {
  return (
    <View className={`pb-2.5 ${isLast ? "" : "border-b border-border"}`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-muted text-[11px] font-bold uppercase" style={{ letterSpacing: 0.5 }}>
          {label}
        </Text>
        <Pressable onPress={onEdit} hitSlop={6}>
          <Text className="text-accent text-[11px] font-bold">Edit</Text>
        </Pressable>
      </View>
      <Text className="text-[13px] text-fg mt-1">{value}</Text>
    </View>
  );
}
