import { Modal, View, Pressable, type ViewProps } from "react-native";
import { useState, useCallback, type ReactNode } from "react";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/45" onPress={onClose} />
      <View className="bg-white rounded-t-[20px] px-3.5 pb-7 pt-2" style={{ gap: 12 }}>
        <View className="h-1 w-9 rounded-full bg-border self-center mb-2" />
        {children}
      </View>
    </Modal>
  );
}

interface SheetRowProps extends ViewProps {
  children: ReactNode;
}

export function SheetRow({ children, ...props }: SheetRowProps) {
  return <View {...props}>{children}</View>;
}

export function useBottomSheet() {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  return { visible, open, close };
}
