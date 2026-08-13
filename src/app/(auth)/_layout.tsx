import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="splash" />
      {/* `login` is email + password. The phone-OTP screens (`login` as it was, plus `otp`)
          and the separate `email-login` screen were removed — see the note in login.tsx. */}
      <Stack.Screen name="login" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="biometric-setup" />
      <Stack.Screen name="biometric-unlock" />
    </Stack>
  );
}
