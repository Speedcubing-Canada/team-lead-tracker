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

/** Inverse of checkDocId; returns null if the id isn't a valid "activityId_registrantId". */
export function parseCheckDocId(id: string): { activityId: number; registrantId: number } | null {
  const [activityId, registrantId, ...rest] = id.split("_");
  if (rest.length > 0) return null;
  const a = Number(activityId);
  const r = Number(registrantId);
  if (!Number.isFinite(a) || !Number.isFinite(r) || activityId === "" || registrantId === "") {
    return null;
  }
  return { activityId: a, registrantId: r };
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

/**
 * Set (or clear) a staffer's present/absent status for a group. An optional note
 * is written in the same operation so a freshly created doc carries both — a
 * status-less check would be rejected by the security rules. Omit `note` to leave
 * any existing note untouched.
 */
export async function writeStatus(
  competitionId: string,
  activityId: number,
  registrantId: number,
  status: CheckStatus | null,
  user: AuthUser,
  note?: string,
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
      ...(note !== undefined ? { note } : {}),
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
