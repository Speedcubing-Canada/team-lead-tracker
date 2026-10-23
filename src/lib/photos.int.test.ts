import firestoreRules from "../../firestore.rules?raw";
import storageRules from "../../storage.rules?raw";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, setLogLevel } from "firebase/firestore";
import { getBytes, ref } from "firebase/storage";
import {
  fetchPrivileged,
  removePersonPhoto,
  subscribePeoplePhotos,
  uploadPersonPhoto,
  type PersonPhoto,
} from "./photos";

const signedIn = vi.hoisted(() => ({ uid: "", ctx: undefined as RulesTestContext | undefined }));
vi.mock("./firebase", () => ({
  db: () => signedIn.ctx!.firestore(),
  storage: () => signedIn.ctx!.storage(),
  auth: () => ({ currentUser: { uid: signedIn.uid } }),
}));
// Canvas resizing is browser-only; the upload path is what's under test.
vi.mock("./image", () => ({
  resizeImageToJpeg: async () => new Blob([new Uint8Array(1024)], { type: "image/jpeg" }),
}));

const COMP = "PhotosComp2026";
const PATH = `competitions/${COMP}/people/42.jpg`;
const delegate = { wcaUserId: 2, name: "Del" };
const file = new File([], "me.jpg");

let env: RulesTestEnvironment;

beforeAll(async () => {
  setLogLevel("error");
  env = await initializeTestEnvironment({
    projectId: "demo-test",
    firestore: { rules: firestoreRules },
    storage: { rules: storageRules },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `competitions/${COMP}/members/lead`), { wcaUserId: 1, privileged: false });
    await setDoc(doc(db, `competitions/${COMP}/members/delegate`), { wcaUserId: 2, privileged: true });
  });
  signInAs("delegate");
});

// Claims mirror what grantCompetitionAccess mints; storage.rules reads them.
function signInAs(uid: "lead" | "delegate") {
  signedIn.uid = uid;
  signedIn.ctx = env.authenticatedContext(uid, {
    comps: { [COMP]: true },
    ...(uid === "delegate" ? { privilegedComps: { [COMP]: true } } : {}),
  });
}

/** What a stage lead's live subscription receives. */
function seenByLead(): Promise<Map<number, PersonPhoto>> {
  signInAs("lead");
  return new Promise((resolve) => {
    const unsubscribe = subscribePeoplePhotos(COMP, (photos) => {
      unsubscribe();
      resolve(photos);
    });
  });
}

describe("person photos against the emulators", () => {
  it("uploads the photo and syncs its metadata to leads", async () => {
    await uploadPersonPhoto(COMP, 42, file, delegate);

    expect((await seenByLead()).get(42)).toMatchObject({
      photoPath: PATH,
      uploadedByName: "Del",
      uploadedByWcaId: 2,
    });
    expect((await getBytes(ref(signedIn.ctx!.storage(), PATH))).byteLength).toBe(1024);
  });

  it("removes both the object and the metadata", async () => {
    await uploadPersonPhoto(COMP, 42, file, delegate);
    await removePersonPhoto(COMP, 42);

    expect((await seenByLead()).size).toBe(0);
    await expect(getBytes(ref(signedIn.ctx!.storage(), PATH))).rejects.toMatchObject({
      code: "storage/object-not-found",
    });
  });

  it("still clears the metadata when the object is already gone", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), `competitions/${COMP}/people/42`), {
        photoPath: PATH,
        uploadedByWcaId: 2,
      }),
    );
    await removePersonPhoto(COMP, 42);
    expect((await seenByLead()).size).toBe(0);
  });

  it("rejects an upload from a non-privileged lead", async () => {
    signInAs("lead");
    await expect(uploadPersonPhoto(COMP, 42, file, delegate)).rejects.toMatchObject({
      code: "storage/unauthorized",
    });
    expect((await seenByLead()).size).toBe(0);
  });

  it("reads privilege from the membership doc", async () => {
    await expect(fetchPrivileged(COMP)).resolves.toBe(true);
    signInAs("lead");
    await expect(fetchPrivileged(COMP)).resolves.toBe(false);
  });
});
