/**
 * Global Jest setup.
 *
 * Native modules resolve through TurboModuleRegistry.getEnforcing, which throws outside a
 * dev build. Any module reachable from the auth store must therefore be stubbed here, or
 * unrelated suites fail at import time rather than on anything they actually assert.
 */

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    signOut: jest.fn(async () => {}),
    revokeAccess: jest.fn(async () => {}),
    getCurrentUser: jest.fn(async () => null),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  },
  isSuccessResponse: jest.fn(() => false),
  isErrorWithCode: jest.fn(() => false),
}));

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

let mockUuidCounter = 0;
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => `mock-uuid-${++mockUuidCounter}`),
  getRandomBytesAsync: jest.fn(async (n) => new Uint8Array(n).fill(7)),
}));
