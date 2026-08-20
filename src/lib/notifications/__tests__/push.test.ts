/**
 * Device-token registration.
 *
 * The behaviours pinned here are the ones that are invisible until they go wrong in production:
 * that an unchanged token makes no network call, that a rotated one retires its predecessor
 * instead of leaving a second live row, that a denied permission is reported rather than
 * swallowed, and that the local copy is always dropped on unregister even if the DELETE fails —
 * which is what lets the next sign-in re-register.
 */
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { notificationApi } from "@/lib/api/services";
import { registerDeviceToken, unregisterDeviceToken } from "@/lib/notifications/push";
import { STORAGE_KEYS } from "@/constants/config";

jest.mock("@/lib/api/services", () => ({
  notificationApi: {
    registerPushToken: jest.fn(async () => {}),
    unregisterPushToken: jest.fn(async () => {}),
  },
}));

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockApi = notificationApi as jest.Mocked<typeof notificationApi>;

/** jest-expo reports `ios` by default; these paths are Android's. */
function setPlatform(os: "android" | "ios") {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform("android");
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: "granted" } as never);
  mockNotifications.getDevicePushTokenAsync.mockResolvedValue({
    type: "fcm",
    data: "fcm-token-1",
  } as never);
  mockSecureStore.getItemAsync.mockResolvedValue(null);
});

afterAll(() => setPlatform("ios"));

describe("registerDeviceToken", () => {
  it("registers a first-seen token and remembers it", async () => {
    const result = await registerDeviceToken();

    expect(result).toEqual({ state: "registered", token: "fcm-token-1" });
    expect(mockApi.registerPushToken).toHaveBeenCalledWith("fcm-token-1");
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      STORAGE_KEYS.pushToken,
      "fcm-token-1",
    );
  });

  it("makes no network call when the token is unchanged", async () => {
    // The common case: every authenticated launch re-runs this.
    mockSecureStore.getItemAsync.mockResolvedValue("fcm-token-1");

    const result = await registerDeviceToken();

    expect(result.state).toBe("registered");
    expect(mockApi.registerPushToken).not.toHaveBeenCalled();
  });

  it("retires the previous token when FCM rotates it", async () => {
    // The server keys by token, not by device — without this the old row stays live and every
    // send fans out to a token that can no longer be delivered to.
    mockSecureStore.getItemAsync.mockResolvedValue("fcm-token-old");

    await registerDeviceToken();

    expect(mockApi.unregisterPushToken).toHaveBeenCalledWith("fcm-token-old");
    expect(mockApi.registerPushToken).toHaveBeenCalledWith("fcm-token-1");
  });

  it("re-registers an unchanged token when forced", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue("fcm-token-1");

    await registerDeviceToken(true);

    expect(mockApi.registerPushToken).toHaveBeenCalledWith("fcm-token-1");
    // Same value, so there is no stale predecessor to retire.
    expect(mockApi.unregisterPushToken).not.toHaveBeenCalled();
  });

  it("asks for permission only when it is not already granted", async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: "undetermined" } as never);
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: "granted" } as never);

    await registerDeviceToken();

    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it("reports a denied permission without touching the network", async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: "denied" } as never);
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: "denied" } as never);

    expect(await registerDeviceToken()).toEqual({ state: "denied", token: null });
    expect(mockApi.registerPushToken).not.toHaveBeenCalled();
  });

  it("reports a missing Firebase config distinctly from a failure", async () => {
    // Thrown when no google-services.json was bundled — a build gap, not a retryable error.
    mockNotifications.getDevicePushTokenAsync.mockRejectedValue(new Error("no Firebase app"));

    expect(await registerDeviceToken()).toEqual({ state: "not-configured", token: null });
  });

  it("reports a failed POST without persisting the token", async () => {
    mockApi.registerPushToken.mockRejectedValueOnce(new Error("500"));

    expect(await registerDeviceToken()).toEqual({ state: "failed", token: "fcm-token-1" });
    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("skips iOS, where the device token is APNs and not addressable by an FCM sender", async () => {
    setPlatform("ios");

    expect(await registerDeviceToken()).toEqual({ state: "unsupported-platform", token: null });
    expect(mockNotifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
  });
});

describe("unregisterDeviceToken", () => {
  it("deletes the stored token server-side and locally", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue("fcm-token-1");

    await unregisterDeviceToken();

    expect(mockApi.unregisterPushToken).toHaveBeenCalledWith("fcm-token-1");
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.pushToken);
  });

  it("still clears the local copy when the DELETE fails", async () => {
    // Otherwise the next sign-in matches the stale value and skips re-registering entirely.
    mockSecureStore.getItemAsync.mockResolvedValue("fcm-token-1");
    mockApi.unregisterPushToken.mockRejectedValueOnce(new Error("offline"));

    await unregisterDeviceToken();

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.pushToken);
  });

  it("does nothing when this device never registered", async () => {
    await unregisterDeviceToken();

    expect(mockApi.unregisterPushToken).not.toHaveBeenCalled();
  });
});
