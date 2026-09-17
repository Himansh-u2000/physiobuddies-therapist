import { useCallback, useState } from "react";
import { View, Text } from "react-native";
import Constants from "expo-constants";
import { useFocusEffect } from "expo-router";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { House, Navigation } from "lucide-react-native";
import { COLORS } from "@/constants/config";
import { formatDistance, haversineKm, regionFor, type LatLng } from "@/lib/utils/geo";

/**
 * The map on the "navigate to patient" screen.
 *
 * ## Why this replaced a drawing
 *
 * What was here was not a low-fidelity map, it was a *picture* of one: a flat panel with two dots
 * at hardcoded percentages (`left: "38%"`, `top: 45`), identical for every appointment. The "You"
 * marker in particular was a fabrication — it implied the therapist's position relative to the
 * patient on a screen whose entire job is orientation before a home visit. A therapist glancing
 * at it to sanity-check direction was reading noise.
 *
 * ## Degrading honestly
 *
 * Three things can be missing independently, and each has to look like what it is rather than
 * like a broken map:
 *
 *   - **No API key** (`mapsEnabled` false) — the Maps SDK renders a blank grey rectangle without
 *     one, which is worse than no map. Falls back to the address card.
 *   - **No patient coordinates** — the therapist's copy of a booking used to strip `location
 *     .coords` (BACKEND_TODO §1.12); it now carries them, but a booking saved before that, or one
 *     with a half-populated pair, still arrives without. Nothing to centre on, so: card.
 *   - **No therapist location** — permission denied, or GPS not fixed yet. The map still renders
 *     with the patient pin alone; only the distance line and label are withheld. This is the case
 *     worth getting right, because it is the common one: the map is useful before the therapist
 *     grants location, and demanding permission to show a patient's address would be
 *     disproportionate.
 */

interface RouteMapProps {
  patient: LatLng | null;
  therapist: LatLng | null;
  patientName: string;
  address?: string;
}

/** Published by `app.config.js` — true only when a Maps SDK key was present at build time. */
const MAPS_ENABLED = Boolean(
  (Constants.expoConfig?.extra as { mapsEnabled?: boolean } | undefined)?.mapsEnabled,
);

const MAP_HEIGHT = 240;
/** Shorter than the live map: there is less to see, and the address card sits right below. */
const FALLBACK_HEIGHT = 210;

export function RouteMap({ patient, therapist, patientName, address }: RouteMapProps) {
  /**
   * Tear the native map down whenever this screen is not the one on top.
   *
   * The visit flow is a stack: this screen pushes the OTP screen, which then *replaces itself*
   * with the active session — so the route screen stays mounted underneath for the whole visit,
   * commonly 45 minutes or more. A live Google `MapView` holds tens of megabytes of native memory
   * (tiles, GL surface) regardless of whether anyone can see it, which is exactly the wrong thing
   * to be carrying while the session timer, camera and clinical form are all running on top.
   *
   * Unmounting on blur costs a brief re-render if the therapist navigates back, and nothing else
   * — `initialRegion` is recomputed from the same two points, so the map reopens where it was.
   */
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // Computed before the fallback branch on purpose: distance needs no API key and no network,
  // only the two points. Losing it along with the map would mean a missing Google credential
  // also removed a feature that never depended on Google.
  const distanceKm =
    therapist && patient ? haversineKm(therapist, patient) : null;

  if (!MAPS_ENABLED || !patient) {
    return (
      <RouteMapFallback
        patientName={patientName}
        address={address}
        hasPoint={!!patient}
        distanceKm={distanceKm}
      />
    );
  }

  const points = therapist ? [therapist, patient] : [patient];

  if (!focused) {
    // Same height and ground colour, so nothing jumps during the push/pop transition.
    return <View style={{ height: MAP_HEIGHT, backgroundColor: "#e8f0f8" }} />;
  }

  return (
    <View style={{ height: MAP_HEIGHT }} className="relative overflow-hidden">
      <MapView
        // Pinned to Google on both platforms so the rendering the therapist sees matches the app
        // they hand off to for navigation. Apple Maps on iOS would be free too, but a pin that
        // sits differently in two apps is a support question nobody needs.
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={regionFor(points)}
        // The therapist's own dot is drawn by the SDK, which needs the OS permission we may not
        // have; `therapist` being non-null is exactly the signal that we do.
        showsUserLocation={!!therapist}
        showsMyLocationButton={false}
        // The visit screen is a glance-and-go, not a map tool. Rotation and pitch on a small
        // preview mostly produce a disoriented map the therapist then has to fix.
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        <Marker
          coordinate={patient}
          title={`${patientName}'s home`}
          description={address}
          // A custom view rather than the default pin so the two ends read as a pair, and so the
          // patient marker carries the app's accent rather than Google's red.
          tracksViewChanges={false}
        >
          <View className="items-center">
            <View
              className="w-8 h-8 rounded-full items-center justify-center border-[2.5px] border-white"
              style={{ backgroundColor: COLORS.danger }}
            >
              <House size={15} color="#fff" />
            </View>
          </View>
        </Marker>

        {therapist && (
          <>
            <Marker coordinate={therapist} title="You" tracksViewChanges={false}>
              <View className="items-center">
                <View
                  className="w-8 h-8 rounded-full items-center justify-center border-[2.5px] border-white"
                  style={{ backgroundColor: COLORS.accent }}
                >
                  <Navigation size={14} color="#fff" />
                </View>
              </View>
            </Marker>
            {/*
              A straight line, matching the straight-line distance beside it. Drawing a *routed*
              path would need the billed Directions API, and would also promise a route this
              screen has not actually computed — the dashed style is the visual admission that
              this is a bearing, not a road.
            */}
            <Polyline
              coordinates={[therapist, patient]}
              strokeColor={COLORS.accent}
              strokeWidth={2.5}
              lineDashPattern={[6, 6]}
            />
          </>
        )}
      </MapView>

      {distanceKm !== null && (
        <View className="absolute bottom-3 left-3 bg-white/95 rounded-lg px-2.5 py-1.5 flex-row items-center" style={{ gap: 6 }}>
          <Navigation size={12} color={COLORS.accent} />
          <Text className="text-[11px] font-bold text-fg">{formatDistance(distanceKm)}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * What shows when a map cannot honestly be drawn — today, always: no Maps SDK key is configured.
 *
 * Deliberately not a fake map: the grid is plainly decorative (no streets, no second dot, no
 * implied position), and the one pin stands for the destination the text beside it names. It
 * says outright that the preview is off so nobody reports a blank map as a bug, and points at
 * the Directions button, which works from the address alone.
 */
function RouteMapFallback({
  patientName,
  hasPoint,
  distanceKm,
}: {
  patientName: string;
  address?: string;
  hasPoint: boolean;
  distanceKm: number | null;
}) {
  return (
    <View style={{ height: FALLBACK_HEIGHT, backgroundColor: "#dcecf6" }} className="overflow-hidden items-center justify-center">
      {/* Decorative grid */}
      {Array.from({ length: 9 }).map((_, i) => (
        <View
          key={`v${i}`}
          className="absolute top-0 bottom-0"
          style={{ left: `${(i + 1) * 10}%`, width: 1, backgroundColor: "rgba(0,64,96,0.07)" }}
        />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <View
          key={`h${i}`}
          className="absolute left-0 right-0"
          style={{ top: (i + 1) * 28, height: 1, backgroundColor: "rgba(0,64,96,0.07)" }}
        />
      ))}
      {/* Soft halo + pin */}
      <View className="absolute w-40 h-40 rounded-full" style={{ backgroundColor: "rgba(0,64,96,0.05)" }} />
      <View className="absolute w-24 h-24 rounded-full" style={{ backgroundColor: "rgba(0,64,96,0.07)" }} />
      <View className="items-center" style={{ marginTop: -18 }}>
        <View
          className="w-14 h-14 rounded-full items-center justify-center border-[3px] border-white"
          style={{ backgroundColor: COLORS.accent, shadowColor: COLORS.nav, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 }}
        >
          <House size={24} color="#fff" strokeWidth={2.2} />
        </View>
        <View className="w-2.5 h-2.5 rotate-45 -mt-1.5" style={{ backgroundColor: COLORS.accent }} />
        <View className="mt-2 bg-white/95 rounded-full px-3 py-1 flex-row items-center" style={{ gap: 6 }}>
          <Text className="text-[12px] font-bold text-fg">{patientName}&apos;s home</Text>
          {distanceKm !== null && (
            <>
              <View className="w-1 h-1 rounded-full bg-muted/50" />
              <Navigation size={11} color={COLORS.accent} />
              <Text className="text-[11.5px] font-bold text-accent">{formatDistance(distanceKm)}</Text>
            </>
          )}
        </View>
      </View>
      <Text className="absolute bottom-9 text-muted text-[10.5px] text-center px-6">
        {hasPoint ? "Map preview unavailable" : "No map pin on this booking"} · tap Directions to navigate
      </Text>
    </View>
  );
}
