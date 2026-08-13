import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PlayCircle, PauseCircle } from "lucide-react-native";
import { useInterruptedSession } from "@/lib/hooks/useInterruptedSession";
import { formatTime, getSessionTypeTheme } from "@/lib/utils/format";

/**
 * The way back into a session that was never finished — the app killed mid-session, or the
 * therapist tapping "Pause / Emergency stop". Both cases persisted safely to SQLite and then
 * had nowhere to go: the data was durable but unreachable, so the session simply looked lost.
 *
 * Renders nothing when there's nothing unfinished, which is the normal state.
 */
export function ResumeSessionCard() {
  const { draft, resume } = useInterruptedSession();

  if (!draft) return null;

  const paused = draft.status === "paused";
  const theme = getSessionTypeTheme(draft.type);
  const Icon = paused ? PauseCircle : PlayCircle;

  return (
    <Pressable onPress={resume} className="mt-3 active:opacity-90">
      <LinearGradient
        colors={theme.grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-md overflow-hidden p-3.5"
      >
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <View className="w-11 h-11 rounded-[14px] items-center justify-center bg-white/20">
            <Icon size={22} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-white/80 text-[10px] font-bold uppercase tracking-wide">
              {paused ? "Session paused" : "Session in progress"}
            </Text>
            <Text className="text-white text-[15px] font-extrabold mt-0.5" numberOfLines={1}>
              {draft.patientName}
            </Text>
            <Text className="text-white/75 text-[12px]" numberOfLines={1}>
              {draft.condition} · {formatTime(draft.elapsedSeconds)} elapsed
            </Text>
          </View>
          <View className="bg-white rounded-[10px] px-3 py-2">
            <Text className="text-[12px] font-extrabold" style={{ color: theme.solid }}>
              Resume
            </Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
