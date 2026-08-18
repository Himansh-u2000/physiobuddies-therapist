import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft } from "lucide-react-native";
import { Input, RichTextEditor } from "@/components/ui";
import { contentApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";

/**
 * Full-screen create/edit for a patient-education article, using the Markdown rich-text editor.
 * Reached from the Articles screen with `edit=1` + the article fields for edit, or with no params
 * for a new article. Content is a Markdown string
 * (`POST /therapist/articles`, `PATCH /therapist/articles/:id`).
 */
export default function ArticleEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    content?: string;
    edit?: string;
  }>();

  const isEdit = params.edit === "1";
  const [title, setTitle] = useState(params.title ?? "");
  const [content, setContent] = useState(params.content ?? "");
  const [saving, setSaving] = useState(false);

  const canSave = !saving && title.trim().length > 0 && content.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit) {
        // The list read shape omits `id`, so an article can be un-editable — block rather than
        // fall back to create (which would silently duplicate).
        if (!params.id) {
          throw new Error("This article can't be edited — the server didn't return its id.");
        }
        await contentApi.updateArticle(params.id, { title: title.trim(), content: content.trim() });
        showToast("Article updated", "success");
      } else {
        await contentApi.createArticle(title.trim(), content.trim());
        showToast("Article published", "success");
      }
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
      router.back();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't save the article.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <View
        className="px-3 pb-3 flex-row items-center bg-white border-b border-border"
        style={{ paddingTop: insets.top + 10, gap: 6 }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="w-8 h-8 items-center justify-center"
        >
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg flex-1">
          {isEdit ? "Edit article" : "New article"}
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          className={`flex-row items-center px-3.5 h-9 rounded-[11px] ${
            canSave ? "bg-accent active:opacity-80" : "bg-border"
          }`}
          style={{ gap: 6 }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Check size={16} color="#fff" />
          )}
          <Text className="text-white font-bold text-[13px]">{isEdit ? "Save" : "Publish"}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top + 60}
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-3.5 pt-3"
          contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 14 }}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. 5 safe desk stretches"
          />
          <RichTextEditor
            label="Content"
            value={content}
            onChangeText={setContent}
            placeholder="Write the article your patients will read..."
            minHeight={280}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
