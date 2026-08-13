import {
  logRequest,
  logResponse,
  logFailure,
  getNetLog,
  clearNetLog,
  dumpNetLog,
  formatBody,
} from "@/lib/api/netlog";

/**
 * The network log's redaction is the part that has to be right.
 *
 * This log exists to be *shared* — screenshotted, pasted into a chat, exported from the
 * screen's Share button — so anything it renders should be assumed public. A password or a
 * full bearer token surviving into it would turn a debugging aid into a credential leak, and
 * that failure is silent: nothing about the UI would look wrong.
 */

beforeEach(() => {
  clearNetLog();
});

describe("redaction", () => {
  it("never renders a password, however it is spelled", () => {
    logRequest({
      fullUrl: "https://api.example.com/auth/login",
      body: { email: "a@b.com", password: "hunter2", newPassword: "hunter3", currentPassword: "hunter1" },
    });

    const dump = dumpNetLog();
    expect(dump).not.toContain("hunter1");
    expect(dump).not.toContain("hunter2");
    expect(dump).not.toContain("hunter3");
    // The field still shows, so "did we even send a password?" stays answerable.
    expect(dump).toContain("[redacted]");
    expect(dump).toContain("a@b.com");
  });

  it("redacts secrets nested inside the payload, not just at the top level", () => {
    logRequest({
      fullUrl: "https://api.example.com/x",
      body: { outer: { inner: { refresh: "eyJhbGciOi.secret.value" } } },
    });
    expect(dumpNetLog()).not.toContain("secret.value");
  });

  it("truncates the bearer token but keeps enough to identify it", () => {
    logRequest({
      fullUrl: "https://api.example.com/user",
      headers: { Authorization: "Bearer mock-access-token-abcdefghijklmnop" },
    });

    const [entry] = getNetLog();
    const auth = entry.requestHeaders?.Authorization ?? "";
    // Identifiable — spotting a literal `mock-access-token` is the single most useful thing
    // this log has ever had to show — but not replayable.
    expect(auth).toContain("mock-access");
    expect(auth).not.toContain("abcdefghijklmnop");
    expect(auth).toMatch(/\d+ chars/);
  });

  it("labels a multipart upload rather than rendering it as an empty object", () => {
    logRequest({ fullUrl: "https://api.example.com/file-upload/single", body: new FormData() });
    expect(formatBody(getNetLog()[0].requestBody)).toBe("[FormData]");
  });
});

describe("request lifecycle", () => {
  it("closes the entry a response belongs to and records its status", () => {
    const id = logRequest({ method: "get", url: "/user", fullUrl: "https://api.example.com/user" });
    logResponse(id, 200, { name: "Aarav" });

    const [entry] = getNetLog();
    expect(entry.method).toBe("GET");
    expect(entry.phase).toBe("success");
    expect(entry.status).toBe(200);
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records a failure body — the server's message is usually the whole answer", () => {
    const id = logRequest({ method: "GET", url: "/therapist/faqs", fullUrl: "https://x/therapist/faqs" });
    logFailure(id, 400, "Invalid ObjectId format", { message: "Invalid ObjectId format" });

    const [entry] = getNetLog();
    expect(entry.phase).toBe("error");
    expect(entry.status).toBe(400);
    expect(dumpNetLog()).toContain("Invalid ObjectId format");
  });

  it("keeps entries newest-first so the failure you just triggered is at the top", () => {
    logRequest({ url: "/first", fullUrl: "https://x/first" });
    logRequest({ url: "/second", fullUrl: "https://x/second" });
    expect(getNetLog().map((e) => e.url)).toEqual(["/second", "/first"]);
  });

  it("is bounded — a long session must not grow the buffer without limit", () => {
    for (let i = 0; i < 200; i++) logRequest({ url: `/r${i}`, fullUrl: `https://x/r${i}` });
    expect(getNetLog().length).toBeLessThanOrEqual(80);
  });

  it("drops everything on clear (sign-out carries patient data out with it)", () => {
    logRequest({ url: "/user", fullUrl: "https://x/user" });
    clearNetLog();
    expect(getNetLog()).toHaveLength(0);
  });
});
