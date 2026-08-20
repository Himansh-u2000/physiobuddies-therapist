import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, ChevronRight, PencilLine, Plus, TriangleAlert } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import {
  Button,
  Skeleton,
  EmptyState,
  ErrorState,
  FLOATING_TAB_BAR_INSET,
} from "@/components/ui";
import { contentApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/stores/auth.store";
import { COLORS } from "@/constants/config";
import type { TherapistArticle } from "@/types";
import { GlassSurface, GlassLayer, GLASS_ENABLED } from "@/components/ui/Glass";

/**
 * Patient-education articles.
 *
 * **Write and read only.** You can publish a new article (`/article-editor`) and open any
 * published one to read it (`/article-view`); there is deliberately no edit or delete. The list
 * read `GET /therapist/:id/articles` returns rows without an `id`, so a row that came back from
 * a refetch has nothing to address a `PATCH`/`DELETE` to — see BACKEND_TODO §1.8. Content is
 * stored as Markdown.
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["articles"],
    queryFn: contentApi.listArticles,
  });
  const articles = data ?? [];

  const openCreate = () => router.push("/article-editor");

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
      <TopBar
        therapist={therapist}
        title="Articles"
        subtitle="Health content"
        showNotification={false}
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-3.5"
        contentContainerStyle={{ gap: 12, paddingBottom: 32 + FLOATING_TAB_BAR_INSET }}
      >
        <GlassSurface
          fallbackClassName="bg-white"
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

function ArticleCard({ article, onPress }: { article: TherapistArticle; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Read ${article.title}`}
      className={`border border-border rounded-md p-3.5 active:opacity-90 ${GLASS_ENABLED ? "" : "bg-white"}`}
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
        <ChevronRight size={18} color={COLORS.muted} style={{ marginTop: 2 }} />
      </View>
    </Pressable>
  );
}
