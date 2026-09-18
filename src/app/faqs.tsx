import { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  type TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Plus, TriangleAlert, X, Check, Trash2 } from "lucide-react-native";
import { Button, BottomSheet, Input, TextArea, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { contentApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";
import type { TherapistFaq } from "@/types";
import { GlassSurface } from "@/components/ui/Glass";

import { AppHeader, HeaderAction } from "@/components/shared/AppHeader";
/** Enough to answer properly; long enough that hitting it is a sign to split the FAQ in two. */
const QUESTION_MAX = 160;
const ANSWER_MAX = 600;

/** Starters, so an empty screen isn't also a blank page. Tapping one fills the question field. */
const SUGGESTIONS = [
  "How long is each session?",
  "What should I wear?",
  "Do you visit at home?",
  "What is your cancellation policy?",
];

/**
 * Therapist FAQs — the Q&A shown on the public profile.
 *
 * Add, read and **delete**. Delete works now because the list read moved from the public
 * `GET /therapist/:id/faqs`, whose rows carry no `id`, to the authenticated
 * `GET /therapist/faqs/`, whose rows do — see the note on `contentApi`. Removal is confirmed
 * first and is permanent; there is no server-side undo.
 *
 * The composer used to be a `BottomSheet`. On a phone that meant the answer field sat directly
 * under the keyboard with no way to scroll it into view, so writing more than a line was a
 * fight. It is now an inline card inside the screen's own `KeyboardAvoidingView` + `ScrollView`,
 * with character counters and tap-to-fill starters.
 */
export default function FaqsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();
  const answerRef = useRef<TextInput>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TherapistFaq | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["faqs"],
    queryFn: contentApi.listFaqs,
  });
  const faqs = data ?? [];

  const resetComposer = () => {
    setQuestion("");
    setAnswer("");
    setTouched(false);
  };

  const openCreate = () => {
    resetComposer();
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    resetComposer();
  };

  const questionError = touched && question.trim().length === 0 ? "Write the question first" : "";
  const answerError = touched && answer.trim().length === 0 ? "An answer is required" : "";
  const canSave = !saving && question.trim().length > 0 && answer.trim().length > 0;

  const handleSave = async () => {
    setTouched(true);
    if (!canSave) return;
    setSaving(true);
    try {
      // Verified against the live API 2026-08-18: POST /therapist/faqs { question, answer }
      // → 200 { id, question, answer, createdAt }. Trimmed because trailing whitespace from a
      // soft keyboard would otherwise end up on the public profile.
      await contentApi.createFaq(question.trim(), answer.trim());
      showToast("FAQ added", "success");
      closeComposer();
      await queryClient.invalidateQueries({ queryKey: ["faqs"] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't save the FAQ.", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete?.id || deleting) return;
    setDeleting(true);
    try {
      await contentApi.deleteFaq(pendingDelete.id);
      showToast("FAQ deleted", "success");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["faqs"] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't delete that FAQ.", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="FAQs"
        subtitle="Answers patients see on your profile"
        onBack={() => router.back()}
        right={
          !composerOpen && faqs.length > 0 ? (
            <HeaderAction label="Add" icon={<Plus size={15} color="#fff" />} onPress={openCreate} />
          ) : undefined
        }
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingTop: 12,
            // Room for the keyboard on Android, where `behavior="padding"` isn't used.
            paddingBottom: insets.bottom + 120,
            gap: 12,
          }}
        >
          {!composerOpen && (
            <GlassSurface
              fallbackClassName="bg-card"
              glassRadius={12}
              className="border border-border rounded-md p-4"
              style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-[18px] font-extrabold text-fg">
                    Frequently asked questions
                  </Text>
                  <Text className="text-muted text-[12px] mt-1">
                    Answer common patient questions up front — they show on your public profile.
                  </Text>
                </View>
                <View className="w-12 h-12 rounded-[14px] bg-primary-soft items-center justify-center">
                  <MessagesSquare size={24} color={COLORS.accent} />
                </View>
              </View>
            </GlassSurface>
          )}

          {composerOpen && (
            <View
              className="bg-card border-[1.5px] border-accent/25 rounded-md p-4"
              style={{
                gap: 14,
                shadowColor: COLORS.nav,
                shadowOpacity: 0.1,
                shadowRadius: 14,
                elevation: 4,
              }}
            >
              <View className="flex-row items-center">
                <Text className="text-[15px] font-extrabold text-fg flex-1">New FAQ</Text>
                <Pressable
                  onPress={closeComposer}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  className="w-7 h-7 rounded-full bg-bg items-center justify-center active:opacity-70"
                >
                  <X size={14} color={COLORS.muted} />
                </Pressable>
              </View>

              <View style={{ gap: 6 }}>
                <Input
                  label="Question"
                  value={question}
                  onChangeText={setQuestion}
                  invalid={!!questionError}
                  error={questionError}
                  placeholder="e.g. How long is each session?"
                  maxLength={QUESTION_MAX}
                  returnKeyType="next"
                  onSubmitEditing={() => answerRef.current?.focus()}
                  submitBehavior="submit"
                />
                <Counter value={question.length} max={QUESTION_MAX} />
              </View>

              {question.trim().length === 0 && (
                <View style={{ gap: 7 }}>
                  <Text
                    className="text-muted text-[11px] font-bold uppercase"
                    style={{ letterSpacing: 0.5 }}
                  >
                    Common questions
                  </Text>
                  <View className="flex-row flex-wrap" style={{ gap: 7 }}>
                    {SUGGESTIONS.map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => {
                          setQuestion(s);
                          answerRef.current?.focus();
                        }}
                        className="rounded-full border border-border bg-bg px-3 py-1.5 active:opacity-70"
                      >
                        <Text className="text-[11.5px] font-bold text-accent">{s}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              <View style={{ gap: 6 }}>
                <TextArea
                  ref={answerRef}
                  label="Answer"
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="Write a clear, short answer patients can act on…"
                  maxLength={ANSWER_MAX}
                  className="min-h-[130px]"
                />
                {answerError ? <Text className="text-[11px] text-danger">{answerError}</Text> : null}
                <Counter value={answer.length} max={ANSWER_MAX} />
              </View>

              <View className="flex-row" style={{ gap: 8 }}>
                <View className="flex-1">
                  <Button variant="secondary" fullWidth onPress={closeComposer} disabled={saving}>
                    Cancel
                  </Button>
                </View>
                <View className="flex-[2]">
                  {/* Left enabled while incomplete on purpose: tapping it reveals which field
                      is missing. A greyed-out button with no explanation is the version of
                      this that people report as "the submit button does nothing". */}
                  <Button variant="primary" fullWidth onPress={handleSave} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Check size={16} color="#fff" />
                        <Text className="text-white font-bold text-[14px]">Publish FAQ</Text>
                      </>
                    )}
                  </Button>
                </View>
              </View>
            </View>
          )}

          {isLoading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={90} radius={12} />
              <Skeleton height={90} radius={12} />
            </View>
          ) : isError ? (
            <ErrorState
              icon={TriangleAlert}
              title="Couldn't load your FAQs"
              badge="Error"
              description="We couldn't reach the server right now. This is usually temporary."
              action={{ label: "Try again", onPress: () => refetch() }}
            />
          ) : faqs.length === 0 ? (
            !composerOpen && (
              <EmptyState
                icon={MessagesSquare}
                title="No FAQs yet"
                description="Add answers to questions patients often ask — session length, what to wear, cancellation policy."
                action={{ label: "Add FAQ", onPress: openCreate }}
              />
            )
          ) : (
            <View style={{ gap: 10 }}>
              <Text
                className="text-muted text-[11px] font-bold uppercase"
                style={{ letterSpacing: 0.5 }}
              >
                {`${faqs.length} published`}
              </Text>
              {faqs.map((faq, i) => (
                <FaqCard
                  key={faq.id ?? `${faq.question}-${i}`}
                  faq={faq}
                  onDelete={faq.id ? () => setPendingDelete(faq) : undefined}
                />
              ))}
            </View>
          )}

          {!composerOpen && faqs.length > 0 && (
            <Button onPress={openCreate}>
              <Plus size={16} color="#fff" />
              <Text className="text-white font-bold text-[14px]">Add another FAQ</Text>
            </Button>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet visible={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <View style={{ gap: 14 }}>
          <Text className="text-[16px] font-extrabold text-fg">Delete this FAQ?</Text>
          <Text className="text-muted text-[12.5px]">{pendingDelete?.question}</Text>
          <View className="flex-row bg-danger/8 border border-danger/25 rounded-md p-2.5" style={{ gap: 8 }}>
            <TriangleAlert size={15} color={COLORS.danger} style={{ marginTop: 1 }} />
            <Text className="flex-1 text-[11.5px] text-fg/80">
              It will be removed from your public profile permanently. This can&apos;t be undone.
            </Text>
          </View>
          <Button variant="danger" fullWidth onPress={confirmDelete} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator color={COLORS.danger} />
            ) : (
              <>
                <Trash2 size={16} color={COLORS.danger} />
                <Text className="text-danger font-bold text-[14px]">Delete FAQ</Text>
              </>
            )}
          </Button>
          <Button variant="secondary" fullWidth onPress={() => setPendingDelete(null)} disabled={deleting}>
            Cancel
          </Button>
        </View>
      </BottomSheet>
    </View>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  const near = value > max * 0.9;
  return (
    <Text className={`text-[10.5px] text-right ${near ? "text-warning font-bold" : "text-muted"}`}>
      {value}/{max}
    </Text>
  );
}

/** A published FAQ, shown the way a patient reads it. */
function FaqCard({ faq, onDelete }: { faq: TherapistFaq; onDelete?: () => void }) {
  return (
    <GlassSurface
      fallbackClassName="bg-card"
      glassRadius={12}
      className="border border-border rounded-md p-3.5"
      style={{ gap: 8, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
    >
      <View className="flex-row items-start" style={{ gap: 10 }}>
        <Text className="text-[14px] font-bold text-fg leading-5 flex-1">{faq.question}</Text>
        {/* Omitted when the row arrived without an `id` — see `BackendFaq`. */}
        {onDelete && (
          <Pressable
            onPress={onDelete}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Delete FAQ: ${faq.question}`}
            className="w-8 h-8 rounded-[10px] items-center justify-center active:opacity-60"
            style={{ backgroundColor: "rgba(207,66,56,0.08)" }}
          >
            <Trash2 size={15} color={COLORS.danger} />
          </Pressable>
        )}
      </View>
      <Text className="text-muted text-[12.5px] leading-5">{faq.answer}</Text>
    </GlassSurface>
  );
}
