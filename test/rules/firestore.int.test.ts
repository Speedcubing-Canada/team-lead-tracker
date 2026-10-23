import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, setLogLevel } from "firebase/firestore";

const COMP = "TestComp2026";
const CHECK = `competitions/${COMP}/checks/101_5`;
const PERSON = `competitions/${COMP}/people/42`;

let env: RulesTestEnvironment;

beforeAll(async () => {
  setLogLevel("error");
  env = await initializeTestEnvironment({
    projectId: "demo-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `competitions/${COMP}`), { name: "Test Comp" });
    await setDoc(doc(db, `competitions/${COMP}/members/lead`), { wcaUserId: 1, privileged: false });
    await setDoc(doc(db, `competitions/${COMP}/members/delegate`), { wcaUserId: 2, privileged: true });
  });
});

const lead = () => env.authenticatedContext("lead").firestore();
const delegate = () => env.authenticatedContext("delegate").firestore();
const outsider = () => env.authenticatedContext("outsider").firestore();
const anon = () => env.unauthenticatedContext().firestore();

const mark = (status: string) => ({ status, updatedByWcaId: 1, updatedByName: "Lead" });

async function seedCheck(data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), CHECK), data));
}

describe("checks", () => {
  it("lets a member mark present or absent", async () => {
    await assertSucceeds(setDoc(doc(lead(), CHECK), mark("present")));
    await assertSucceeds(setDoc(doc(lead(), CHECK), mark("absent")));
  });

  it("lets a member mark with a note in one write", async () => {
    await assertSucceeds(setDoc(doc(lead(), CHECK), { ...mark("absent"), note: "late" }));
  });

  it("lets a member create a note-only check", async () => {
    await assertSucceeds(setDoc(doc(lead(), CHECK), { note: "on break", updatedByWcaId: 1 }));
  });

  it("lets a member merge a note onto an already-marked check", async () => {
    await seedCheck(mark("present"));
    await assertSucceeds(
      setDoc(doc(lead(), CHECK), { note: "left early", updatedByWcaId: 1 }, { merge: true }),
    );
  });

  it("lets a member mark a note-only check", async () => {
    await seedCheck({ note: "on break", updatedByWcaId: 1 });
    await assertSucceeds(setDoc(doc(lead(), CHECK), mark("present"), { merge: true }));
  });

  it("lets a member read and delete checks", async () => {
    await seedCheck(mark("present"));
    await assertSucceeds(getDoc(doc(lead(), CHECK)));
    await assertSucceeds(deleteDoc(doc(lead(), CHECK)));
  });

  it("rejects a status outside present/absent, even with a note", async () => {
    await assertFails(setDoc(doc(lead(), CHECK), mark("late")));
    await assertFails(setDoc(doc(lead(), CHECK), { ...mark("late"), note: "x" }));
  });

  it("rejects a note that isn't a string alongside a mark", async () => {
    await assertFails(setDoc(doc(lead(), CHECK), { ...mark("present"), note: 5 }));
  });

  it("rejects a check attributed to another WCA user", async () => {
    await assertFails(setDoc(doc(lead(), CHECK), { ...mark("present"), updatedByWcaId: 2 }));
    await assertFails(setDoc(doc(lead(), CHECK), { note: "x", updatedByWcaId: 2 }));
  });

  it("rejects a write without an int updatedByWcaId", async () => {
    await assertFails(setDoc(doc(lead(), CHECK), { status: "present" }));
    await assertFails(setDoc(doc(lead(), CHECK), { status: "present", updatedByWcaId: "1" }));
    await assertFails(setDoc(doc(lead(), CHECK), { note: "x", updatedByWcaId: 1.5 }));
  });

  it("rejects a write with neither a status nor a string note", async () => {
    await assertFails(setDoc(doc(lead(), CHECK), { updatedByWcaId: 1 }));
    await assertFails(setDoc(doc(lead(), CHECK), { note: 3, updatedByWcaId: 1 }));
  });

  it("denies non-members and signed-out users", async () => {
    await seedCheck(mark("present"));
    for (const db of [outsider(), anon()]) {
      await assertFails(getDoc(doc(db, CHECK)));
      await assertFails(setDoc(doc(db, CHECK), mark("absent")));
      await assertFails(deleteDoc(doc(db, CHECK)));
    }
  });

  it("denies a member of another competition", async () => {
    await assertFails(setDoc(doc(lead(), "competitions/OtherComp/checks/101_5"), mark("present")));
  });
});

describe("competition meta and members", () => {
  it("lets members read but never write", async () => {
    await assertSucceeds(getDoc(doc(lead(), `competitions/${COMP}`)));
    await assertSucceeds(getDoc(doc(lead(), `competitions/${COMP}/members/delegate`)));
    await assertFails(setDoc(doc(delegate(), `competitions/${COMP}`), { name: "x" }));
    await assertFails(
      setDoc(doc(delegate(), `competitions/${COMP}/members/lead`), { privileged: true }),
    );
  });

  it("stops a user from granting themselves membership or privilege", async () => {
    await assertFails(
      setDoc(doc(outsider(), `competitions/${COMP}/members/outsider`), { wcaUserId: 3 }),
    );
    await assertFails(
      setDoc(doc(lead(), `competitions/${COMP}/members/lead`), { wcaUserId: 1, privileged: true }),
    );
  });

  it("hides meta and members from non-members", async () => {
    await assertFails(getDoc(doc(outsider(), `competitions/${COMP}`)));
    await assertFails(getDoc(doc(outsider(), `competitions/${COMP}/members/lead`)));
  });
});

describe("people photos", () => {
  const photo = { photoPath: `competitions/${COMP}/people/42.jpg`, uploadedByWcaId: 2 };

  it("lets a privileged member write and delete photo metadata", async () => {
    await assertSucceeds(setDoc(doc(delegate(), PERSON), photo));
    await assertSucceeds(deleteDoc(doc(delegate(), PERSON)));
  });

  it("rejects malformed photo metadata", async () => {
    await assertFails(setDoc(doc(delegate(), PERSON), { photoPath: 1, uploadedByWcaId: 2 }));
    await assertFails(setDoc(doc(delegate(), PERSON), { photoPath: "p", uploadedByWcaId: "2" }));
  });

  it("rejects photo metadata attributed to another WCA user", async () => {
    await assertFails(setDoc(doc(delegate(), PERSON), { ...photo, uploadedByWcaId: 1 }));
  });

  it("lets any member read, but only privileged members write", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), PERSON), photo));
    await assertSucceeds(getDoc(doc(lead(), PERSON)));
    await assertFails(setDoc(doc(lead(), PERSON), photo));
    await assertFails(deleteDoc(doc(lead(), PERSON)));
    await assertFails(getDoc(doc(outsider(), PERSON)));
  });
});
