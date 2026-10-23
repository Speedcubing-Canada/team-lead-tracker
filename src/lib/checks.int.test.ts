import firestoreRules from "../../firestore.rules?raw";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, setLogLevel } from "firebase/firestore";
import { subscribeToChecks, writeNote, writeStatus, type CheckRecord } from "./checks";

// Real SDK + real rules: `db()` resolves to whichever emulator context the test signed in as.
const signedIn = vi.hoisted(() => ({ ctx: undefined as RulesTestContext | undefined }));
vi.mock("./firebase", () => ({ db: () => signedIn.ctx!.firestore() }));

const COMP = "ChecksComp2026";
const ID = "101_5";
const lead = { wcaUserId: 1, name: "Lead" };

let env: RulesTestEnvironment;

beforeAll(async () => {
  setLogLevel("error");
  env = await initializeTestEnvironment({
    projectId: "demo-test",
    firestore: { rules: firestoreRules },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `competitions/${COMP}/members/lead`), { wcaUserId: 1, privileged: false });
    await setDoc(doc(db, `competitions/${COMP}/members/lead2`), { wcaUserId: 2, privileged: false });
  });
  signedIn.ctx = env.authenticatedContext("lead");
});

/** What another lead's live subscription receives for the check, i.e. what the server stored. */
function seenByOtherLead(): Promise<CheckRecord | undefined> {
  signedIn.ctx = env.authenticatedContext("lead2");
  return new Promise((resolve) => {
    const unsubscribe = subscribeToChecks(COMP, (checks) => {
      unsubscribe();
      resolve(checks.get(ID));
    });
  });
}

describe("checks against the emulator", () => {
  it("marks a staffer present without touching the note", async () => {
    await writeStatus(COMP, 101, 5, "present", lead);
    const check = await seenByOtherLead();
    expect(check).toMatchObject({ status: "present", updatedByName: "Lead", updatedByWcaId: 1 });
    expect(check).not.toHaveProperty("note");
  });

  it("marks absent with a note in one write", async () => {
    await writeStatus(COMP, 101, 5, "absent", lead, "late");
    expect(await seenByOtherLead()).toMatchObject({ status: "absent", note: "late" });
  });

  it("saves a note on an unmarked staffer", async () => {
    await writeNote(COMP, 101, 5, "on break", lead);
    const check = await seenByOtherLead();
    expect(check).toMatchObject({ note: "on break", updatedByWcaId: 1 });
    expect(check).not.toHaveProperty("status");
  });

  it("keeps the note when the staffer is marked afterwards", async () => {
    await writeNote(COMP, 101, 5, "on break", lead);
    await writeStatus(COMP, 101, 5, "present", lead);
    expect(await seenByOtherLead()).toMatchObject({ status: "present", note: "on break" });
  });

  it("clears the check when the status is set to null", async () => {
    await writeStatus(COMP, 101, 5, "present", lead);
    await writeStatus(COMP, 101, 5, null, lead);
    expect(await seenByOtherLead()).toBeUndefined();
  });

  it("rejects writes from a non-member", async () => {
    signedIn.ctx = env.authenticatedContext("outsider");
    await expect(writeStatus(COMP, 101, 5, "present", lead)).rejects.toMatchObject({
      code: "permission-denied",
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
      expect((await getDoc(doc(ctx.firestore(), `competitions/${COMP}/checks/${ID}`))).exists()).toBe(
        false,
      );
    });
  });
});
