/**
 * `GET /notifications/` → `AppNotification`, pinned against a row captured from the live dev
 * backend (2026-08-20, seed therapist). Two fields here are load-bearing and were previously
 * dropped: `metadata.url`, without which a row cannot be tapped, and the timestamp, which used
 * to reach the screen as a raw ISO string.
 */
import { mapNotifications, type BackendNotification } from "@/lib/api/mappers";

/** Verbatim from `GET /notifications/?limit=3`. */
const LIVE_ROW: BackendNotification = {
  id: "6a8459aa5f65a93733778323",
  userId: "6a830016f85ba191340ff709",
  title: "Session marked as no-show",
  description: "The session on Tue, 18 Aug 2026 at 12:00 PM was marked as a no-show.",
  isRead: true,
  priority: "high",
  status: "sent",
  event: "session.no_show",
  type: "transactional",
  metadata: { url: "/therapist/my-bookings/6a8301146f7babf1a5b475ee" },
  readAt: "2026-08-20T06:11:31.302Z",
  createdAt: "2026-08-18T13:10:02.648Z",
  time: "2026-08-18T13:10:02.647Z",
};

describe("mapNotifications", () => {
  it("carries the backend deep link through as actionUrl", () => {
    const [row] = mapNotifications([LIVE_ROW]);
    expect(row.actionUrl).toBe("/therapist/my-bookings/6a8301146f7babf1a5b475ee");
  });

  it("categorises by event, not by the server's delivery channel", () => {
    // `type` is transactional/activity/promotional — a channel, not a subject.
    expect(mapNotifications([LIVE_ROW])[0].type).toBe("appointment");
    expect(
      mapNotifications([{ ...LIVE_ROW, event: "payout.processed" }])[0].type,
    ).toBe("payment");
    expect(
      mapNotifications([{ ...LIVE_ROW, event: null, type: "promotional" }])[0].type,
    ).toBe("message");
  });

  it("leaves actionUrl undefined when metadata carries no url", () => {
    // `auth.password_changed` and `therapist.rejected` have no `url` in the catalog.
    expect(mapNotifications([{ ...LIVE_ROW, metadata: {} }])[0].actionUrl).toBeUndefined();
    expect(mapNotifications([{ ...LIVE_ROW, metadata: null }])[0].actionUrl).toBeUndefined();
    expect(
      mapNotifications([{ ...LIVE_ROW, metadata: { url: 42 } }])[0].actionUrl,
    ).toBeUndefined();
  });

  it("renders a relative time label rather than the raw instant", () => {
    const minutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const hoursAgo = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(mapNotifications([{ ...LIVE_ROW, time: minutesAgo }])[0].timestamp).toBe("5m ago");
    expect(mapNotifications([{ ...LIVE_ROW, time: hoursAgo }])[0].timestamp).toBe("3h ago");
    expect(mapNotifications([{ ...LIVE_ROW, time: new Date().toISOString() }])[0].timestamp).toBe(
      "Just now",
    );
  });

  it("yields an empty label for a missing or unparseable time instead of NaN", () => {
    expect(mapNotifications([{ ...LIVE_ROW, time: undefined, createdAt: undefined }])[0].timestamp).toBe("");
    expect(mapNotifications([{ ...LIVE_ROW, time: "not-a-date" }])[0].timestamp).toBe("");
  });

  it("survives a null list", () => {
    expect(mapNotifications(null as unknown as BackendNotification[])).toEqual([]);
  });
});
