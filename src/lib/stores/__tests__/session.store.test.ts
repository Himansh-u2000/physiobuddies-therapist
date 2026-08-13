import { useSessionStore, setSessionDb } from "@/lib/stores/session.store";
import { upsertSessionDraft } from "@/lib/db/repositories";
import type { Session } from "@/types";

/**
 * The store's persistence is a plain module-level DB reference (Zustand actions aren't
 * hooks, so they can't call useDatabase() themselves) — setSessionDb(mockDb) here stands in
 * for what useSessionSync does once the real DB is ready.
 */
jest.mock("@/lib/db/repositories", () => ({
  upsertSessionDraft: jest.fn(async () => {}),
}));

const mockUpsert = upsertSessionDraft as jest.Mock;
const FAKE_DB = {} as never;

function resetStore() {
  useSessionStore.setState({
    sessionId: null,
    appointmentId: null,
    patientId: null,
    patientName: null,
    condition: null,
    type: "home",
    isActive: false,
    startedAt: null,
    elapsedSeconds: 0,
    checklist: [
      { id: "assessment", label: "Assessment and pain mapping", done: false },
      { id: "manual", label: "Manual therapy / manipulation", done: false },
    ],
    quickNote: "",
    idempotencyKey: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setSessionDb(FAKE_DB);
  resetStore();
});

describe("startSession", () => {
  it("starts at 0 elapsed seconds", () => {
    // Regression test: this was hardcoded to 32*60+18 (leftover demo data) — a session
    // must start a clean stopwatch, not a pre-loaded one.
    useSessionStore.getState().startSession("s1", "a1", "Riya Sharma", "Lower back pain");
    expect(useSessionStore.getState().elapsedSeconds).toBe(0);
  });

  it("generates a fresh idempotency key each time", () => {
    useSessionStore.getState().startSession("s1", "a1", "Riya Sharma", "Lower back pain");
    const first = useSessionStore.getState().idempotencyKey;
    useSessionStore.getState().startSession("s2", "a2", "Amit Kumar", "Knee pain");
    const second = useSessionStore.getState().idempotencyKey;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it("persists immediately as an active draft, anchored with a startedAt timestamp", () => {
    useSessionStore.getState().startSession("s1", "a1", "Riya Sharma", "Lower back pain", "p1", "clinic");
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ id: "s1", status: "active", patientId: "p1", type: "clinic" }),
    );
    const [, persisted] = mockUpsert.mock.calls[0];
    expect(persisted.startedAt).toEqual(expect.any(Number));
  });

  it("resets the checklist to defaults, discarding any prior session's progress", () => {
    useSessionStore.setState({ checklist: [{ id: "x", label: "leftover", done: true }] });
    useSessionStore.getState().startSession("s1", "a1", "Riya Sharma", "Lower back pain");
    expect(useSessionStore.getState().checklist.every((c) => !c.done)).toBe(true);
  });
});

describe("tick", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useSessionStore.getState().startSession("s1", "a1", "Riya Sharma", "Lower back pain");
    mockUpsert.mockClear(); // drop the startSession persist call
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not persist on every tick", () => {
    for (let i = 0; i < 9; i++) {
      jest.advanceTimersByTime(1000);
      useSessionStore.getState().tick();
    }
    expect(useSessionStore.getState().elapsedSeconds).toBe(9);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("persists every 10th tick, not more often", () => {
    for (let i = 0; i < 25; i++) {
      jest.advanceTimersByTime(1000);
      useSessionStore.getState().tick();
    }
    expect(useSessionStore.getState().elapsedSeconds).toBe(25);
    // Ticks 10 and 20 — throttled, not on every one of the 25 calls.
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it("derives elapsed time from the wall clock, not a per-tick counter — survives the app being backgrounded", () => {
    // RN suspends JS timers while backgrounded: the interval simply doesn't fire for a
    // while, then resumes with a single tick once foregrounded. A counter-based
    // implementation would have silently missed all that time; this must not.
    jest.advanceTimersByTime(5000); // 5 real seconds pass with no ticks at all — "backgrounded"
    useSessionStore.getState().tick(); // the first tick on resume
    expect(useSessionStore.getState().elapsedSeconds).toBe(5);
  });

  it("self-corrects even if a tick is skipped entirely", () => {
    jest.advanceTimersByTime(1000);
    useSessionStore.getState().tick();
    expect(useSessionStore.getState().elapsedSeconds).toBe(1);

    jest.advanceTimersByTime(3000); // three intervals' worth pass without a tick call
    useSessionStore.getState().tick();
    expect(useSessionStore.getState().elapsedSeconds).toBe(4);
  });
});

describe("toggleChecklistItem", () => {
  it("flips the item and persists immediately — these are discrete, infrequent taps", () => {
    useSessionStore.getState().startSession("s1", "a1", "Riya Sharma", "Lower back pain");
    mockUpsert.mockClear();

    useSessionStore.getState().toggleChecklistItem("assessment");
    expect(useSessionStore.getState().checklist.find((c) => c.id === "assessment")?.done).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

describe("setQuickNote", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useSessionStore.getState().startSession("s1", "a1", "Riya Sharma", "Lower back pain");
    mockUpsert.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("updates state synchronously but debounces persistence", () => {
    useSessionStore.getState().setQuickNote("L4-L5 mobilisation");
    expect(useSessionStore.getState().quickNote).toBe("L4-L5 mobilisation");
    expect(mockUpsert).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("collapses rapid keystrokes into a single persisted write", () => {
    for (const c of "hello") {
      useSessionStore.getState().setQuickNote(useSessionStore.getState().quickNote + c);
      jest.advanceTimersByTime(100); // well under the 500ms debounce window
    }
    jest.advanceTimersByTime(500);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

describe("endSession", () => {
  it("marks the draft paused, not completed — pausing isn't finishing", () => {
    useSessionStore.getState().startSession("s1", "a1", "Riya Sharma", "Lower back pain");
    mockUpsert.mockClear();

    useSessionStore.getState().endSession();
    expect(useSessionStore.getState().isActive).toBe(false);
    expect(mockUpsert).toHaveBeenCalledWith(FAKE_DB, expect.objectContaining({ status: "paused" }));
  });
});

describe("resumeFromDraft", () => {
  it("repopulates state from a cold-start draft without a fresh write, including startedAt", () => {
    const draft: Session = {
      id: "s9",
      appointmentId: "a9",
      patientId: "p9",
      patientName: "Neha Verma",
      condition: "Shoulder impingement",
      type: "home",
      status: "active",
      startedAt: 1_700_000_000_000,
      elapsedSeconds: 612,
      checklist: [{ id: "manual", label: "Manual therapy", done: true }],
      quickNote: "draft note",
      syncStatus: "synced",
    };

    useSessionStore.getState().resumeFromDraft(draft);
    const s = useSessionStore.getState();
    expect(s.sessionId).toBe("s9");
    expect(s.elapsedSeconds).toBe(612);
    expect(s.isActive).toBe(true);
    expect(s.startedAt).toBe(1_700_000_000_000);
    expect(s.checklist).toEqual(draft.checklist);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("reset", () => {
  it("clears everything back to a clean slate", () => {
    useSessionStore.getState().startSession("s1", "a1", "Riya Sharma", "Lower back pain");
    useSessionStore.getState().reset();
    const s = useSessionStore.getState();
    expect(s.sessionId).toBeNull();
    expect(s.isActive).toBe(false);
    expect(s.elapsedSeconds).toBe(0);
    expect(s.idempotencyKey).toBeNull();
  });
});

describe("resumeSession (re-entering a paused session)", () => {
  it("re-anchors the wall clock so paused time isn't charged to the session", () => {
    // A session paused at 10 minutes and resumed an hour later must still read 10 minutes.
    // `tick()` derives elapsed as `now - startedAt`, so keeping the original anchor would
    // have the timer jump straight to 70 minutes on the first tick after resuming.
    useSessionStore.setState({
      sessionId: "s1",
      appointmentId: "a1",
      isActive: false,
      elapsedSeconds: 600,
      startedAt: Date.now() - 70 * 60 * 1000,
    });

    useSessionStore.getState().resumeSession();
    useSessionStore.getState().tick();

    // One tick's worth of tolerance — the anchor is set from the live clock.
    expect(useSessionStore.getState().elapsedSeconds).toBeGreaterThanOrEqual(600);
    expect(useSessionStore.getState().elapsedSeconds).toBeLessThanOrEqual(601);
  });

  it("makes the session live again and persists it as active", () => {
    useSessionStore.setState({
      sessionId: "s1",
      appointmentId: "a1",
      isActive: false,
      elapsedSeconds: 120,
      startedAt: Date.now() - 500_000,
    });

    useSessionStore.getState().resumeSession();

    expect(useSessionStore.getState().isActive).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(FAKE_DB, expect.objectContaining({ status: "active" }));
  });
});
