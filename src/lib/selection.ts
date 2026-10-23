import type { Wcif } from "./wca";
import { compDate, defaultStageId, listStages } from "./wcif";

/**
 * The lead's current stage + group selection, persisted per competition in
 * localStorage so it survives tab navigation (Stage ↔ Dashboard unmounts the
 * board) and page reloads. We store the group's stable WCIF `activityId` rather
 * than its array index, plus the day it was saved so a stale cross-day selection
 * can be re-detected against today's schedule.
 */
export interface StoredSelection {
  stageId: string;
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
    if (typeof v.stageId !== "string" || typeof v.groupActivityId !== "number") return null;
    return { stageId: v.stageId, groupActivityId: v.groupActivityId, savedDate: v.savedDate ?? "" };
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

/** A selection saved today (venue time) for a stage the comp still has; older ones get re-derived. */
export function freshSelection(
  wcif: Wcif,
  competitionId: string | undefined,
  now: Date = new Date(),
): StoredSelection | null {
  const stored = competitionId ? loadSelection(competitionId) : null;
  if (!stored || stored.savedDate !== compDate(wcif, now)) return null;
  return listStages(wcif).some((s) => s.id === stored.stageId) ? stored : null;
}

/** Stage to open on: today's saved choice, else the one the lead works next, else the first. */
export function initialStageId(
  wcif: Wcif,
  competitionId: string | undefined,
  wcaUserId: number | undefined,
  now: Date = new Date(),
): string | null {
  return (
    freshSelection(wcif, competitionId, now)?.stageId ??
    (wcaUserId != null ? defaultStageId(wcif, wcaUserId, now) : listStages(wcif)[0]?.id) ??
    null
  );
}
