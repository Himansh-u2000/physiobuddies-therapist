import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenText, Lock, PencilLine, Plus, Trash2, TriangleAlert } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { Button, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { contentApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";
import type { TherapistArticle } from "@/types";

/**
 * Patient-education articles, backed by real endpoints: read via GET /therapist/:id/articles,
 * written via POST/PATCH/DELETE /therapist/articles. Create/edit happens on a full-screen
 * Markdown editor (`/article-editor`); content is stored as Markdown.
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
  const therapist = useAuthStore((s) => s.therapist);
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["articles"],
    queryFn: contentApi.listArticles,
  });
  const articles = data ?? [];

  const openCreate = () => router.push("/article-editor");

  const openEdit = (article: TherapistArticle) => {
    if (!article.id) {
      showToast("This article can't be edited — the server didn't return its id.", "error");
      return;
    }
    router.push({
      pathname: "/article-editor",
      params: { edit: "1", id: article.id, title: article.title, content: article.content },
    });
  };

  const handleDelete = async (article: TherapistArticle) => {
    if (!article.id) {
      showToast("This article can't be deleted — the server didn't return its id.", "error");
      return;
    }
    try {
      await contentApi.deleteArticle(article.id);
      showToast("Article deleted", "success");
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't delete the article.", "error");
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <TopBar
        therapist={therapist}
        title="Articles"
        subtitle="Health content"
        showNotification={false}
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-3.5 pb-8"
        contentContainerStyle={{ gap: 12 }}
      >
        <View
          className="bg-white border border-border rounded-md p-4"
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
        </View>

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
                onEdit={() => openEdit(article)}
                onDelete={() => handleDelete(article)}
              />
            ))}
          </View>
        )}

        <Button onPress={openCreate}>
          <Plus size={16} color="#fff" />
          <Text className="text-white font-bold text-[14px]">Create article</Text>
        </Button>
      </ScrollView>
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
  onEdit,
  onDelete,
}: {
  article: TherapistArticle;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onPress={onEdit}
      disabled={!article.id}
      className="bg-white border border-border rounded-md p-3.5 active:opacity-90"
      style={{ gap: 12, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
    >
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
      </View>
      {/* PATCH/DELETE are live, but the LIST read omits the id they address, so an article that
          came from a refetch can't be edited. Say so once instead of failing on tap. */}
      {!article.id ? (
        <View className="flex-row items-center border-t border-border pt-2.5" style={{ gap: 8 }}>
          <Lock size={12} color={COLORS.muted} />
          <Text className="text-muted text-[11px] flex-1">
            Read-only — the server doesn&apos;t return an id for this article, so it can&apos;t be
            edited or deleted from the app yet.
          </Text>
        </View>
      ) : (
      <View className="flex-row border-t border-border pt-2.5" style={{ gap: 16 }}>
        <Pressable
          onPress={onEdit}
          className="flex-row items-center active:opacity-70"
          style={{ gap: 5 }}
          hitSlop={6}
        >
          <PencilLine size={14} color={COLORS.accent} />
          <Text className="text-accent text-[12px] font-bold">Edit</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          className="flex-row items-center active:opacity-70"
          style={{ gap: 5 }}
          hitSlop={6}
        >
          <Trash2 size={14} color={COLORS.danger} />
          <Text className="text-danger text-[12px] font-bold">Delete</Text>
        </Pressable>
      </View>
      )}
    </Pressable>
  );
}
