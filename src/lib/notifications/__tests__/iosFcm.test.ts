import { isConfigurationError, looksLikeApnsToken } from "@/lib/notifications/iosFcm";

describe("looksLikeApnsToken", () => {
  it("recognises a 32-byte hex APNs device token", () => {
    expect(looksLikeApnsToken("0123456789abcdef".repeat(4))).toBe(true);
    expect(looksLikeApnsToken("0123456789ABCDEF".repeat(4))).toBe(true);
  });

  it("does not mistake an FCM token for one", () => {
    expect(looksLikeApnsToken("dQw4w9WgXcQ:APA91bHun4MxP5egoKMwt2KZFBaFUH-1RYqx")).toBe(false);
  });

  it("does not match near-misses", () => {
    expect(looksLikeApnsToken("a".repeat(63))).toBe(false);
    expect(looksLikeApnsToken("g".repeat(64))).toBe(false);
  });
});

describe("isConfigurationError", () => {
  it.each([
    "[app/no-app] No Firebase App '[DEFAULT]' has been created - call firebase.initializeApp()",
    "[messaging/unknown] no valid \"aps-environment\" entitlement string found for application",
  ])("treats a build gap as configuration: %s", (message) => {
    expect(isConfigurationError(new Error(message))).toBe(true);
  });

  it("reads RNFirebase's `code` field too", () => {
    const error = Object.assign(new Error("boom"), { code: "app/no-app" });
    expect(isConfigurationError(error)).toBe(true);
  });

  it("treats transient failures as retryable", () => {
    expect(isConfigurationError(new Error("[messaging/unknown] The request timed out."))).toBe(false);
  });
});
