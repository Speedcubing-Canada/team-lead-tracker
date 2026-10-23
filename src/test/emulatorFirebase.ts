import type { RulesTestContext } from "@firebase/rules-unit-testing";

// Stands in for `src/lib/firebase` so the real SDK calls hit the emulators as the signed-in test user.
let current: { uid: string; ctx: RulesTestContext } | undefined;

function signedIn() {
  if (!current) throw new Error("No emulator user signed in");
  return current;
}

export const db = () => signedIn().ctx.firestore();
export const storage = () => signedIn().ctx.storage();
export const auth = () => ({ currentUser: { uid: signedIn().uid } });

export function setSignedIn(uid: string, ctx: RulesTestContext): void {
  current = { uid, ctx };
}

export const getSignedIn = () => current;
