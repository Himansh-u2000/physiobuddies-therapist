import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import { useRouter, type Href } from "expo-router";
import { notificationApi } from "@/lib/api/services";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const registerForPushNotifications = useCallback(async () => {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Physiobuddies",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#004060",
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    setExpoPushToken(token);
    await notificationApi.registerPushToken(token);
    return token;
  }, []);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(setNotification);
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      setNotification(response.notification);
      // Route by whatever the push payload's data.actionUrl says — mirrors
      // AppNotification.actionUrl, the same field the in-app notification list is modeled
      // around. Falls back to the notifications tab rather than doing nothing on tap, since
      // a tap that goes nowhere reads as broken.
      const actionUrl = response.notification.request.content.data?.actionUrl;
      router.push((typeof actionUrl === "string" ? actionUrl : "/(app)/notifications") as Href);
    });
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  return { expoPushToken, notification, registerForPushNotifications };
}
