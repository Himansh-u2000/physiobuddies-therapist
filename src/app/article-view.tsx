import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { MarkdownText } from "@/components/ui";
import { COLORS } from "@/constants/config";
import { GlassSurface } from "@/components/ui/Glass";

/**
 * A published article, rendered the way a patient reads it.
 *
 * This is the "view" half of the create-and-view content flow: the Articles list shows a
 * three-line plain-text preview, and this screen renders the stored Markdown as formatted text
 * with `MarkdownText` — the same renderer the patient-facing surface uses, so what shows here is
 * what a patient sees rather than an approximation of it.
 *
 * The article arrives as params instead of being fetched by id because the list read doesn't
 * return one (BACKEND_TODO §1.8). Native router params are passed in memory, not through a URL,
 * so a full-length article travels fine this way.
 */
export default function ArticleViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { title, content, dateLabel } = useLocalSearchParams<{
    title?: string;
    content?: string;
    dateLabel?: string;
  }>();

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
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-8 h-8 items-center justify-center"
        >
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg flex-1" numberOfLines={1}>
          Article
        </Text>
      </GlassSurface>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <Text className="text-[22px] font-black text-fg leading-7">{title ?? "Untitled"}</Text>
        {dateLabel ? <Text className="text-muted text-[12px] mt-1.5">{dateLabel}</Text> : null}

        <View className="h-px bg-border my-4" />

        {content?.trim() ? (
          <MarkdownText content={content} />
        ) : (
          <Text className="text-muted text-[13px]">This article has no content yet.</Text>
        )}
      </ScrollView>
    </View>
  );
}
