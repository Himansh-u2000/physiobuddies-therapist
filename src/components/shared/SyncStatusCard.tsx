import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { CloudUpload, CloudOff, Image as ImageIcon } from "lucide-react-native";
import { useAppStore } from "@/lib/stores/app.store";
import { useRetrySync } from "@/lib/hooks/useSyncEngine";
import { COLORS } from "@/constants/config";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Makes the offline queue visible. Until this existed, a session record that failed to reach
 * the server was invisible to the therapist: `syncStatus` was tracked in SQLite and acted on
 * by the sync engine, but never rendered — so a payout could sit stuck indefinitely while the
 * app looked completely normal. That's the failure mode Phase 4's review called out.
 *
 * Renders nothing when the queue is empty, which is the overwhelmingly common case — this is
 * an exception surface, not a permanent dashboard fixture.
 *
 * Two distinct states, because they ask different things of the therapist:
 *  - **waiting** (informational): the queue is retrying on its own with backoff. Nothing to do.
 *  - **stuck** (actionable): parked after a non-retryable failure. Retrying is the *only*
 *    thing that moves it, so this one gets the button.
 */
export function SyncStatusCard() {
  const { pendingRecords, failedRecords, pendingPhotos } = useAppStore((s) => s.syncCounts);
  const isOnline = useAppStore((s) => s.isOnline);
  const showToast = useAppStore((s) => s.showToast);
  const retrySync = useRetrySync();
  const [retrying, setRetrying] = useState(false);

  if (pendingRecords === 0 && failedRecords === 0 && pendingPhotos === 0) return null;

  const stuck = failedRecords > 0;

  const handleRetry = async () => {
    if (!isOnline) {
      showToast("Still offline — this will send automatically once you reconnect.");
      return;
    }
    setRetrying(true);
    try {
      await retrySync();
      // The count is republished by the retry itself; read it fresh rather than from the
      // props captured when this component rendered.
      const after = useAppStore.getState().syncCounts;
      showToast(
        after.failedRecords > 0
          ? "Still couldn't send. We'll keep trying — your records are saved on this device."
          : "Sent. Your records are up to date.",
        after.failedRecords > 0 ? "error" : "success",
      );
    } finally {
      setRetrying(false);
    }
  };

  const parts: string[] = [];
  if (stuck) parts.push(plural(failedRecords, "session record", "session records"));
  else if (pendingRecords > 0) parts.push(plural(pendingRecords, "session record", "session records"));
  if (pendingPhotos > 0) parts.push(plural(pendingPhotos, "photo", "photos"));

  const Icon = stuck ? CloudOff : CloudUpload;
  const tint = stuck ? COLORS.danger : COLORS.warning;
  const bg = stuck ? "bg-danger/10" : "bg-warning/10";

  return (
    <View className="bg-white border border-border rounded-md p-3 mt-3" style={{ gap: 8 }}>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View className={`w-9 h-9 rounded-[10px] items-center justify-center ${bg}`}>
          <Icon size={18} color={tint} />
        </View>
        <View className="flex-1">
          <Text className="text-[13px] font-bold text-fg">
            {stuck ? "Couldn't send to the server" : "Waiting to sync"}
          </Text>
          <Text className="text-muted text-[12px] mt-0.5">
            {parts.join(" and ")} saved on this device
          </Text>
        </View>
        {stuck && (
          <Pressable
            onPress={handleRetry}
            disabled={retrying}
            hitSlop={8}
            className="px-3 py-2 rounded-[10px] bg-accent active:opacity-80"
          >
            {retrying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white text-[12px] font-bold">Try again</Text>
            )}
          </Pressable>
        )}
      </View>
      <Text className="text-muted text-[11px] leading-[16px]">
        {stuck
          ? "Nothing is lost — this stays on your phone until it sends."
          : isOnline
            ? "Sending in the background. You can keep working."
            : "This will send automatically once you're back online."}
      </Text>
      {pendingPhotos > 0 && !stuck && (
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <ImageIcon size={12} color={COLORS.muted} />
          <Text className="text-muted text-[11px]">Photos upload after the session record.</Text>
        </View>
      )}
    </View>
  );
}
