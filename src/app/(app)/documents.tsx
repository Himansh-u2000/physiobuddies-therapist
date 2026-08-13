import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  Info,
  CheckCircle2,
  Upload,
  Camera,
  Image as ImageIcon,
  FolderOpen,
  Trash2,
  ExternalLink,
} from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { TopBar } from "@/components/shared/TopBar";
import { Badge, BottomSheet, Button } from "@/components/ui";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { useFileUpload, pickImageFromLibrary, captureImage, pickDocument } from "@/lib/hooks/useFilePicker";
import { useDatabase } from "@/lib/db/provider";
import {
  getKycDocuments,
  saveKycDocument,
  removeKycDocument,
  type KycDocumentRecord,
} from "@/lib/db/repositories";
import { COLORS } from "@/constants/config";

/**
 * KYC / credential documents.
 *
 * Verification status is REAL (`therapist.isVerified`, from GET /user → therapistStatus).
 * Uploads are real too — `POST /file-upload/single` accepts the file and returns a URL that the
 * admin console can open.
 *
 * The honest limitation, stated in the screen rather than hidden: the backend has no
 * per-document review endpoint. A therapist's credentials live in `TherapistMeta.resume` /
 * `professionalCertificates`, which only the onboarding submission writes, and nothing exposes a
 * per-document verification state. So each uploaded file's URL is recorded locally against the
 * slot it was uploaded for, and the screen says plainly that the team reviews them manually.
 * The alternative — inventing a green "Verified" tick per document — would be a lie.
 */

const REQUIRED_DOCUMENTS = [
  {
    id: "registration",
    title: "Registration certificate",
    subtitle: "State council registration",
  },
  { id: "government-id", title: "Government ID", subtitle: "Aadhaar, PAN, or passport" },
  { id: "degree", title: "Degree certificate", subtitle: "BPT / MPT qualification proof" },
  {
    id: "address",
    title: "Clinic address proof",
    subtitle: "Utility bill or rent agreement (clinic mode)",
  },
] as const;

type SlotId = (typeof REQUIRED_DOCUMENTS)[number]["id"];

export default function DocumentsScreen() {
  const therapist = useAuthStore((s) => s.therapist);
  const showToast = useAppStore((s) => s.showToast);
  const isVerified = !!therapist?.isVerified;

  const [documents, setDocuments] = useState<Record<string, KycDocumentRecord>>({});
  /** Which slot's source sheet is open. Cleared as soon as a source is chosen. */
  const [activeSlot, setActiveSlot] = useState<SlotId | null>(null);
  /**
   * Which slot is mid-upload. Tracked separately from `activeSlot` because that one is cleared
   * to dismiss the sheet before the upload starts — reusing it for the spinner would mean the
   * spinner never appears.
   */
  const [uploadingSlot, setUploadingSlot] = useState<SlotId | null>(null);
  const { busy, upload } = useFileUpload("kyc");
  const { db } = useDatabase();

  useFocusEffect(
    useCallback(() => {
      if (!db) return;
      let cancelled = false;
      getKycDocuments(db)
        .then((docs) => {
          if (!cancelled) setDocuments(docs);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  const handleUpload = async (source: "camera" | "gallery" | "files") => {
    const slot = activeSlot;
    setActiveSlot(null);
    if (!slot) return;
    setUploadingSlot(slot);
    try {
      const picked = await upload(() =>
        source === "camera"
          ? captureImage({ allowsEditing: false })
          : source === "gallery"
            ? pickImageFromLibrary({ allowsEditing: false })
            : pickDocument(),
      );
      if (!picked) return; // cancelled
      const record: KycDocumentRecord = {
        slotId: slot,
        url: picked.url,
        name: picked.file.name,
        mimeType: picked.file.mimeType,
        uploadedAt: Date.now(),
      };
      if (db) await saveKycDocument(db, record);
      setDocuments((prev) => ({ ...prev, [slot]: record }));
      showToast("Document uploaded — our team will review it", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't upload that document. Try again.", "error");
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleRemove = async (slot: SlotId) => {
    if (db) await removeKycDocument(db, slot);
    setDocuments((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    showToast("Removed from this device. Already-submitted copies stay with our team.");
  };

  const uploadedCount = REQUIRED_DOCUMENTS.filter((d) => documents[d.id]).length;

  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} title="Documents" subtitle="Verification" showNotification={false} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-3.5 pb-8">
        <View
          className="rounded-md p-4 border"
          style={{
            backgroundColor: isVerified ? "rgba(35,145,73,0.06)" : "rgba(209,154,18,0.06)",
            borderColor: isVerified ? "rgba(35,145,73,0.25)" : "rgba(209,154,18,0.25)",
          }}
        >
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View
              className="w-12 h-12 rounded-[14px] items-center justify-center"
              style={{ backgroundColor: isVerified ? "rgba(35,145,73,0.12)" : "rgba(209,154,18,0.12)" }}
            >
              {isVerified ? (
                <ShieldCheck size={26} color={COLORS.success} />
              ) : (
                <ShieldAlert size={26} color={COLORS.warning} />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-[17px] font-extrabold text-fg">
                {isVerified ? "Profile verified" : "Verification pending"}
              </Text>
              <Text className="text-muted text-[12px] mt-0.5">
                {isVerified
                  ? "Your credentials are verified — you can receive patient bookings."
                  : "Our team is reviewing your credentials. You'll be notified once verified."}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-center justify-between mt-4 mb-2">
          <Text className="text-[15px] font-bold text-fg">Documents for verification</Text>
          <Badge variant={uploadedCount === REQUIRED_DOCUMENTS.length ? "success" : "neutral"} size="sm" dot={false}>
            {`${uploadedCount}/${REQUIRED_DOCUMENTS.length} uploaded`}
          </Badge>
        </View>

        <View style={{ gap: 10 }}>
          {REQUIRED_DOCUMENTS.map((doc) => {
            const uploaded = documents[doc.id];
            return (
              <View
                key={doc.id}
                className="bg-white border border-border rounded-md p-3.5"
                style={{ gap: 10, shadowColor: COLORS.nav, shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}
              >
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  <View
                    className="w-10 h-10 rounded-[12px] items-center justify-center"
                    style={{ backgroundColor: uploaded ? "rgba(35,145,73,0.1)" : COLORS.primarySoft }}
                  >
                    {uploaded ? (
                      <CheckCircle2 size={19} color={COLORS.success} />
                    ) : (
                      <FileText size={19} color={COLORS.accent} />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-[13px] font-bold text-fg">{doc.title}</Text>
                    <Text className="text-muted text-[11px] mt-0.5">{doc.subtitle}</Text>
                  </View>
                  {uploaded ? (
                    <Badge variant="success" size="sm">
                      Submitted
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      Needed
                    </Badge>
                  )}
                </View>

                {uploaded ? (
                  <View
                    className="flex-row items-center rounded-[10px] px-2.5 py-2"
                    style={{ gap: 8, backgroundColor: "rgba(0,64,96,0.035)" }}
                  >
                    <FileText size={13} color={COLORS.muted} />
                    <Text className="flex-1 text-[11.5px] text-fg" numberOfLines={1}>
                      {uploaded.name}
                    </Text>
                    <Pressable
                      onPress={() => WebBrowser.openBrowserAsync(uploaded.url)}
                      hitSlop={8}
                      className="active:opacity-70"
                      accessibilityLabel={`Open ${uploaded.name}`}
                    >
                      <ExternalLink size={15} color={COLORS.accent} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleRemove(doc.id)}
                      hitSlop={8}
                      className="active:opacity-70"
                      accessibilityLabel={`Remove ${uploaded.name}`}
                    >
                      <Trash2 size={15} color={COLORS.danger} />
                    </Pressable>
                  </View>
                ) : null}

                <Pressable
                  onPress={() => setActiveSlot(doc.id)}
                  disabled={busy}
                  className="h-[36px] rounded-[10px] border-[1.5px] border-dashed items-center justify-center flex-row active:opacity-70"
                  style={{ gap: 6, borderColor: "rgba(0,64,96,0.25)" }}
                >
                  {uploadingSlot === doc.id ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : (
                    <Upload size={14} color={COLORS.accent} />
                  )}
                  <Text className="text-accent font-bold text-[12px]">
                    {uploadingSlot === doc.id
                      ? "Uploading…"
                      : uploaded
                        ? "Replace document"
                        : "Upload document"}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View className="flex-row bg-info/5 border border-info/20 rounded-md p-3 mt-4" style={{ gap: 8 }}>
          <Info size={16} color={COLORS.info} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[12px] text-fg/80">
            Uploads are sent to Physiobuddies for manual review — there is no automatic per-document
            approval, so the status above is your overall account verification. PDF or photo, up to
            8&nbsp;MB each.
          </Text>
        </View>
      </ScrollView>

      <BottomSheet visible={activeSlot !== null} onClose={() => setActiveSlot(null)}>
        <View style={{ gap: 12 }}>
          <Text className="text-[16px] font-extrabold text-fg">
            {REQUIRED_DOCUMENTS.find((d) => d.id === activeSlot)?.title ?? "Upload document"}
          </Text>
          <Text className="text-muted text-[12px]">
            Make sure the whole document is in frame and the text is readable.
          </Text>
          <Button variant="primary" fullWidth onPress={() => handleUpload("camera")}>
            <Camera size={16} color="#fff" />
            <Text className="text-white font-bold text-[14px]">Scan with camera</Text>
          </Button>
          <Button variant="secondary" fullWidth onPress={() => handleUpload("gallery")}>
            <ImageIcon size={16} color={COLORS.accent} />
            <Text className="text-accent font-bold text-[14px]">Choose a photo</Text>
          </Button>
          <Button variant="secondary" fullWidth onPress={() => handleUpload("files")}>
            <FolderOpen size={16} color={COLORS.accent} />
            <Text className="text-accent font-bold text-[14px]">Choose a PDF</Text>
          </Button>
        </View>
      </BottomSheet>
    </View>
  );
}
