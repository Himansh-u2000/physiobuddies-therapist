import * as Location from "expo-location";
import { useCallback, useState } from "react";

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
    (destLat: number, destLng: number, label?: string) => {
      const scheme = `geo:${destLat},${destLng}?q=${destLat},${destLng}${label ? `(${label})` : ""}`;
      return scheme;
    },
    [],
  );

  return { location, errorMsg, requestPermission, getCurrentLocation, openInMaps };
}
