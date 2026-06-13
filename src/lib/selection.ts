/**
 * The lead's current stage + group selection, persisted per competition in
 * localStorage so it survives tab navigation (Stage ↔ Dashboard unmounts the
 * board) and page reloads. We store the group's stable WCIF `activityId` rather
 * than its array index, plus the day it was saved so a stale cross-day selection
 * can be re-detected against today's schedule.
 */
export interface StoredSelection {
  roomId: number;
  groupActivityId: number;
  /** Calendar date (YYYY-MM-DD) this selection was saved. */
  savedDate: string;
}

function key(competitionId: string): string {
  return `tlt_selection_${competitionId}`;
}

export function loadSelection(competitionId: string): StoredSelection | null {
  try {
    const raw = localStorage.getItem(key(competitionId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<StoredSelection>;
    if (typeof v.roomId !== "number" || typeof v.groupActivityId !== "number") return null;
    return { roomId: v.roomId, groupActivityId: v.groupActivityId, savedDate: v.savedDate ?? "" };
  } catch {
    return null;
  }
}

export function saveSelection(competitionId: string, sel: StoredSelection): void {
  try {
    localStorage.setItem(key(competitionId), JSON.stringify(sel));
  } catch {
    // Ignore storage failures (private mode); the choice still applies this session.
  }
}
