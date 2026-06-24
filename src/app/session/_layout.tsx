import { Stack } from "expo-router";

export default function SessionLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="appointment/[id]" />
      <Stack.Screen name="route" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="active" />
      <Stack.Screen name="treatment" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
