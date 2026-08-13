/**
 * The multipart upload path (POST /file-upload/single).
 *
 * This exists for one narrow but expensive reason: the axios instance in `client.ts` defaults to
 * `Content-Type: application/json`, and axios 1.x's `transformRequest` reacts to that by running
 * `JSON.stringify(formDataToJSON(data))` on a FormData body — i.e. it would silently upload JSON
 * describing the file instead of the file. Hardcoding `multipart/form-data` is equally wrong
 * (no boundary → the server parses zero fields). The only correct move is to clear the header so
 * the runtime supplies `multipart/form-data; boundary=…` itself, and that is what this pins.
 */

import { uploadApi, absoluteFileUrl } from "@/lib/api/services";
import { client } from "@/lib/api/client";

// `jest.mock` is hoisted above the imports above by babel-plugin-jest-hoist, so these stubs are
// in place before `services.ts` resolves them — same arrangement as client.test.ts.
jest.mock("@/constants/config", () => ({
  API_BASE_URL: "https://api.dev.physiobuddies.in/api/v1",
  OTP_CONFIG: { authOtpLength: 6, sessionOtpLength: 4, demoOtp: "123456", demoSessionOtp: "1234" },
  USE_MOCK_AUTH: true,
  USE_MOCK_PROFILE: true,
  USE_MOCK_DASHBOARD: true,
  USE_MOCK_APPOINTMENTS: true,
  USE_MOCK_EARNINGS: true,
  USE_MOCK_SESSION: true,
  USE_MOCK_TREATMENT: true,
  USE_MOCK_NOTIFICATIONS: true,
  USE_MOCK_PATIENTS: true,
  USE_MOCK_PAYOUTS: true,
  USE_MOCK_AVAILABILITY: true,
  USE_MOCK_CONTENT: true,
  // The one flag under test — uploads go to the real branch.
  USE_MOCK_UPLOAD: false,
}));

jest.mock("@/lib/api/client", () => ({
  client: { post: jest.fn(), get: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  toAuthTokens: jest.fn(),
}));

jest.mock("@/lib/storage/secure", () => ({ getTokens: jest.fn(), saveTokens: jest.fn() }));

const post = client.post as jest.Mock;

describe("uploadApi", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { url: "https://cdn.example/img.jpg", id: "img-1" } });
  });

  it("clears Content-Type so the runtime can set the multipart boundary", async () => {
    await uploadApi.uploadSessionPhoto("sess-1", "file:///photo.jpg", "photo.jpg", "image/jpeg");

    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe("/file-upload/single");
    expect(body).toBeInstanceOf(FormData);
    // null (not "multipart/form-data", not absent) is what makes axios omit the header.
    expect(config.headers["Content-Type"]).toBeNull();
  });

  it("sends the file under the field name multer expects", async () => {
    await uploadApi.uploadSessionPhoto("sess-1", "file:///photo.jpg", "photo.jpg", "image/jpeg");
    const body: FormData = post.mock.calls[0][1];
    expect(body.get("file")).toBeTruthy();
    expect(body.get("sessionId")).toBe("sess-1");
  });

  it("passes treatmentId through for treatment attachments", async () => {
    await uploadApi.uploadTreatmentAttachment("t-9", "file:///a.jpg", "a.jpg", "image/jpeg");
    const body: FormData = post.mock.calls[0][1];
    expect(body.get("treatmentId")).toBe("t-9");
  });

  it("normalises the response url across the plausible key names", async () => {
    post.mockResolvedValue({ data: { location: "https://cdn.example/b.jpg" } });
    const r = await uploadApi.uploadSessionPhoto("s", "file:///b.jpg", "b.jpg", "image/jpeg");
    expect(r.url).toBe("https://cdn.example/b.jpg");
  });

  it("throws rather than returning an undefined url when the server sends no file location", async () => {
    // Silently succeeding here is the dangerous case: the caller would attach a blank photo.
    post.mockResolvedValue({ data: { ok: true } });
    await expect(
      uploadApi.uploadSessionPhoto("s", "file:///c.jpg", "c.jpg", "image/jpeg"),
    ).rejects.toThrow(/no file URL/i);
  });
});

describe("absoluteFileUrl", () => {
  // The upload controller returns `/uploads/<filename>` — a server-relative path. Two things
  // reject that outright: `<Image source={{uri}}>` can't fetch it, and PATCH /user/avatar
  // validates its body with `z.string().url()`. Both would fail well away from the upload.
  it("resolves a server-relative upload path against the API origin, dropping /api/v1", () => {
    expect(absoluteFileUrl("/uploads/1786-photo.jpg")).toBe(
      "https://api.dev.physiobuddies.in/uploads/1786-photo.jpg",
    );
  });

  it("leaves an already-absolute URL alone", () => {
    expect(absoluteFileUrl("https://cdn.example/x.png")).toBe("https://cdn.example/x.png");
  });

  it("tolerates a path with no leading slash", () => {
    expect(absoluteFileUrl("uploads/x.png")).toBe("https://api.dev.physiobuddies.in/uploads/x.png");
  });

  it("passes an empty value straight through instead of inventing an origin-only URL", () => {
    expect(absoluteFileUrl("")).toBe("");
  });
});

describe("uploadApi url absolutisation", () => {
  it("absolutises the relative url the real backend returns", async () => {
    post.mockResolvedValue({ data: { url: "/uploads/9-scan.pdf" } });
    const r = await uploadApi.uploadDocument("file:///s.pdf", "scan.pdf", "application/pdf", "kyc");
    expect(r.url).toBe("https://api.dev.physiobuddies.in/uploads/9-scan.pdf");
    // The id stays the server's own path/filename — it's an identifier, not something fetched.
    expect(r.id).toBe("/uploads/9-scan.pdf");
  });
});
