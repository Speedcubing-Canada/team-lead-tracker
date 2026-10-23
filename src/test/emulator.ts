import firestoreRules from "../../firestore.rules?raw";
import storageRules from "../../storage.rules?raw";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, setLogLevel } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { mergeAccessClaims } from "../../functions/src/access";
import { swapUser } from "./emulatorFirebase";

export const LEAD = { uid: "lead", wcaUserId: 1, name: "Lead", privileged: false };
export const DELEGATE = { uid: "delegate", wcaUserId: 2, name: "Del", privileged: true };
const MEMBERS = [LEAD, DELEGATE];

/**
 * Starts a rules test environment for this file and, before each test, wipes it and
 * seeds `comp` with its members: membership docs here, claims in `contextFor`.
 */
export function useEmulator(comp: string) {
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
    await seed(`competitions/${comp}`, { name: comp });
    for (const { uid, wcaUserId, privileged } of MEMBERS) {
      await seed(`competitions/${comp}/members/${uid}`, { wcaUserId, privileged });
    }
  });

  /** Writes a doc with rules disabled. */
  function seed(path: string, data: Record<string, unknown>) {
    return env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));
  }

  /** Uploads a JPEG with rules disabled. */
  function seedObject(path: string, bytes: Uint8Array) {
    return env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path), bytes, { contentType: "image/jpeg" });
    });
  }

  /**
   * A context for `uid` (null = signed out). Members carry the claims grantCompetitionAccess
   * mints, anyone else none; `claims` overrides either.
   */
  function contextFor(uid: string | null, claims?: Record<string, unknown>) {
    if (uid === null) return env.unauthenticatedContext();
    const member = MEMBERS.find((m) => m.uid === uid);
    return env.authenticatedContext(
      uid,
      claims ?? (member ? mergeAccessClaims({}, comp, member.privileged) : {}),
    );
  }

  /** Makes the app's `db()`/`storage()`/`auth()` act as `uid`. */
  function signInAs(uid: string) {
    swapUser({ uid, ctx: contextFor(uid) });
  }

  /** Runs `fn` as `uid`, then restores whoever was signed in before. */
  async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
    const previous = swapUser({ uid, ctx: contextFor(uid) });
    try {
      return await fn();
    } finally {
      swapUser(previous);
    }
  }

  return { seed, seedObject, contextFor, signInAs, as };
}

/** Resolves with a subscription's first value, or rejects on its error. */
export function firstValue<T>(
  subscribe: (next: (value: T) => void, fail: (err: Error) => void) => () => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    let done = false;
    unsubscribe = subscribe(
      (value) => {
        done = true;
        unsubscribe?.();
        resolve(value);
      },
      reject,
    );
    // A source that emits synchronously fires before `unsubscribe` is assigned.
    if (done) unsubscribe();
  });
}
