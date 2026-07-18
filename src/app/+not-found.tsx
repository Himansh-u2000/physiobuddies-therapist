import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";
import { Button } from "@/components/ui";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found", headerShown: false }} />
      <View className="flex-1 bg-bg items-center justify-center px-6">
        <Text className="text-[48px] font-black text-accent">404</Text>
        <Text className="text-[16px] font-bold text-fg mt-2">Page not found</Text>
        <Text className="text-muted text-[13px] mt-1 text-center">
          The screen you&apos;re looking for doesn&apos;t exist.
        </Text>
        <View className="mt-6 w-full max-w-[260px]">
          <Link href="/(app)" asChild>
            <Button>
              <Text className="text-white font-bold text-[14px]">Go to dashboard</Text>
            </Button>
          </Link>
        </View>
      </View>
    </>
  );
}
