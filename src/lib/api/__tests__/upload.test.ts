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

import { uploadApi, sessionApi, absoluteFileUrl, privateFileUrl } from "@/lib/api/services";
import { client } from "@/lib/api/client";

// `jest.mock` is hoisted above the imports above by babel-plugin-jest-hoist, so these stubs are
// in place before `services.ts` resolves them — same arrangement as client.test.ts.
jest.mock("@/constants/config", () => ({
  API_BASE_URL: "https://api.dev.physiobuddies.in/api/v1",
  SUBSCRIPTION_PAYMENT_ENABLED: false,
}));

jest.mock("@/lib/api/client", () => ({
  client: { post: jest.fn(), get: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  toAuthTokens: jest.fn(),
}));

jest.mock("@/lib/storage/secure", () => ({ getTokens: jest.fn(), saveTokens: jest.fn() }));

const post = client.post as jest.Mock;

describe("uploadApi.uploadDocument — the PUBLIC uploader", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { url: "https://cdn.example/img.jpg", id: "img-1" } });
  });

  it("clears Content-Type so the runtime can set the multipart boundary", async () => {
    await uploadApi.uploadDocument("file:///kyc.jpg", "kyc.jpg", "image/jpeg");

    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe("/file-upload/single");
    expect(body).toBeInstanceOf(FormData);
    // null (not "multipart/form-data", not absent) is what makes axios omit the header.
    expect(config.headers["Content-Type"]).toBeNull();
  });

  it("sends the file under the field name multer expects", async () => {
    await uploadApi.uploadDocument("file:///kyc.jpg", "kyc.jpg", "image/jpeg", "registration");
    const body: FormData = post.mock.calls[0][1];
    expect(body.get("file")).toBeTruthy();
    expect(body.get("kind")).toBe("registration");
  });

  it("normalises the response url across the plausible key names", async () => {
    post.mockResolvedValue({ data: { location: "https://cdn.example/b.jpg" } });
    const r = await uploadApi.uploadDocument("file:///b.jpg", "b.jpg", "image/jpeg");
    expect(r.url).toBe("https://cdn.example/b.jpg");
  });

  it("throws rather than returning an undefined url when the server sends no file location", async () => {
    // Silently succeeding here is the dangerous case: the caller would attach a blank photo.
    post.mockResolvedValue({ data: { ok: true } });
    await expect(
      uploadApi.uploadDocument("file:///c.jpg", "c.jpg", "image/jpeg"),
    ).rejects.toThrow(/no file URL/i);
  });
});

/**
 * `sessionApi.addDocument` — the PRIVATE, clinical uploader.
 *
 * Pinned separately from the public one because the previous implementation posted JSON
 * (`{ documents: [{ url, name, fileType }] }`) to this route and was rejected with
 * `400 "No file uploaded"` every time. It had no callers, so nothing surfaced the breakage.
 * Swagger still describes an `application/json` body here, so the shape below can only be
 * defended by a test — it came from probing the running server.
 */
describe("sessionApi.addDocument — the PRIVATE clinical uploader", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({
      data: {
        id: "doc-1",
        name: "xray.jpg",
        url: "/file/doc-1",
        fileType: "image/jpeg",
        createdAt: "2026-08-18T07:15:14.592Z",
      },
    });
  });

  it("posts multipart to the session's add-docs route, not JSON", async () => {
    await sessionApi.addDocument("sess-1", "file:///xray.jpg", "xray.jpg", "image/jpeg");

    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe("/treatment-session/sess-1/add-docs");
    expect(body).toBeInstanceOf(FormData);
    expect(config.headers["Content-Type"]).toBeNull();
  });

  it("sends the bytes under `file`, with name and fileType as sibling form fields", async () => {
    await sessionApi.addDocument("sess-1", "file:///xray.jpg", "xray.jpg", "image/jpeg");
    const body: FormData = post.mock.calls[0][1];
    expect(body.get("file")).toBeTruthy();
    expect(body.get("name")).toBe("xray.jpg");
    expect(body.get("fileType")).toBe("image/jpeg");
  });

  it("absolutises the private url KEEPING /api/v1 — the file route is versioned", async () => {
    const doc = await sessionApi.addDocument("sess-1", "file:///xray.jpg", "xray.jpg", "image/jpeg");
    expect(doc.url).toBe("https://api.dev.physiobuddies.in/api/v1/file/doc-1");
    expect(doc.id).toBe("doc-1");
  });

  it("throws when the server returns no document id, rather than queueing an unreferenceable file", async () => {
    post.mockResolvedValue({ data: { name: "xray.jpg" } });
    await expect(
      sessionApi.addDocument("sess-1", "file:///xray.jpg", "xray.jpg", "image/jpeg"),
    ).rejects.toThrow(/no document id/i);
  });
});

describe("privateFileUrl", () => {
  // The mirror-image of absoluteFileUrl below, and the reason both exist: /uploads is served
  // from the site root, /file/:id is an API route. Resolving one with the other's rule yields a
  // 404 that reads like a missing file rather than a wrong URL.
  it("keeps the /api/v1 prefix", () => {
    expect(privateFileUrl("/file/abc")).toBe("https://api.dev.physiobuddies.in/api/v1/file/abc");
  });

  it("leaves an already-absolute url alone", () => {
    expect(privateFileUrl("https://cdn.example/x.jpg")).toBe("https://cdn.example/x.jpg");
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
