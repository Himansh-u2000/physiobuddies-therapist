import { useState, useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Users, TriangleAlert, SearchX } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { PatientCard } from "@/components/patients/PatientCard";
import { EmptyState, ErrorState, Input, Skeleton } from "@/components/ui";
import { patientApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useSyncedQuery } from "@/lib/hooks/useSyncedQuery";
import { getCachedPatients, cachePatients } from "@/lib/db/repositories";
import { debounce } from "@/lib/utils/format";
import type { Patient } from "@/types";

export default function PatientsScreen() {
  const router = useRouter();
  const therapist = useAuthStore((s) => s.therapist);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data: patients, isLoading, isError, refetch } = useSyncedQuery({
    queryKey: ["patients"],
    queryFn: patientApi.list,
    readCache: getCachedPatients,
    writeCache: cachePatients,
  });

  const debouncedSet = useMemo(() => debounce(setDebouncedSearch, 300), []);

  const filtered = patients?.filter(
    (p) =>
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.condition.toLowerCase().includes(debouncedSearch.toLowerCase()),
  );

  const renderItem = ({ item }: { item: Patient }) => (
    <PatientCard
      patient={item}
      onPress={() => router.push({ pathname: "/patient/[id]", params: { id: item.id } })}
    />
  );

  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} title="Patients" subtitle="Your patient records" showNotification={false} />
      <View className="px-3.5 pt-3">
        <Input
          placeholder="Search patients..."
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            debouncedSet(t);
          }}
        />
      </View>
      <FlashList
        data={filtered ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 96 }}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={100} radius={14} />
              <Skeleton height={100} radius={14} />
            </View>
          ) : isError ? (
            <ErrorState
              icon={TriangleAlert}
              title="Something went wrong"
              badge="Error"
              description="We couldn't load your patients right now. This is usually temporary. Your data is safe."
              action={{ label: "Try again", onPress: () => refetch() }}
            />
          ) : debouncedSearch ? (
            <EmptyState
              icon={SearchX}
              tone="neutral"
              title="No matches"
              description={`No patients match "${debouncedSearch}". Try a different name or condition.`}
            />
          ) : (
            <EmptyState
              icon={Users}
              tone="info"
              title="No patients yet"
              description="Patient profiles appear automatically after your first confirmed appointment. Complete your verification to start accepting bookings."
            />
          )
        }
      />
    </View>
  );
}
