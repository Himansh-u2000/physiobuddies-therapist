import { StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Home, CalendarDays, Users, IndianRupee, User } from "lucide-react-native";
import { GlassSurface, GLASS_ENABLED } from "@/components/ui";
import { COLORS } from "@/constants/config";

/**
 * On iOS 26 the tab bar floats: it's positioned absolutely over the screen so content passes
 * behind the glass, which is the whole point of the effect. Everywhere else it stays in normal
 * flow with its original opaque background, because `GlassView` degrades to a transparent
 * `View` and an absolutely positioned bar with nothing drawn in it would sit invisibly on top
 * of the content. Screens add `FLOATING_TAB_BAR_INSET` to their scroll padding so the last row
 * isn't stuck under the floating bar.
 */
export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarBackground: GLASS_ENABLED
          ? () => <GlassSurface style={StyleSheet.absoluteFill} glassStyle="regular" />
          : undefined,
        tabBarStyle: {
          height: 76,
          paddingBottom: 10,
          paddingTop: 6,
          elevation: 0,
          ...(GLASS_ENABLED
            ? {
                position: "absolute",
                backgroundColor: "transparent",
                borderTopWidth: 0,
                shadowOpacity: 0,
              }
            : {
                backgroundColor: "rgba(255,255,255,0.97)",
                borderTopColor: COLORS.border,
                borderTopWidth: 1,
                shadowOpacity: 0.06,
                shadowColor: COLORS.nav,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: -4 },
              }),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
        },
        tabBarIconStyle: { marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Appts",
          tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: "Patients",
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color }) => <IndianRupee size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User size={22} color={color} />,
        }}
      />
      <Tabs.Screen name="articles" options={{ href: null }} />
      <Tabs.Screen name="documents" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
