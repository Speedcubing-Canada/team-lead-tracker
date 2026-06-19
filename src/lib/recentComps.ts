import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "./firebase";
import type { MyCompetition } from "./wca";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Competitions that finished within the last `days` (default 30) and aren't
 * still running — the ones a lead might still owe the organisation a
 * reimbursement report for. Most-recently-ended first. `endDate` is a plain
 * YYYY-MM-DD; we treat the comp as ended at the end of that local day.
 */
export function recentlyEndedComps(
  comps: MyCompetition[],
  now: Date = new Date(),
  days = 30,
): MyCompetition[] {
  const nowMs = now.getTime();
  const cutoff = nowMs - days * DAY_MS;
  return comps
    .filter((c) => {
      if (c.ongoing) return false;
      const endMs = new Date(`${c.endDate}T23:59:59`).getTime();
      return endMs <= nowMs && endMs >= cutoff;
    })
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
}

/**
 * Competitions that haven't finished yet — ongoing or still upcoming — for the
 * main list. Keeps the server's ordering (ongoing first, then by start date).
 * Past comps are handled separately by `recentlyEndedComps`.
 */
export function upcomingComps(comps: MyCompetition[], now: Date = new Date()): MyCompetition[] {
  const nowMs = now.getTime();
  return comps.filter(
    (c) => c.ongoing || new Date(`${c.endDate}T23:59:59`).getTime() >= nowMs,
  );
}

/**
 * Whether a competition has any check-off data at all. Used to hide recent comps
 * the lead never actually tracked. A comp the user isn't a member of returns
 * permission-denied from the rules — caught and treated as "no data".
 */
export async function hasCheckData(competitionId: string): Promise<boolean> {
  try {
    const snap = await getDocs(
      query(collection(db(), `competitions/${competitionId}/checks`), limit(1)),
    );
    return !snap.empty;
  } catch {
    return false;
  }
}
