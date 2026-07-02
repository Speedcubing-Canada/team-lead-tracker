import { beforeEach, describe, expect, it, vi } from "vitest";

// Firebase mocks (no live SDK / network in unit tests).
vi.mock("./firebase", () => ({ db: () => ({ kind: "db" }) }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, path: string) => ({ path })),
  doc: vi.fn((_db, path: string) => ({ path })),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => "ts"),
}));

import { deleteDoc, setDoc } from "firebase/firestore";
import { checkDocId, parseCheckDocId, toggleStatus, writeNote, writeStatus } from "./checks";

const user = { wcaUserId: 9, name: "Lead" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkDocId", () => {
  it("keys a check by group activity and registrant", () => {
    expect(checkDocId(101, 5)).toBe("101_5");
  });

  it("round-trips through parseCheckDocId", () => {
    expect(parseCheckDocId(checkDocId(101, 5))).toEqual({ activityId: 101, registrantId: 5 });
  });

  it("returns null for a malformed id", () => {
    expect(parseCheckDocId("nope")).toBeNull();
  });
});

describe("toggleStatus", () => {
  it("sets a status when none is set", () => {
    expect(toggleStatus(null, "present")).toBe("present");
    expect(toggleStatus(null, "absent")).toBe("absent");
  });

  it("switches between statuses", () => {
    expect(toggleStatus("present", "absent")).toBe("absent");
    expect(toggleStatus("absent", "present")).toBe("present");
  });

  it("clears the status when the active one is tapped again", () => {
    expect(toggleStatus("present", "present")).toBeNull();
    expect(toggleStatus("absent", "absent")).toBeNull();
  });
});

describe("writeNote", () => {
  it("writes a note-only check with no status field", async () => {
    await writeNote("comp1", 101, 5, "left early", user);

    expect(setDoc).toHaveBeenCalledWith(
      { path: "competitions/comp1/checks/101_5" },
      expect.objectContaining({ note: "left early", updatedByWcaId: 9 }),
      { merge: true },
    );
    // A note-only doc carries no present/absent mark.
    expect(vi.mocked(setDoc).mock.calls[0][1]).not.toHaveProperty("status");
  });
});

describe("writeStatus", () => {
  it("deletes the check when the status is cleared to null", async () => {
    await writeStatus("comp1", 101, 5, null, user);

    expect(deleteDoc).toHaveBeenCalledWith({ path: "competitions/comp1/checks/101_5" });
    expect(setDoc).not.toHaveBeenCalled();
  });
});
