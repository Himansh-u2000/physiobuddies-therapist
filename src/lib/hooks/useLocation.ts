import * as Location from "expo-location";
import { useCallback, useState } from "react";
import { Linking, Platform } from "react-native";

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const requestPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setErrorMsg("Location permission denied");
      return false;
    }
    return true;
  }, []);

  const getCurrentLocation = useCallback(async () => {
    const granted = await requestPermission();
    if (!granted) return null;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc);
      return loc;
    } catch {
      setErrorMsg("Unable to get current location");
      return null;
    }
  }, [requestPermission]);

  const openInMaps = useCallback(
    async (destLat: number, destLng: number, label?: string) => {
      const encodedLabel = encodeURIComponent(label ?? "Patient location");
      const destination = `${destLat},${destLng}`;
      const nativeUrl =
        Platform.OS === "ios"
          ? `maps://?daddr=${destination}&q=${encodedLabel}`
          : `google.navigation:q=${destination}`;
      const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving&query=${encodedLabel}`;
      const canOpenNative = await Linking.canOpenURL(nativeUrl);
      await Linking.openURL(canOpenNative ? nativeUrl : webUrl);
    },
    [],
  );

  return { location, errorMsg, requestPermission, getCurrentLocation, openInMaps };
}
