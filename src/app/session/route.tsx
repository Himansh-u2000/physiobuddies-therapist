import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Phone,
  MapPinOff,
  MapPinHouse,
  Navigation2,
  KeyRound,
  ArrowRight,
  Clock3,
} from "lucide-react-native";
import { Avatar, Button, ErrorState, Skeleton } from "@/components/ui";
import { appointmentApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { useLocation } from "@/lib/hooks/useLocation";
import { RouteMap } from "@/components/session/RouteMap";
import {
  ChecklistRow,
  SectionLabel,
  VisitCard,
  VisitFooter,
  VisitHeader,
} from "@/components/session/VisitFlow";
import { callPatient } from "@/lib/services/callService";
import { getSessionTypeLabel } from "@/lib/utils/format";
import { formatDistance, haversineKm } from "@/lib/utils/geo";
import { COLORS } from "@/constants/config";

/**
 * Step 1 of the visit — get to the patient.
 *
 * Built around one question: *what do I do next?* The answer is always in the footer — open
 * directions, then "I've arrived", which goes straight to OTP verification. Everything above it
 * is context for the trip: where, who, and a short checklist whose ticks follow what the
 * therapist has actually done on this screen.
 *
 * What was removed, and why:
 *  - **Visit instructions.** The copy was hardcoded — a gate code "PB-2406", a WhatsApp
 *    preference, a lift on the left — shown for every patient. None of it came from the booking.
 *  - **The ETA / km / arrival stats.** Also hardcoded fallbacks (18 min, 5.2 km, "10:12") that
 *    rendered whenever the server didn't send a value, which is always. Distance now appears only
 *    when both points are genuinely known.
 *  - **The static "Step 1 of 3" checklist**, with step 1 permanently highlighted. The visit rail
 *    in the header replaces the step count, and the checklist ticks as things happen.
 *  - **The 🏠 / 🗺 emoji**, which render differently on every Android skin and clashed with the
 *    lucide line icons used everywhere else.
 */
export default function RouteScreen() {
  const router = useRouter();
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const showToast = useAppStore((s) => s.showToast);
  const { location, getCurrentLocation, openInMaps, openAddressInMaps, permissionBlocked } =
    useLocation();
  const { data: appointment, isError, refetch } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => appointmentApi.getById(appointmentId),
    enabled: !!appointmentId,
  });

  // Session-local progress. Not persisted: it is guidance for this trip, not a record.
  const [openedDirections, setOpenedDirections] = useState(false);
  const [calledPatient, setCalledPatient] = useState(false);

  /**
   * Ask for position on mount rather than waiting for "Directions". The map and the distance
   * label both need it. Failure is deliberately silent: `getCurrentLocation` resolves `null` on a
   * denial, the map falls back to the patient pin alone, and `permissionBlocked` covers the case
   * where the OS will not ask again.
   */
  useEffect(() => {
    void getCurrentLocation();
  }, [getCurrentLocation]);

  /**
   * Coordinates first, address second. The therapist's copy of a booking can arrive without
   * lat/lng, and a Maps *search* for the address is what the web app does in that case too.
   */
  const handleOpenMaps = async () => {
    if (!appointment) return;
    try {
      if (appointment.latitude != null && appointment.longitude != null) {
        await openInMaps(appointment.latitude, appointment.longitude, appointment.patientName);
        setOpenedDirections(true);
        return;
      }
      if (appointment.address?.trim()) {
        await openAddressInMaps(appointment.address);
        setOpenedDirections(true);
        return;
      }
      showToast("No address on file for this patient");
    } catch {
      showToast("Unable to open maps");
    }
  };

  const handleCallPatient = async () => {
    if (!appointment?.patientPhone) {
      showToast("Patient phone unavailable");
      return;
    }
    await callPatient(appointment.patientPhone, appointment.id);
    setCalledPatient(true);
  };

  const goToOtp = () => {
    if (!appointment) return;
    router.push(`/session/otp?appointmentId=${appointment.id}`);
  };

  const patientPoint =
    appointment?.latitude != null && appointment?.longitude != null
      ? { latitude: appointment.latitude, longitude: appointment.longitude }
      : null;
  const therapistPoint = location
    ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
    : null;
  const distance = patientPoint && therapistPoint ? formatDistance(haversineKm(therapistPoint, patientPoint)) : null;

  const [street, ...rest] = (appointment?.address ?? "").split(",");
  const locality = rest.join(",").trim();

  return (
    <View className="flex-1 bg-bg">
      <VisitHeader title="Navigate to patient" step={0} onBack={() => router.back()} />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
        <RouteMap
          patient={patientPoint}
          therapist={therapistPoint}
          patientName={appointment?.patientName ?? "Patient"}
          address={appointment?.address}
        />

        <View className="px-3.5">
          {!appointment && !isError && <RouteSkeleton />}

          {!appointment && isError && (
            <View className="mt-3">
              <ErrorState
                icon={MapPinOff}
                tone="danger"
                title="Couldn't load this visit"
                badge="Offline"
                description="We couldn't reach the server for the patient's address and contact details. This is usually temporary."
                action={{ label: "Try again", onPress: () => refetch() }}
              />
            </View>
          )}

          {appointment && (
            <>
              {/* Destination — pulled up over the map's bottom edge. */}
              <View className="-mt-6">
                <VisitCard>
                  <View className="flex-row items-start" style={{ gap: 12 }}>
                    <View
                      className="w-12 h-12 rounded-[14px] items-center justify-center"
                      style={{ backgroundColor: COLORS.primarySoft }}
                    >
                      <MapPinHouse size={24} color={COLORS.accent} strokeWidth={2} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-muted text-[11px] font-bold uppercase" style={{ letterSpacing: 0.6 }}>
                        Destination
                      </Text>
                      <Text className="text-[16px] font-extrabold text-fg mt-0.5" numberOfLines={2}>
                        {street?.trim() || "Address not provided"}
                      </Text>
                      {locality ? (
                        <Text className="text-muted text-[12.5px] mt-0.5 leading-[18px]">{locality}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View className="flex-row flex-wrap mt-3.5" style={{ gap: 8 }}>
                    <InfoPill icon={Clock3} label={`${appointment.dateLabel ?? "Scheduled"} · ${appointment.timeLabel} ${appointment.meridiem ?? ""}`.trim()} />
                    <InfoPill icon={MapPinHouse} label={getSessionTypeLabel(appointment.type)} />
                    {distance ? <InfoPill icon={Navigation2} label={distance} tone="accent" /> : null}
                  </View>
                </VisitCard>
              </View>

              <SectionLabel>Patient</SectionLabel>
              <VisitCard>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  <Avatar name={appointment.patientName} size={48} radius={14} />
                  <View className="flex-1">
                    <Text className="text-[15px] font-bold text-fg">{appointment.patientName}</Text>
                    <Text className="text-muted text-[12px] mt-0.5" numberOfLines={1}>
                      {[appointment.condition, appointment.patientPhone].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleCallPatient}
                    accessibilityLabel={`Call ${appointment.patientName}`}
                    className="h-10 px-3.5 rounded-full flex-row items-center active:opacity-80"
                    style={{ gap: 6, backgroundColor: "rgba(35,145,73,0.1)" }}
                  >
                    <Phone size={15} color={COLORS.success} />
                    <Text className="text-success font-bold text-[13px]">Call</Text>
                  </Pressable>
                </View>
              </VisitCard>

              <SectionLabel>On the way</SectionLabel>
              <VisitCard className="py-1">
                <ChecklistRow
                  done={openedDirections}
                  title="Get directions"
                  sub="Opens your maps app with the patient's address."
                  onPress={handleOpenMaps}
                />
                <ChecklistRow
                  done={calledPatient}
                  title="Call if you're running late"
                  sub="Optional — confirm building entry or update your arrival time."
                  onPress={handleCallPatient}
                />
                <ChecklistRow
                  done={false}
                  title="Meet the patient, then verify OTP"
                  sub="Only enter the code once you're with them in person."
                  onPress={goToOtp}
                  last
                />
              </VisitCard>
            </>
          )}

          {/* Below the cards, not above: the destination card is pulled up over the map, and a
              banner between the two was being overlapped by it. */}
          {permissionBlocked && (
            <View className="mt-3">
              <ErrorState
                icon={MapPinOff}
                tone="warning"
                title="Location access is off"
                badge="Permission"
                description="Turn on location to see how far you are from the patient. Directions still work without it."
                action={{ label: "Open app settings", onPress: () => Linking.openSettings() }}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {appointment && (
        <VisitFooter hint="Arrived? Verify the patient's OTP to start the session.">
          <Button variant="secondary" fullWidth={false} style={{ flex: 1 }} onPress={handleOpenMaps}>
            <Navigation2 size={16} color={COLORS.accent} />
            <Text className="text-accent font-bold text-[14px]">Directions</Text>
          </Button>
          <Button fullWidth={false} style={{ flex: 1.6 }} onPress={goToOtp}>
            <KeyRound size={16} color="#fff" />
            <Text className="text-white font-bold text-[14px]">I&apos;ve arrived</Text>
            <ArrowRight size={16} color="#fff" />
          </Button>
        </VisitFooter>
      )}
    </View>
  );
}

function InfoPill({
  icon: Icon,
  label,
  tone = "neutral",
}: {
  icon: typeof Clock3;
  label: string;
  tone?: "neutral" | "accent";
}) {
  const accent = tone === "accent";
  return (
    <View
      className="flex-row items-center rounded-full px-2.5 py-1.5"
      style={{ gap: 5, backgroundColor: accent ? COLORS.primarySoft : COLORS.bg }}
    >
      <Icon size={12} color={accent ? COLORS.accent : COLORS.muted} />
      <Text className={`text-[11.5px] font-bold ${accent ? "text-accent" : "text-fg/80"}`}>{label}</Text>
    </View>
  );
}

/** Mirrors the loaded layout — destination card, patient card, checklist — so nothing jumps. */
function RouteSkeleton() {
  return (
    <View className="-mt-6" style={{ gap: 12 }}>
      <VisitCard>
        <View className="flex-row items-start" style={{ gap: 12 }}>
          <Skeleton width={48} height={48} radius={14} />
          <View className="flex-1" style={{ gap: 7 }}>
            <Skeleton width={70} height={10} />
            <Skeleton width="60%" height={16} />
            <Skeleton width="85%" height={12} />
          </View>
        </View>
        <View className="flex-row mt-3.5" style={{ gap: 8 }}>
          <Skeleton width={120} height={24} radius={12} />
          <Skeleton width={80} height={24} radius={12} />
        </View>
      </VisitCard>
      <VisitCard>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Skeleton width={48} height={48} radius={14} />
          <View className="flex-1" style={{ gap: 6 }}>
            <Skeleton width="50%" height={14} />
            <Skeleton width="70%" height={11} />
          </View>
          <Skeleton width={72} height={40} radius={20} />
        </View>
      </VisitCard>
      <VisitCard>
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-row items-center py-2.5" style={{ gap: 12 }}>
            <Skeleton width={24} height={24} radius={12} />
            <View className="flex-1" style={{ gap: 6 }}>
              <Skeleton width="55%" height={13} />
              <Skeleton width="85%" height={11} />
            </View>
          </View>
        ))}
      </VisitCard>
    </View>
  );
}
