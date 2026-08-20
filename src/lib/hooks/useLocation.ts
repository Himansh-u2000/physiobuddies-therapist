import * as Location from "expo-location";
import { useCallback, useState } from "react";
import { Linking, Platform } from "react-native";

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // True once the OS says it won't prompt again — distinct from "denied but can ask again",
  // which the native re-request already covers with no extra UI needed.
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  const requestPermission = useCallback(async () => {
    const result = await Location.requestForegroundPermissionsAsync();
    if (result.status !== "granted") {
      setErrorMsg("Location permission denied");
      setPermissionBlocked(!result.canAskAgain);
      return false;
    }
    setPermissionBlocked(false);
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

  /**
   * Open the maps app on a free-text address instead of coordinates.
   *
   * This is the path the therapist app actually takes today: the therapist-side booking detail
   * (`GET /therapist/sessions/my-bookings/:id`) returns the patient's address but strips the
   * lat/lng that the record carries — see `formatTherapistBookingDetail` server-side — so
   * `openInMaps` has nothing to aim at. The Physiobuddies web app's therapist booking page has
   * the same gap and solves it the same way, by handing Google Maps the address string
   * (`maps/search/?api=1&query=…`). Maps geocodes it and offers directions from there.
   *
   * Kept separate from `openInMaps` rather than folded into it: a text query resolves to a
   * best-guess pin, which is right for "take me to this address" but wrong anywhere the caller
   * genuinely needs the recorded point.
   */
  const openAddressInMaps = useCallback(async (address: string) => {
    const query = encodeURIComponent(address.trim());
    if (!query) return false;
    // `geo:0,0?q=` is the Android intent for "search for this text"; the leading 0,0 is the
    // documented way to say "no coordinates, use the query". iOS takes the same idea as `?q=`.
    const nativeUrl =
      Platform.OS === "ios" ? `maps://?q=${query}` : `geo:0,0?q=${query}`;
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    const canOpenNative = await Linking.canOpenURL(nativeUrl);
    await Linking.openURL(canOpenNative ? nativeUrl : webUrl);
    return true;
  }, []);

  return {
    location,
    errorMsg,
    permissionBlocked,
    requestPermission,
    getCurrentLocation,
    openInMaps,
    openAddressInMaps,
  };
}
