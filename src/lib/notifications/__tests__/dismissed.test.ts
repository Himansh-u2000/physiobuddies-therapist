/**
 * The locally-stored "removed notifications" list. The merge keeps it deduplicated and bounded,
 * and the parser must survive whatever is in the key-value row — a corrupt value has to read as
 * "nothing removed", never crash the notifications screen.
 */
import { DISMISSED_CAP, mergeDismissed, parseDismissed } from "@/lib/notifications/dismissed";

jest.mock("@/lib/db/provider", () => ({ useDatabase: () => ({ db: null }) }));

describe("mergeDismissed", () => {
  it("appends new ids and ignores ones already removed", () => {
    expect(mergeDismissed(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("keeps only the newest ids once over the cap", () => {
    const existing = Array.from({ length: DISMISSED_CAP }, (_, i) => `n${i}`);
    const out = mergeDismissed(existing, ["new"]);
    expect(out).toHaveLength(DISMISSED_CAP);
    expect(out[0]).toBe("n1");
    expect(out[out.length - 1]).toBe("new");
  });
});

describe("parseDismissed", () => {
  it("reads a stored list", () => {
    expect(parseDismissed('["a","b"]')).toEqual(["a", "b"]);
  });

  it("treats empty, corrupt or wrongly-shaped values as nothing removed", () => {
    expect(parseDismissed(null)).toEqual([]);
    expect(parseDismissed("{not json")).toEqual([]);
    expect(parseDismissed('{"a":1}')).toEqual([]);
    expect(parseDismissed('["a",2,null]')).toEqual(["a"]);
  });
});
