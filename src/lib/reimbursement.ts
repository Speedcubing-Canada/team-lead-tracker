import type { Wcif, WcifPerson } from "./wca";
import { isStaffCode } from "./wcif";
import { checkDocId, type CheckRecord } from "./checks";
import { startedActivityIds } from "./absentees";

/**
 * One person's whole-competition staffing record, for the post-comp
 * reimbursement report. Counts are over their *already-started* staff
 * assignments only (future groups can't have happened yet).
 *
 * - `unknown` = a duty no delegate ever ticked present/absent. It is surfaced
 *   for a complete view but does NOT count as missed.
 * - `absentRate` = `absent / total` (total includes unknown), so unmarked duties
 *   dilute rather than inflate the rate — this is what drives the reimbursement
 *   tier, keeping unknowns from penalising staff.
 * - `coverage` = `(present + absent) / total`, how much of their load was
 *   actually recorded, so a reviewer can spot low-confidence rows.
 */
export interface StaffTotals {
  person: WcifPerson;
  total: number;
  present: number;
  absent: number;
  unknown: number;
  absentRate: number;
  coverage: number;
}

/** A reimbursement band: anyone at or below `maxAbsentPct` absent gets `label`. */
export interface Tier {
  maxAbsentPct: number;
  label: string;
}

/** Sensible starting bands: <=5% absent = Full, <=25% = Partial, else None. */
export const DEFAULT_TIERS: Tier[] = [
  { maxAbsentPct: 5, label: "Full" },
  { maxAbsentPct: 25, label: "Partial" },
  { maxAbsentPct: Infinity, label: "None" },
];

/**
 * Per-person staffing totals across the whole competition, worst-first: by
 * absent rate, then by how many duties went unrecorded, then by name. Everyone
 * with at least one started staff assignment appears — even if fully unmarked —
 * so nobody silently drops off the reimbursement list.
 */
export function reimbursementByPerson(
  wcif: Wcif,
  checks: Map<string, CheckRecord>,
  now: Date = new Date(),
): StaffTotals[] {
  const started = startedActivityIds(wcif, now);
  const rows: StaffTotals[] = [];

  for (const person of wcif.persons) {
    if (person.registrantId == null) continue;
    let present = 0;
    let absent = 0;
    let unknown = 0;
    for (const a of person.assignments) {
      if (!isStaffCode(a.assignmentCode) || !started.has(a.activityId)) continue;
      const rec = checks.get(checkDocId(a.activityId, person.registrantId));
      if (!rec) unknown += 1;
      else if (rec.status === "absent") absent += 1;
      else present += 1;
    }
    const total = present + absent + unknown;
    if (total === 0) continue;
    rows.push({
      person,
      total,
      present,
      absent,
      unknown,
      absentRate: absent / total,
      coverage: (present + absent) / total,
    });
  }

  rows.sort(
    (a, b) =>
      b.absentRate - a.absentRate ||
      b.unknown - a.unknown ||
      a.person.name.localeCompare(b.person.name),
  );
  return rows;
}

/**
 * The reimbursement label for an absence percentage (0–100). Tiers are matched
 * in ascending order of their cap, so the first band whose `maxAbsentPct` covers
 * the value wins; falls back to the last band's label.
 */
export function tierFor(absentPct: number, tiers: Tier[] = DEFAULT_TIERS): string {
  const sorted = [...tiers].sort((a, b) => a.maxAbsentPct - b.maxAbsentPct);
  for (const tier of sorted) {
    if (absentPct <= tier.maxAbsentPct) return tier.label;
  }
  return sorted[sorted.length - 1]?.label ?? "";
}

/**
 * How many people land in each tier, in the tiers' own order — drives the
 * summary chips. Tiers with nobody in them still appear (count 0) so the summary
 * is stable as thresholds change.
 */
export function tierTally(
  rows: StaffTotals[],
  tiers: Tier[] = DEFAULT_TIERS,
): { label: string; count: number }[] {
  const counts = new Map(tiers.map((t) => [t.label, 0]));
  for (const r of rows) {
    const label = tierFor(Math.round(r.absentRate * 100), tiers);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return tiers.map((t) => ({ label: t.label, count: counts.get(t.label) ?? 0 }));
}

/**
 * The qualitative tone of an absence percentage for colour-coding: the best
 * (lowest-cap) tier is `good`, the worst is `bad`, anything between is `warn`.
 * Defined by tier *position*, so it tracks whatever custom bands the user sets.
 */
export function toneFor(absentPct: number, tiers: Tier[] = DEFAULT_TIERS): "good" | "warn" | "bad" {
  const sorted = [...tiers].sort((a, b) => a.maxAbsentPct - b.maxAbsentPct);
  const label = tierFor(absentPct, sorted);
  const i = sorted.findIndex((t) => t.label === label);
  if (i <= 0) return "good";
  if (i >= sorted.length - 1) return "bad";
  return "warn";
}
