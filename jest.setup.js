/**
 * Global Jest setup.
 *
 * Native modules resolve through TurboModuleRegistry.getEnforcing, which throws outside a
 * dev build. Any module reachable from the auth store must therefore be stubbed here, or
 * unrelated suites fail at import time rather than on anything they actually assert.
 */

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(async () => {}),
  getItemAsync: jest.fn(async () => null),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
}));

/**
 * Reachable from the auth store since logout retires this device's push token
 * (`lib/notifications/push`). Importing the real module under Jest also trips
 * expo-notifications' "remote push was removed from Expo Go" warning on every suite that
 * touches the store, which is noise rather than a signal here.
 */
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getDevicePushTokenAsync: jest.fn(async () => ({ type: "fcm", data: "mock-fcm-token" })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  setNotificationHandler: jest.fn(),
  setBadgeCountAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => "mock-notification-id"),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  useLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  DEFAULT_ACTION_IDENTIFIER: "expo.modules.notifications.actions.DEFAULT",
  AndroidImportance: { MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5 },
}));

let mockUuidCounter = 0;
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => `mock-uuid-${++mockUuidCounter}`),
  getRandomBytesAsync: jest.fn(async (n) => new Uint8Array(n).fill(7)),
}));
