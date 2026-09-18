import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenText, ChevronRight, PencilLine, Plus, TriangleAlert, Trash2 } from "lucide-react-native";
import { AppHeader } from "@/components/shared/AppHeader";
import {
  Button,
  BottomSheet,
  Skeleton,
  EmptyState,
  ErrorState,
  FLOATING_TAB_BAR_INSET,
} from "@/components/ui";
import { contentApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";
import type { TherapistArticle } from "@/types";
import { GlassSurface, GlassLayer, GLASS_ENABLED } from "@/components/ui/Glass";

/**
 * Patient-education articles.
 *
 * Create, read and **delete**. Delete works now because the list read moved from the public
 * `GET /therapist/:id/articles`, whose rows carry no `id`, to the authenticated
 * `GET /therapist/articles/`, whose rows do — see the note on `contentApi`. Content is stored
 * as Markdown.
 *
 * Deleting asks first and says the piece is gone for good: there is no server-side trash or
 * undo, and a published article is real work to recreate.
 */

/** Strip Markdown markers for a plain-text card preview. */
function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/(\*\*|__|\*|_|`)/g, "")
    .replace(/\n{2,}/g, "  ")
    .trim();
}

export default function ArticlesScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();

  const [pendingDelete, setPendingDelete] = useState<TherapistArticle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["articles"],
    queryFn: contentApi.listArticles,
  });
  const articles = data ?? [];

  const openCreate = () => router.push("/article-editor");

  const confirmDelete = async () => {
    if (!pendingDelete?.id || deleting) return;
    setDeleting(true);
    try {
      await contentApi.deleteArticle(pendingDelete.id);
      showToast("Article deleted", "success");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't delete that article.", "error");
    } finally {
      setDeleting(false);
    }
  };

  // The article is handed over as params rather than fetched by id, because the list read
  // doesn't return one. Native params are passed in memory, so a long article is fine here.
  const openArticle = (article: TherapistArticle) =>
    router.push({
      pathname: "/article-view",
      params: {
        title: article.title,
        content: article.content,
        dateLabel: article.dateLabel ?? "",
      },
    });

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Articles" subtitle="Health content" />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-3.5"
        contentContainerStyle={{ gap: 12, paddingBottom: 32 + FLOATING_TAB_BAR_INSET }}
      >
        <GlassSurface
          fallbackClassName="bg-card"
          glassRadius={12}
          className="border border-border rounded-md p-4"
          style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-[18px] font-extrabold text-fg">Patient education library</Text>
              <Text className="text-muted text-[12px] mt-1">
                Write formatted rehab articles to share after sessions.
              </Text>
            </View>
            <View className="w-12 h-12 rounded-[14px] bg-primary-soft items-center justify-center">
              <BookOpenText size={24} color={COLORS.accent} />
            </View>
          </View>
          <View className="flex-row mt-4" style={{ gap: 8 }}>
            <Metric value={isLoading ? "—" : String(articles.length)} label="Published" />
          </View>
        </GlassSurface>

        {isLoading ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={110} radius={12} />
            <Skeleton height={110} radius={12} />
          </View>
        ) : isError ? (
          <ErrorState
            icon={TriangleAlert}
            title="Couldn't load your articles"
            badge="Error"
            description="We couldn't reach the server right now. This is usually temporary."
            action={{ label: "Try again", onPress: () => refetch() }}
          />
        ) : articles.length === 0 ? (
          <EmptyState
            icon={BookOpenText}
            title="No articles yet"
            description="Write a short piece your patients can read after a session — posture tips, recovery milestones, home exercises."
            action={{ label: "Create article", onPress: openCreate }}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {articles.map((article, i) => (
              <ArticleCard
                key={article.id ?? `${article.title}-${i}`}
                article={article}
                onPress={() => openArticle(article)}
                onDelete={article.id ? () => setPendingDelete(article) : undefined}
              />
            ))}
          </View>
        )}

        <Button onPress={openCreate}>
          <Plus size={16} color="#fff" />
          <Text className="text-white font-bold text-[14px]">Create article</Text>
        </Button>
      </ScrollView>

      <BottomSheet visible={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <View style={{ gap: 14 }}>
          <Text className="text-[16px] font-extrabold text-fg">Delete this article?</Text>
          <Text className="text-muted text-[12.5px]">
            <Text className="text-fg font-bold">{pendingDelete?.title}</Text>
            {pendingDelete?.dateLabel ? ` · ${pendingDelete.dateLabel}` : ""}
          </Text>
          <View className="flex-row bg-danger/8 border border-danger/25 rounded-md p-2.5" style={{ gap: 8 }}>
            <TriangleAlert size={15} color={COLORS.danger} style={{ marginTop: 1 }} />
            <Text className="flex-1 text-[11.5px] text-fg/80">
              This removes it from your public profile permanently. It can&apos;t be undone, and
              patients who were given the link will no longer be able to read it.
            </Text>
          </View>
          <Button variant="danger" fullWidth onPress={confirmDelete} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator color={COLORS.danger} />
            ) : (
              <>
                <Trash2 size={16} color={COLORS.danger} />
                <Text className="text-danger font-bold text-[14px]">Delete article</Text>
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

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 rounded-[12px] bg-bg p-2.5">
      <Text className="text-[18px] font-black text-fg" style={{ fontFamily: "monospace" }}>
        {value}
      </Text>
      <Text className="text-muted text-[10px] font-bold uppercase">{label}</Text>
    </View>
  );
}

function ArticleCard({
  article,
  onPress,
  onDelete,
}: {
  article: TherapistArticle;
  onPress: () => void;
  /** Omitted when the row arrived without an `id` — see `BackendArticle`. */
  onDelete?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Read ${article.title}`}
      className={`border border-border rounded-md p-3.5 active:opacity-90 ${GLASS_ENABLED ? "" : "bg-card"}`}
      style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
    >
      <GlassLayer radius={12} />
      <View className="flex-row items-start" style={{ gap: 12 }}>
        <View className="w-11 h-11 rounded-[13px] bg-primary-soft items-center justify-center">
          <PencilLine size={20} color={COLORS.accent} />
        </View>
        <View className="flex-1">
          <Text className="text-[14px] font-bold text-fg leading-5">{article.title}</Text>
          {article.dateLabel ? (
            <Text className="text-muted text-[11px] mt-1">{article.dateLabel}</Text>
          ) : null}
          <Text className="text-muted text-[12px] mt-1.5 leading-4" numberOfLines={3}>
            {stripMarkdown(article.content)}
          </Text>
        </View>
        <View className="items-center" style={{ gap: 10 }}>
          <ChevronRight size={18} color={COLORS.muted} style={{ marginTop: 2 }} />
          {onDelete && (
            // Generous hitSlop and its own accessibility label: this sits inside a Pressable
            // card, so the destructive control must be unmistakably separate from "open".
            <Pressable
              onPress={onDelete}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${article.title}`}
              className="w-8 h-8 rounded-[10px] items-center justify-center active:opacity-60"
              style={{ backgroundColor: "rgba(207,66,56,0.08)" }}
            >
              <Trash2 size={15} color={COLORS.danger} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}
