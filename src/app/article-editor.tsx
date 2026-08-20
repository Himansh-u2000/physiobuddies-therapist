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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft } from "lucide-react-native";
import { Input, RichTextEditor } from "@/components/ui";
import { contentApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";
import { GlassSurface } from "@/components/ui/Glass";

/**
 * Full-screen composer for a new patient-education article, using the WYSIWYG rich-text editor.
 *
 * **Create only.** Published articles are read on `/article-view` and can't be edited from the
 * app — the list read omits the `id` a `PATCH` would need (BACKEND_TODO §1.8). Content is stored
 * as Markdown (`POST /therapist/articles`).
 */
export default function ArticleEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = !saving && title.trim().length > 0 && content.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await contentApi.createArticle(title.trim(), content.trim());
      showToast("Article published", "success");
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
      <GlassSurface
        fallbackClassName="bg-white"
        className="px-3 pb-3 flex-row items-center border-b border-border"
        style={{ paddingTop: insets.top + 10, gap: 6 }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="w-8 h-8 items-center justify-center"
        >
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg flex-1">New article</Text>
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
          <Text className="text-white font-bold text-[13px]">Publish</Text>
        </Pressable>
      </GlassSurface>

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
