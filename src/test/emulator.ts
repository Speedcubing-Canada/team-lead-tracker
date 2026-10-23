import firestoreRules from "../../firestore.rules?raw";
import storageRules from "../../storage.rules?raw";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, setLogLevel } from "firebase/firestore";
import { mergeAccessClaims } from "../../functions/src/access";
import { getSignedIn, setSignedIn } from "./emulatorFirebase";

export const LEAD = { uid: "lead", wcaUserId: 1, name: "Lead" };
export const DELEGATE = { uid: "delegate", wcaUserId: 2, name: "Del" };

/**
 * Starts a rules test environment for this file and, before each test, wipes it and
 * seeds `comp` with a plain lead and a privileged delegate (membership docs + claims).
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
    for (const m of [LEAD, DELEGATE]) {
      await seed(`competitions/${comp}/members/${m.uid}`, {
        wcaUserId: m.wcaUserId,
        privileged: m === DELEGATE,
      });
    }
  });

  /** Writes a doc with rules disabled. */
  function seed(path: string, data: Record<string, unknown>) {
    return env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));
  }

  /** A signed-in context carrying the claims grantCompetitionAccess would mint. */
  function contextFor(uid: string) {
    return env.authenticatedContext(uid, mergeAccessClaims({}, comp, uid === DELEGATE.uid));
  }

  /** Makes the app's `db()`/`storage()`/`auth()` act as `uid`. */
  function signInAs(uid: string) {
    setSignedIn(uid, contextFor(uid));
  }

  /** Runs `fn` as `uid`, then signs the previous user back in. */
  async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
    const previous = getSignedIn();
    signInAs(uid);
    try {
      return await fn();
    } finally {
      if (previous) setSignedIn(previous.uid, previous.ctx);
    }
  }

  return { env: () => env, seed, contextFor, signInAs, as };
}

/** Resolves with a subscription's first value, or rejects on its error. */
export function firstValue<T>(
  subscribe: (next: (value: T) => void, fail: (err: Error) => void) => () => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const unsubscribe = subscribe(
      (value) => {
        unsubscribe();
        resolve(value);
      },
      reject,
    );
  });
}
