import { useState, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Users, TriangleAlert, SearchX } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { Avatar, Chip, Input, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { patientApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useSyncedQuery } from "@/lib/hooks/useSyncedQuery";
import { getCachedPatients, cachePatients } from "@/lib/db/repositories";
import { COLORS } from "@/constants/config";
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
    <Pressable
      onPress={() => router.push({ pathname: "/patient/[id]", params: { id: item.id } })}
      className="bg-white border border-border rounded-lg p-3.5 mb-3 active:opacity-90 overflow-hidden"
      style={{ shadowColor: COLORS.nav, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 }}
    >
      <View className="flex-row items-start" style={{ gap: 12 }}>
        <View className="relative">
          <Avatar name={item.name} url={item.avatarUrl} size={50} radius={16} />
          <View className="absolute -bottom-1 -right-1 rounded-full bg-success border-2 border-white px-1.5 py-0.5">
            <Text className="text-[8px] font-black text-white">{item.totalSessions}</Text>
          </View>
        </View>

        <View className="flex-1" style={{ gap: 8 }}>
          <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
            <View className="flex-1">
              <Text className="text-[15px] font-extrabold text-fg" numberOfLines={1}>{item.name}</Text>
              <Text className="text-muted text-[11px] mt-0.5">{item.age}y | {item.gender}</Text>
            </View>
            <Chip variant="info">{item.totalSessions} sessions</Chip>
          </View>

          <View className="rounded-[12px] bg-bg border border-border px-3 py-2">
            <Text className="text-[11px] font-bold text-muted uppercase">Primary condition</Text>
            <Text className="text-[13px] font-bold text-fg mt-0.5" numberOfLines={1}>{item.condition}</Text>
          </View>

          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {item.tags.map((tag) => (
              <View key={tag} className="min-h-[24px] rounded-full bg-primary-soft border border-accent/10 px-2.5 items-center justify-center">
                <Text className="text-[10px] leading-[12px] font-bold text-accent text-center">{tag}</Text>
              </View>
            ))}
          </View>

          {item.lastVisit && (
            <Text className="text-muted text-[11px]">Last visit: {item.lastVisit}</Text>
          )}
        </View>
      </View>
    </Pressable>
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
