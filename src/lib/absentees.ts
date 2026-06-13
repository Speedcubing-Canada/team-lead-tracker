import type { Wcif, WcifPerson } from "./wca";
import { activityById, groupsForRoom, listStages, staffForGroup } from "./wcif";
import { parseCheckDocId, type CheckRecord } from "./checks";

export interface MissedGroup {
  groupName: string;
  note: string;
}

export interface AbsenteeSummary {
  person: WcifPerson;
  missed: MissedGroup[];
}

/**
 * A labeled tally, used to drive the shame-page bar charts. `count` is the
 * absences, `total` the denominator they're measured against (a person's staff
 * assignments / a group's staff), and `rate` = count / total (0 when total is 0).
 */
export interface AbsenceCount {
  label: string;
  count: number;
  total: number;
  rate: number;
}

/** A staff assignment code is any code in the "staff-*" namespace. */
function isStaffCode(code: string): boolean {
  return code.startsWith("staff");
}

/**
 * Ids of the group activities that have already started by `now`. Rates are
 * measured against these only — counting groups that haven't happened yet would
 * drown every rate in a huge denominator (e.g. 0/54 at the start of the comp).
 */
function startedActivityIds(wcif: Wcif, now: Date): Set<number> {
  const started = new Set<number>();
  const nowMs = now.getTime();
  for (const stage of listStages(wcif)) {
    for (const group of groupsForRoom(wcif, stage.id)) {
      if (new Date(group.activity.startTime).getTime() <= nowMs) {
        started.add(group.activity.id);
      }
    }
  }
  return started;
}

/**
 * Aggregate everyone currently marked absent across the competition, grouped by
 * person, with the groups they missed and any notes. People are sorted by name,
 * and each person's missed groups by group name.
 */
export function summarizeAbsentees(
  wcif: Wcif,
  checks: Map<string, CheckRecord>,
): AbsenteeSummary[] {
  const byRegistrant = new Map<number, AbsenteeSummary>();

  for (const [id, record] of checks) {
    if (record.status !== "absent") continue;
    const parsed = parseCheckDocId(id);
    if (!parsed) continue;

    const person = wcif.persons.find((p) => p.registrantId === parsed.registrantId);
    if (!person) continue;

    const groupName = activityById(wcif, parsed.activityId)?.name ?? "Unknown group";
    let summary = byRegistrant.get(parsed.registrantId);
    if (!summary) {
      summary = { person, missed: [] };
      byRegistrant.set(parsed.registrantId, summary);
    }
    summary.missed.push({ groupName, note: record.note });
  }

  const result = [...byRegistrant.values()];
  for (const summary of result) {
    summary.missed.sort((a, b) => a.groupName.localeCompare(b.groupName));
  }
  result.sort((a, b) => a.person.name.localeCompare(b.person.name));
  return result;
}

/**
 * Attach a rate to each tally and rank worst-first: by rate descending (so the
 * bars, which are sized by rate, read top-to-bottom worst), then by raw count,
 * then label for stable ordering. `total === 0` yields a rate of 0.
 */
function rankedCounts(entries: { label: string; count: number; total: number }[]): AbsenceCount[] {
  return entries
    .map((e) => ({ ...e, rate: e.total > 0 ? e.count / e.total : 0 }))
    .sort((a, b) => b.rate - a.rate || b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * How many of their *already-started* groups a person is currently marked absent
 * for, over how many such groups they're assigned to, worst first.
 */
export function absencesByPerson(
  wcif: Wcif,
  checks: Map<string, CheckRecord>,
  now: Date = new Date(),
): AbsenceCount[] {
  const started = startedActivityIds(wcif, now);
  const counts = new Map<number, number>();
  for (const [id, record] of checks) {
    if (record.status !== "absent") continue;
    const parsed = parseCheckDocId(id);
    if (!parsed || !started.has(parsed.activityId)) continue;
    if (!wcif.persons.some((p) => p.registrantId === parsed.registrantId)) continue;
    counts.set(parsed.registrantId, (counts.get(parsed.registrantId) ?? 0) + 1);
  }

  const entries = [...counts.entries()].map(([registrantId, count]) => {
    const person = wcif.persons.find((p) => p.registrantId === registrantId)!;
    const total = person.assignments.filter(
      (a) => isStaffCode(a.assignmentCode) && started.has(a.activityId),
    ).length;
    return { label: person.name, count, total };
  });
  return rankedCounts(entries);
}

/** Build a lookup from group activity id to its clean "round · Group N" label. */
function groupLabels(wcif: Wcif): Map<number, string> {
  const map = new Map<number, string>();
  for (const stage of listStages(wcif)) {
    for (const group of groupsForRoom(wcif, stage.id)) {
      map.set(group.activity.id, group.label);
    }
  }
  return map;
}

/**
 * How many of each group's staff are currently marked absent, worst first, with
 * clean labels. The rate is absences over the group's total assigned staff.
 */
export function absencesByGroup(
  wcif: Wcif,
  checks: Map<string, CheckRecord>,
  now: Date = new Date(),
): AbsenceCount[] {
  const started = startedActivityIds(wcif, now);
  const labels = groupLabels(wcif);
  const counts = new Map<number, number>();
  for (const [id, record] of checks) {
    if (record.status !== "absent") continue;
    const parsed = parseCheckDocId(id);
    if (!parsed || !started.has(parsed.activityId)) continue;
    counts.set(parsed.activityId, (counts.get(parsed.activityId) ?? 0) + 1);
  }

  const entries = [...counts.entries()].map(([activityId, count]) => {
    const label =
      labels.get(activityId) ?? activityById(wcif, activityId)?.name ?? "Unknown group";
    return { label, count, total: staffForGroup(wcif, activityId).length };
  });
  return rankedCounts(entries);
}

/**
 * The competition-wide absence rate for the dashboard's summary line: staff
 * checks marked absent over the total staff assignments — both restricted to
 * groups that have already started, so the rate is meaningful mid-competition.
 */
export function overallAbsenceRate(
  wcif: Wcif,
  checks: Map<string, CheckRecord>,
  now: Date = new Date(),
): { absent: number; total: number } {
  const started = startedActivityIds(wcif, now);
  let absent = 0;
  for (const [id, record] of checks) {
    if (record.status !== "absent") continue;
    const parsed = parseCheckDocId(id);
    if (!parsed || !started.has(parsed.activityId)) continue;
    if (!wcif.persons.some((p) => p.registrantId === parsed.registrantId)) continue;
    absent++;
  }

  let total = 0;
  for (const person of wcif.persons) {
    total += person.assignments.filter(
      (a) => isStaffCode(a.assignmentCode) && started.has(a.activityId),
    ).length;
  }
  return { absent, total };
}
