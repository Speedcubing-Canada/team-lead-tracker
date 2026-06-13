import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AuthUser } from "../auth/AuthContext";

export type CheckStatus = "present" | "absent";

export interface CheckRecord {
  status: CheckStatus;
  note: string;
  updatedByName: string;
  updatedByWcaId: number;
}

/** A check is keyed by group activity + registrant, unambiguous across stages/rounds. */
export function checkDocId(activityId: number, registrantId: number): string {
  return `${activityId}_${registrantId}`;
}

/** Tapping the active status clears it; tapping the other switches. */
export function toggleStatus(current: CheckStatus | null, clicked: CheckStatus): CheckStatus | null {
  return current === clicked ? null : clicked;
}

function checkRef(competitionId: string, activityId: number, registrantId: number) {
  return doc(db(), `competitions/${competitionId}/checks/${checkDocId(activityId, registrantId)}`);
}

/** Live subscription to all of a competition's checks, keyed by check id. */
export function subscribeToChecks(
  competitionId: string,
  onChange: (checks: Map<string, CheckRecord>) => void,
): () => void {
  const ref = collection(db(), `competitions/${competitionId}/checks`);
  return onSnapshot(ref, (snap) => {
    const map = new Map<string, CheckRecord>();
    snap.forEach((d) => map.set(d.id, d.data() as CheckRecord));
    onChange(map);
  });
}

/** Set (or clear) a staffer's present/absent status for a group. */
export async function writeStatus(
  competitionId: string,
  activityId: number,
  registrantId: number,
  status: CheckStatus | null,
  user: AuthUser,
): Promise<void> {
  const ref = checkRef(competitionId, activityId, registrantId);
  if (status === null) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(
    ref,
    {
      status,
      updatedByName: user.name,
      updatedByWcaId: user.wcaUserId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Update a staffer's note (the check doc must already have a status). */
export async function writeNote(
  competitionId: string,
  activityId: number,
  registrantId: number,
  note: string,
  user: AuthUser,
): Promise<void> {
  await setDoc(
    checkRef(competitionId, activityId, registrantId),
    {
      note,
      updatedByName: user.name,
      updatedByWcaId: user.wcaUserId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
