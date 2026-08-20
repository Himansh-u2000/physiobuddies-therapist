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
import { ChevronLeft, MessagesSquare, Plus, TriangleAlert, X, Check } from "lucide-react-native";
import { Button, Input, TextArea, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { contentApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";
import type { TherapistFaq } from "@/types";
import { GlassSurface } from "@/components/ui/Glass";

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
 * **Add and read: you can publish a FAQ and see the published set, and that is all.** There is
 * deliberately no edit or delete here. `GET /therapist/:id/faqs` returns rows without an `id`,
 * so anything read back from the list has nothing to address a `PATCH`/`DELETE` to — controls
 * that work until the first refetch and then stop are worse than controls that aren't there.
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

  return (
    <View className="flex-1 bg-bg">
      <GlassSurface
        fallbackClassName="bg-white"
        className="px-4 pb-3 flex-row items-center border-b border-border"
        style={{ paddingTop: insets.top + 10, gap: 8 }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="w-8 h-8 items-center justify-center"
        >
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg flex-1">FAQs</Text>
        {!composerOpen && faqs.length > 0 && (
          <Pressable
            onPress={openCreate}
            hitSlop={8}
            className="flex-row items-center active:opacity-70"
            style={{ gap: 4 }}
          >
            <Plus size={16} color={COLORS.accent} />
            <Text className="text-accent text-[12.5px] font-bold">Add</Text>
          </Pressable>
        )}
      </GlassSurface>

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
              fallbackClassName="bg-white"
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
              className="bg-white border-[1.5px] border-accent/25 rounded-md p-4"
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
                <FaqCard key={faq.id ?? `${faq.question}-${i}`} faq={faq} />
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

/** A published FAQ, shown the way a patient reads it. Read-only by design — see the screen doc. */
function FaqCard({ faq }: { faq: TherapistFaq }) {
  return (
    <GlassSurface
      fallbackClassName="bg-white"
      glassRadius={12}
      className="border border-border rounded-md p-3.5"
      style={{ gap: 8, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
    >
      <Text className="text-[14px] font-bold text-fg leading-5">{faq.question}</Text>
      <Text className="text-muted text-[12.5px] leading-5">{faq.answer}</Text>
    </GlassSurface>
  );
}
