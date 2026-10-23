import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELEGATE, LEAD, firstValue, useEmulator } from "../test/emulator";
import { subscribeToChecks, writeNote, writeStatus } from "./checks";

vi.mock("./firebase", () => import("../test/emulatorFirebase"));

const COMP = "ChecksComp2026";
const ID = "101_5";

const { signInAs, as } = useEmulator(COMP);
beforeEach(() => signInAs(LEAD.uid));

/** What another member's live subscription receives for the check, i.e. what the server stored. */
const seenByOtherMember = () =>
  as(DELEGATE.uid, () =>
    firstValue((next, fail) => subscribeToChecks(COMP, (checks) => next(checks.get(ID)), fail)),
  );

describe("checks against the emulator", () => {
  it("marks a staffer present without touching the note", async () => {
    await writeStatus(COMP, 101, 5, "present", LEAD);
    const check = await seenByOtherMember();
    expect(check).toMatchObject({ status: "present", updatedByName: "Lead", updatedByWcaId: 1 });
    expect(check).not.toHaveProperty("note");
  });

  it("marks absent with a note in one write", async () => {
    await writeStatus(COMP, 101, 5, "absent", LEAD, "late");
    expect(await seenByOtherMember()).toMatchObject({ status: "absent", note: "late" });
  });

  it("saves a note on an unmarked staffer", async () => {
    await writeNote(COMP, 101, 5, "on break", LEAD);
    const check = await seenByOtherMember();
    expect(check).toMatchObject({ note: "on break", updatedByWcaId: 1 });
    expect(check).not.toHaveProperty("status");
  });

  it("keeps the note when the staffer is marked afterwards", async () => {
    await writeNote(COMP, 101, 5, "on break", LEAD);
    await writeStatus(COMP, 101, 5, "present", LEAD);
    expect(await seenByOtherMember()).toMatchObject({ status: "present", note: "on break" });
  });

  it("keeps the note as a note-only check when the status is cleared", async () => {
    await writeStatus(COMP, 101, 5, "absent", LEAD, "sick");
    await writeStatus(COMP, 101, 5, null, LEAD, "sick");
    const check = await seenByOtherMember();
    expect(check).toMatchObject({ note: "sick" });
    expect(check).not.toHaveProperty("status");
  });

  it("deletes the check when the status is cleared without a note", async () => {
    await writeStatus(COMP, 101, 5, "present", LEAD);
    await writeStatus(COMP, 101, 5, null, LEAD);
    expect(await seenByOtherMember()).toBeUndefined();
  });

  it("rejects writes from a non-member", async () => {
    signInAs("outsider");
    await expect(writeStatus(COMP, 101, 5, "present", LEAD)).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(await seenByOtherMember()).toBeUndefined();
  });

  it("reports a denied subscription instead of hanging", async () => {
    signInAs("outsider");
    await expect(
      firstValue((next, fail) => subscribeToChecks(COMP, next, fail)),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});
