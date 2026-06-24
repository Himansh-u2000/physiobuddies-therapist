import { View, Text, Pressable } from "react-native";
import { useAppStore } from "@/lib/stores/app.store";

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <View className="absolute left-3.5 right-3.5 z-50" style={{ bottom: 88 }}>
      {toasts.map((toast) => (
        <Pressable
          key={toast.id}
          onPress={() => dismiss(toast.id)}
          className="bg-fg/95 rounded-[13px] px-4 py-3.5 mb-2"
          style={{ shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}
        >
          <Text className="text-white text-[13px] font-bold">{toast.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}
