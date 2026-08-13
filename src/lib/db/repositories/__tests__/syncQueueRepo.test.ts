import { getSyncQueueCounts } from "@/lib/db/repositories/syncQueueRepo";
import { sessions, treatments, sessionPhotos } from "@/lib/db/schema";

/**
 * The counts behind the sync-status card. What makes this worth pinning isn't the arithmetic
 * — it's the definition of "a record": one *session*, not one row. A completed session and
 * its treatment are two rows for one piece of clinical work, so a therapist told "2 records
 * couldn't be sent" when one session is stuck would go looking for a second problem that
 * doesn't exist.
 *
 * Exercises the real function against a query-builder double, matching sessionsRepo's tests.
 */

interface Rows {
  sessions?: { id: string; status: string; syncStatus: string }[];
  treatments?: { sessionId: string; syncStatus: string }[];
  photos?: { id: string; syncStatus: string }[];
}

/**
 * Routes each `select().from(table).where(...)` to the right row set by identity of the table
 * object, so the three concurrent queries can't be silently answered by the wrong fixture.
 *
 * The `where` clauses are NOT evaluated — each fixture stands for what that query already
 * returned. So `sessions` here means *completed* sessions only, `treatments` means *errored*
 * treatments only, `photos` means *unsynced* photos only. Those filters live in SQL and
 * aren't this function's logic; what is its logic — which of those rows becomes a "record",
 * and whether two rows can describe one — is what's asserted below.
 */
function fakeDb(rows: Rows) {
  const byTable = new Map<unknown, unknown[]>([
    [sessions, rows.sessions ?? []],
    [treatments, rows.treatments ?? []],
    [sessionPhotos, rows.photos ?? []],
  ]);

  return {
    select: jest.fn(() => ({
      from: jest.fn((table: unknown) => ({
        where: jest.fn(async () => byTable.get(table) ?? []),
      })),
    })),
  } as unknown as import("@/lib/db/provider").DrizzleDB;
}

describe("getSyncQueueCounts", () => {
  it("reports nothing when the queue is drained", async () => {
    const counts = await getSyncQueueCounts(fakeDb({}));
    expect(counts).toEqual({ pendingRecords: 0, failedRecords: 0, pendingPhotos: 0 });
  });

  it("counts a completed-but-unsent session as pending", async () => {
    const counts = await getSyncQueueCounts(
      fakeDb({ sessions: [{ id: "s1", status: "completed", syncStatus: "pending" }] }),
    );
    expect(counts.pendingRecords).toBe(1);
    expect(counts.failedRecords).toBe(0);
  });

  it("counts a parked session as failed, not pending", async () => {
    const counts = await getSyncQueueCounts(
      fakeDb({ sessions: [{ id: "s1", status: "completed", syncStatus: "error" }] }),
    );
    expect(counts).toMatchObject({ pendingRecords: 0, failedRecords: 1 });
  });

  it("counts a session stuck behind its own errored treatment exactly once", async () => {
    // The session row is still "pending" (the engine won't push it until the treatment
    // syncs) while the treatment is parked. One stuck record, not two.
    const counts = await getSyncQueueCounts(
      fakeDb({
        sessions: [{ id: "s1", status: "completed", syncStatus: "pending" }],
        treatments: [{ sessionId: "s1", syncStatus: "error" }],
      }),
    );
    expect(counts).toMatchObject({ pendingRecords: 0, failedRecords: 1 });
  });

  it("does not double-count when both the session and its treatment are parked", async () => {
    const counts = await getSyncQueueCounts(
      fakeDb({
        sessions: [{ id: "s1", status: "completed", syncStatus: "error" }],
        treatments: [{ sessionId: "s1", syncStatus: "error" }],
      }),
    );
    expect(counts.failedRecords).toBe(1);
  });

  it("ignores an errored treatment whose session is not completed", async () => {
    // An errored draft for a session the therapist is still in the middle of isn't outbound
    // work and there's nothing to act on. The session isn't in the completed set at all,
    // which is exactly what the `completedById` guard keys off.
    const counts = await getSyncQueueCounts(
      fakeDb({ sessions: [], treatments: [{ sessionId: "s1", syncStatus: "error" }] }),
    );
    expect(counts).toMatchObject({ pendingRecords: 0, failedRecords: 0 });
  });

  it("ignores already-synced sessions", async () => {
    const counts = await getSyncQueueCounts(
      fakeDb({ sessions: [{ id: "s1", status: "completed", syncStatus: "synced" }] }),
    );
    expect(counts).toMatchObject({ pendingRecords: 0, failedRecords: 0 });
  });

  it("counts queued photos separately from session records", async () => {
    const counts = await getSyncQueueCounts(
      fakeDb({
        sessions: [{ id: "s1", status: "completed", syncStatus: "pending" }],
        photos: [{ id: "ph1", syncStatus: "pending" }, { id: "ph2", syncStatus: "error" }],
      }),
    );
    expect(counts).toEqual({ pendingRecords: 1, failedRecords: 0, pendingPhotos: 2 });
  });
});
