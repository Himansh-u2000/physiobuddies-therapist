import { Platform } from "react-native";
import { biometricNaming, type BiometricType } from "@/lib/hooks/useBiometric";

/**
 * Naming, not authentication.
 *
 * `supportedAuthenticationTypesAsync()` reports **hardware**, and its `FACIAL_RECOGNITION` means
 * Face ID on iOS and camera face unlock on Android — the enum cannot tell them apart. Picking
 * the label from the enum alone is what put "Face ID", an Apple feature name, on Android phones
 * whose owners were using a fingerprint.
 */
function setPlatform(os: "android" | "ios") {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

const FINGER: BiometricType[] = ["fingerprint"];
const FACE: BiometricType[] = ["facial"];
const BOTH: BiometricType[] = ["fingerprint", "facial"];

afterAll(() => setPlatform("ios")); // jest-expo's default

describe("android", () => {
  beforeEach(() => setPlatform("android"));

  it("never says Face ID, whatever the hardware reports", () => {
    for (const types of [FINGER, FACE, BOTH, [], ["iris"] as BiometricType[]]) {
      expect(biometricNaming(types).label).not.toMatch(/face id/i);
      expect(biometricNaming(types).label).not.toMatch(/touch id/i);
    }
  });

  it("names a fingerprint-only device 'Fingerprint'", () => {
    const n = biometricNaming(FINGER);
    expect(n.label).toBe("Fingerprint");
    expect(n.icon).toBe("fingerprint");
    expect(n.action).toBe("Touch to unlock");
  });

  it("names a face-only device 'Face unlock'", () => {
    const n = biometricNaming(FACE);
    expect(n.label).toBe("Face unlock");
    expect(n.icon).toBe("face");
  });

  it("falls back to the neutral 'Biometric' when the device advertises both", () => {
    // Hardware, not enrolment — so which one the therapist actually uses is unknowable here.
    // Guessing would be wrong for roughly half of them; the generic term is right for all.
    const n = biometricNaming(BOTH);
    expect(n.label).toBe("Biometric");
    expect(n.methods).toEqual(["Fingerprint", "Face unlock"]);
  });

  it("still names something when the hardware reports nothing recognisable", () => {
    expect(biometricNaming([]).label).toBe("Biometric");
    expect(biometricNaming([null])).toMatchObject({ label: "Biometric" });
  });
});

describe("ios", () => {
  beforeEach(() => setPlatform("ios"));

  it("says Face ID for a facial device", () => {
    const n = biometricNaming(FACE);
    expect(n.label).toBe("Face ID");
    expect(n.icon).toBe("face");
    expect(n.action).toBe("Look at your phone to unlock");
  });

  it("says Touch ID for a fingerprint device — Apple's name, not 'Fingerprint'", () => {
    expect(biometricNaming(FINGER).label).toBe("Touch ID");
  });
});

describe("the same hardware, described per platform", () => {
  it("reads Face ID on iOS and Face unlock on Android", () => {
    setPlatform("ios");
    const ios = biometricNaming(FACE).label;
    setPlatform("android");
    const android = biometricNaming(FACE).label;

    expect(ios).toBe("Face ID");
    expect(android).toBe("Face unlock");
    expect(ios).not.toBe(android);
  });

  it("produces a label that reads correctly inside a sentence", () => {
    // Rendered as `Enable ${label} login` and `${label} login` on the profile row.
    setPlatform("android");
    expect(`Enable ${biometricNaming(BOTH).label} login`).toBe("Enable Biometric login");
    expect(`Enable ${biometricNaming(FINGER).label} login`).toBe("Enable Fingerprint login");
    setPlatform("ios");
    expect(`Enable ${biometricNaming(FACE).label} login`).toBe("Enable Face ID login");
  });
});
