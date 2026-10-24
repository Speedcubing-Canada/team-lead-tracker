import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AuthUser } from "../auth/AuthContext";

export type CheckStatus = "present" | "absent";

export interface CheckRecord {
  // Absent for a note-only check: a lead can jot a note without yet marking
  // present/absent. Dashboards tally only explicit "present"/"absent".
  status?: CheckStatus;
  note?: string;
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
  onError?: (err: Error) => void,
): () => void {
  const ref = collection(db(), `competitions/${competitionId}/checks`);
  return onSnapshot(
    ref,
    (snap) => {
      const map = new Map<string, CheckRecord>();
      snap.forEach((d) => map.set(d.id, d.data() as CheckRecord));
      onChange(map);
    },
    onError,
  );
}

/**
 * What a status tap writes. A non-empty note rides along so a fresh doc carries it
 * (a status-less check needs a note to pass the rules); clearing the status keeps it
 * as a note-only check, or deletes the check (null) when there's no note.
 */
export function checkWrite(
  status: CheckStatus | null,
  note?: string,
): { status: CheckStatus | null; note?: string } | null {
  if (status === null && !note) return null;
  return { status, ...(note !== undefined ? { note } : {}) };
}

/** Set (or clear) a staffer's status for a group; omit `note` to leave any note untouched. */
export async function writeStatus(
  competitionId: string,
  activityId: number,
  registrantId: number,
  status: CheckStatus | null,
  user: AuthUser,
  note?: string,
): Promise<void> {
  const ref = checkRef(competitionId, activityId, registrantId);
  const write = checkWrite(status, note);
  if (!write) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(
    ref,
    {
      ...write,
      status: write.status ?? deleteField(),
      updatedByName: user.name,
      updatedByWcaId: user.wcaUserId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Update a staffer's note. Creates a note-only check (no present/absent mark) if
 * none exists; the security rules allow a status-less doc as long as it carries
 * a string note.
 */
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
