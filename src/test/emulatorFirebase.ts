import type { RulesTestContext } from "@firebase/rules-unit-testing";

// Stands in for `src/lib/firebase` (via `vi.mock("./firebase", () => import(...))`), so the
// real SDK calls hit the emulators as the signed-in test user. The mock factory and
// `emulator.ts` must share this module instance, which vitest's module cache guarantees.
export interface SignedIn {
  uid: string;
  ctx: RulesTestContext;
}

let current: SignedIn | undefined;

function signedIn() {
  if (!current) throw new Error("No emulator user signed in");
  return current;
}

export const db = () => signedIn().ctx.firestore();
export const storage = () => signedIn().ctx.storage();
export const auth = () => ({ currentUser: { uid: signedIn().uid } });

/** Signs `next` in and returns whoever was signed in before. */
export function swapUser(next: SignedIn | undefined): SignedIn | undefined {
  const previous = current;
  current = next;
  return previous;
}
