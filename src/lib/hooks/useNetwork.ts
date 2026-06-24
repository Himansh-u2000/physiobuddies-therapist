import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/stores/app.store";

export function useNetwork() {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<string>("unknown");
  const setOnline = useAppStore((s) => s.setOnline);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? false;
      setIsConnected(connected);
      setConnectionType(state.type);
      setOnline(connected);
    });
    return () => unsubscribe();
  }, [setOnline]);

  return { isConnected, connectionType };
}
