import { useState, useSyncExternalStore } from "react";
import { View, Text, Pressable, ScrollView, Share } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Radio,
  Share2,
  Trash2,
} from "lucide-react-native";
import { Badge, EmptyState } from "@/components/ui";
import {
  subscribeNetLog,
  getNetLog,
  clearNetLog,
  dumpNetLog,
  formatBody,
  type NetLogEntry,
} from "@/lib/api/netlog";
import { useAppStore } from "@/lib/stores/app.store";
import { API_BASE_URL, COLORS, NETWORK_LOG_ENABLED } from "@/constants/config";
import { GlassSurface } from "@/components/ui/Glass";

/**
 * Network log — the phone's version of Chrome DevTools' Network tab.
 *
 * Reachable from Profile → Support while `NETWORK_LOG_ENABLED` is on. Rows show
 * method / path / status / duration; tapping one expands the request and response bodies as
 * the app received them (post-envelope-unwrap, so what you read here is what the mappers got).
 * "Share" exports the whole log as text, which is the fastest way to hand a failure to whoever
 * is going to fix it.
 */
export default function NetworkLogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  const entries = useSyncExternalStore(subscribeNetLog, getNetLog, getNetLog);
  const [expanded, setExpanded] = useState<string | null>(null);

  const share = async () => {
    if (entries.length === 0) return;
    try {
      await Share.share({ message: dumpNetLog(), title: "Physiobuddies network log" });
    } catch {
      showToast("Couldn't share the log.", "error");
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <GlassSurface
        fallbackClassName="bg-white"
        className="px-4 pb-3 flex-row items-center border-b border-border"
        style={{ paddingTop: insets.top + 10, gap: 8 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} className="w-8 h-8 items-center justify-center">
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg flex-1">Network log</Text>
        <Pressable onPress={share} hitSlop={8} className="w-8 h-8 items-center justify-center active:opacity-70">
          <Share2 size={18} color={COLORS.accent} />
        </Pressable>
        <Pressable
          onPress={() => {
            clearNetLog();
            setExpanded(null);
          }}
          hitSlop={8}
          className="w-8 h-8 items-center justify-center active:opacity-70"
        >
          <Trash2 size={18} color={COLORS.danger} />
        </Pressable>
      </GlassSurface>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 10 }}
      >
        <GlassSurface
          fallbackClassName="bg-white"
          glassRadius={12}
          className="border border-border rounded-md p-3">
          <Text className="text-[11px] font-bold text-muted uppercase" style={{ letterSpacing: 0.5 }}>
            Base URL
          </Text>
          <Text className="text-[12.5px] font-bold text-fg mt-1" selectable>
            {API_BASE_URL}
          </Text>
        </GlassSurface>

        {!NETWORK_LOG_ENABLED ? (
          <EmptyState
            icon={Radio}
            tone="neutral"
            title="Logging is off in this build"
            description="Rebuild with EXPO_PUBLIC_ENABLE_NETWORK_LOG=true to capture requests. The local APK script sets it for you."
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Radio}
            tone="info"
            title="No requests captured yet"
            description="Open a screen that loads data, then come back — every API call the app makes will be listed here newest first."
          />
        ) : (
          entries.map((entry) => (
            <LogRow
              key={entry.id}
              entry={entry}
              expanded={expanded === entry.id}
              onToggle={() => setExpanded((id) => (id === entry.id ? null : entry.id))}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function statusTone(entry: NetLogEntry): { variant: "success" | "danger" | "warning" | "neutral"; label: string } {
  if (entry.phase === "pending") return { variant: "warning", label: "pending" };
  if (entry.phase === "error") return { variant: "danger", label: entry.status ? String(entry.status) : "failed" };
  return { variant: "success", label: String(entry.status ?? 200) };
}

function LogRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: NetLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tone = statusTone(entry);
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <GlassSurface
      fallbackClassName="bg-white"
      glassRadius={12}
      className="border border-border rounded-md overflow-hidden">
      <Pressable onPress={onToggle} className="px-3.5 py-3 flex-row items-center active:opacity-80" style={{ gap: 10 }}>
        <Chevron size={16} color={COLORS.muted} />
        <View className="flex-1">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Text className="text-[11px] font-black text-accent">{entry.method}</Text>
            <Text className="text-[12.5px] font-bold text-fg flex-1" numberOfLines={1}>
              {entry.url}
            </Text>
          </View>
          <Text className="text-muted text-[10.5px] mt-0.5">
            {[
              entry.durationMs != null ? `${entry.durationMs} ms` : null,
              new Date(entry.startedAt).toLocaleTimeString(),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <Badge variant={tone.variant} size="sm" dot={false}>
          {tone.label}
        </Badge>
      </Pressable>

      {expanded && (
        <View className="border-t border-border px-3.5 py-3" style={{ gap: 12 }}>
          <Section label="URL" value={entry.fullUrl} />
          {entry.errorMessage ? <Section label="Error" value={entry.errorMessage} tone="danger" /> : null}
          {entry.requestHeaders ? (
            <Section label="Request headers" value={formatBody(entry.requestHeaders)} />
          ) : null}
          {entry.requestBody !== undefined ? (
            <Section label="Request payload" value={formatBody(entry.requestBody)} />
          ) : null}
          {entry.responseBody !== undefined ? (
            <Section label="Response" value={formatBody(entry.responseBody)} />
          ) : null}
        </View>
      )}
    </GlassSurface>
  );
}

function Section({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  if (!value) return null;
  return (
    <View style={{ gap: 4 }}>
      <Text className="text-[10.5px] font-bold text-muted uppercase" style={{ letterSpacing: 0.5 }}>
        {label}
      </Text>
      {/* selectable so a value can be copied out without needing a clipboard dependency. */}
      <Text
        selectable
        className={`text-[11.5px] leading-[17px] ${tone === "danger" ? "text-danger" : "text-fg"}`}
        style={{ fontFamily: "monospace" }}
      >
        {value}
      </Text>
    </View>
  );
}
