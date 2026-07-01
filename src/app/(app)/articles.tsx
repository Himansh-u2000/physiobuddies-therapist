import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { BookOpenText, Clock3, Eye, PencilLine, Plus, Send } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { Button, Chip } from "@/components/ui";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";

const categories = ["All", "Back pain", "Post-op", "Senior care", "Ergonomics"] as const;

const articles = [
  {
    title: "5 safe desk stretches for lower back stiffness",
    category: "Back pain",
    status: "Published",
    views: 1240,
    readTime: "4 min",
    updated: "Updated 21 Jun",
  },
  {
    title: "ACL rehab milestones after week six",
    category: "Post-op",
    status: "Draft",
    views: 0,
    readTime: "6 min",
    updated: "Edited today",
  },
  {
    title: "Fall-prevention exercises for older adults",
    category: "Senior care",
    status: "Review",
    views: 380,
    readTime: "5 min",
    updated: "Submitted 24 Jun",
  },
] as const;

export default function ArticlesScreen() {
  const therapist = useAuthStore((s) => s.therapist);
  const showToast = useAppStore((s) => s.showToast);
  const [selectedCategory, setSelectedCategory] = useState<(typeof categories)[number]>("All");
  const visibleArticles =
    selectedCategory === "All" ? articles : articles.filter((article) => article.category === selectedCategory);

  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} title="Articles" subtitle="Health content" showNotification={false} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-3.5 pb-8">
        <View className="bg-white border border-border rounded-md p-4" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-[18px] font-extrabold text-fg">Patient education library</Text>
              <Text className="text-muted text-[12px] mt-1">Create short rehab articles to share after sessions.</Text>
            </View>
            <View className="w-12 h-12 rounded-[14px] bg-primary-soft items-center justify-center">
              <BookOpenText size={24} color={COLORS.accent} />
            </View>
          </View>
          <View className="flex-row mt-4" style={{ gap: 8 }}>
            <Metric value="2" label="Published" />
            <Metric value="1" label="Draft" />
            <Metric value="1.6k" label="Views" />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
          <View className="flex-row" style={{ gap: 8 }}>
            {categories.map((category) => (
              <Chip
                key={category}
                selectable
                selected={selectedCategory === category}
                onPress={() => setSelectedCategory(category)}
              >
                {category}
              </Chip>
            ))}
          </View>
        </ScrollView>

        <View className="mt-3" style={{ gap: 10 }}>
          {visibleArticles.map((article) => (
            <ArticleCard key={article.title} {...article} onPress={() => showToast(`Opening ${article.title}`)} />
          ))}
        </View>

        <Button onPress={() => showToast("Article editor will open")}>
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
      <Text className="text-[18px] font-black text-fg" style={{ fontFamily: "monospace" }}>{value}</Text>
      <Text className="text-muted text-[10px] font-bold uppercase">{label}</Text>
    </View>
  );
}

function ArticleCard({
  title,
  category,
  status,
  views,
  readTime,
  updated,
  onPress,
}: {
  title: string;
  category: string;
  status: "Published" | "Draft" | "Review";
  views: number;
  readTime: string;
  updated: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="bg-white border border-border rounded-md p-3.5 active:opacity-80" style={{ gap: 12 }}>
      <View className="flex-row items-start" style={{ gap: 12 }}>
        <View className="w-11 h-11 rounded-[13px] bg-primary-soft items-center justify-center">
          <PencilLine size={20} color={COLORS.accent} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Chip variant="info">{category}</Chip>
            <Chip variant={status === "Published" ? "active" : status === "Review" ? "pending" : "neutral"}>{status}</Chip>
          </View>
          <Text className="text-[14px] font-bold text-fg mt-2 leading-5">{title}</Text>
          <Text className="text-muted text-[11px] mt-1">{updated}</Text>
        </View>
      </View>
      <View className="flex-row border-t border-border pt-2.5" style={{ gap: 12 }}>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <Eye size={14} color={COLORS.muted} />
          <Text className="text-muted text-[11px] font-semibold">{views} views</Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <Clock3 size={14} color={COLORS.muted} />
          <Text className="text-muted text-[11px] font-semibold">{readTime}</Text>
        </View>
        <View className="flex-1" />
        <Send size={14} color={COLORS.accent} />
      </View>
    </Pressable>
  );
}
