import type { Wcif, WcifPerson } from "./wca";
import { activityById, groupsForRoom, listDays, listStages, roomIdForActivity } from "./wcif";
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
 * absences, `total` the denominator they're measured against — the number of
 * *marked* duties (present + absent); duties nobody has ticked yes/no yet are
 * excluded so they can't pose as "showed up". `rate` = count / total (0 when 0).
 */
export interface AbsenceCount {
  label: string;
  count: number;
  total: number;
  rate: number; // count / total — the % shown in the bar chart
  score: number; // Wilson lower bound — what the list is sorted by
}

/** Optional scope for the dashboard selectors: a single stage and/or a single day. */
interface Scope {
  /** Restrict to one stage (room id); omit/null for the whole competition. */
  roomId?: number | null;
  /** Restrict to one calendar day (YYYY-MM-DD); omit/null for every day. */
  date?: string | null;
}

/**
 * Ids of the group activities that have already started by `now`, optionally
 * narrowed to one stage and/or one day. Rates are measured against started
 * groups only — counting groups that haven't happened yet would drown every
 * rate in a huge denominator (e.g. 0/54 at the start of the comp).
 */
function startedActivityIds(wcif: Wcif, now: Date, scope: Scope = {}): Set<number> {
  const started = new Set<number>();
  const nowMs = now.getTime();
  for (const stage of listStages(wcif)) {
    if (scope.roomId != null && stage.id !== scope.roomId) continue;
    for (const group of groupsForRoom(wcif, stage.id)) {
      if (scope.date != null && group.date !== scope.date) continue;
      if (new Date(group.activity.startTime).getTime() <= nowMs) {
        started.add(group.activity.id);
      }
    }
  }
  return started;
}

/**
 * A check that lands on a started, in-scope group and a real registrant — i.e. a
 * genuinely *marked* duty. Yields both present and absent so callers can use the
 * full marked set as the denominator and the absent subset as the numerator.
 */
function* markedChecks(
  wcif: Wcif,
  checks: Map<string, CheckRecord>,
  started: Set<number>,
): Iterable<{ activityId: number; registrantId: number; record: CheckRecord }> {
  for (const [id, record] of checks) {
    const parsed = parseCheckDocId(id);
    if (!parsed || !started.has(parsed.activityId)) continue;
    if (!wcif.persons.some((p) => p.registrantId === parsed.registrantId)) continue;
    yield { activityId: parsed.activityId, registrantId: parsed.registrantId, record };
  }
}

/**
 * Aggregate everyone currently marked absent across the competition, grouped by
 * person, with the groups they missed and any notes. People are sorted by name,
 * and each person's missed groups by group name.
 */
export function summarizeAbsentees(
  wcif: Wcif,
  checks: Map<string, CheckRecord>,
  roomId?: number | null,
): AbsenteeSummary[] {
  const byRegistrant = new Map<number, AbsenteeSummary>();
  const labels = groupLabels(wcif);

  for (const [id, record] of checks) {
    if (record.status !== "absent") continue;
    const parsed = parseCheckDocId(id);
    if (!parsed) continue;
    if (roomId != null && roomIdForActivity(wcif, parsed.activityId) !== roomId) continue;

    const person = wcif.persons.find((p) => p.registrantId === parsed.registrantId);
    if (!person) continue;

    const groupName =
      labels.get(parsed.activityId) ?? activityById(wcif, parsed.activityId)?.name ?? "Unknown group";
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

/** z for the Wilson interval. 1.96 = 95% confidence: discounts small samples
 *  hard enough that a well-sampled 8/10 outranks a perfect-but-tiny 3/3, while a
 *  lone 1/1 sinks well down the board. */
const WILSON_Z = 1.96;

/**
 * Lower bound of the Wilson score interval for `count` "successes" out of
 * `total`. Used as the ranking key so sample size, not just rate, drives the
 * order: a lone 1/1 carries little confidence and sinks below a well-sampled
 * 8/10, while a low-rate/high-volume tally (2/200) stays near the bottom.
 * Returns 0 when total is 0. See "How Not To Sort By Average Rating".
 */
export function wilsonLowerBound(count: number, total: number, z = WILSON_Z): number {
  if (total <= 0) return 0;
  const p = count / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const centre = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  return (centre - margin) / denom;
}

/**
 * Attach a rate and ranking score to each tally and rank worst-first. The score
 * is the Wilson lower bound, so small samples don't dominate the way a raw rate
 * sort lets a 1/1 sit above an 8/10; `rate` is kept untouched for display. Ties
 * fall back to raw count then label for stable ordering. `total === 0` yields a
 * rate and score of 0.
 */
function rankedCounts(entries: { label: string; count: number; total: number }[]): AbsenceCount[] {
  return entries
    .map((e) => ({
      ...e,
      rate: e.total > 0 ? e.count / e.total : 0,
      score: wilsonLowerBound(e.count, e.total),
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * How many of their *already-started* groups a person is currently marked absent
 * for, over how many such duties they've actually been marked on (present or
 * absent), worst first. Optionally scoped to a single stage.
 */
export function absencesByPerson(
  wcif: Wcif,
  checks: Map<string, CheckRecord>,
  now: Date = new Date(),
  roomId?: number | null,
): AbsenceCount[] {
  const started = startedActivityIds(wcif, now, { roomId });
  const tally = new Map<number, { absent: number; total: number }>();
  for (const { registrantId, record } of markedChecks(wcif, checks, started)) {
    const t = tally.get(registrantId) ?? { absent: 0, total: 0 };
    t.total += 1;
    if (record.status === "absent") t.absent += 1;
    tally.set(registrantId, t);
  }

  const entries = [...tally.entries()]
    .filter(([, t]) => t.absent > 0)
    .map(([registrantId, t]) => {
      const person = wcif.persons.find((p) => p.registrantId === registrantId)!;
      return { label: person.name, count: t.absent, total: t.total };
    });
  return rankedCounts(entries);
}

/** Build a lookup from group activity id to its compact "OH R1 · G1" label. */
function groupLabels(wcif: Wcif): Map<number, string> {
  const map = new Map<number, string>();
  for (const stage of listStages(wcif)) {
    for (const group of groupsForRoom(wcif, stage.id)) {
      map.set(group.activity.id, group.shortLabel);
    }
  }
  return map;
}

/**
 * How many of each group's staff are currently marked absent, worst first, with
 * clean labels. The rate is absences over the group's *marked* duties (present +
 * absent). Optionally scoped to a single stage.
 */
export function absencesByGroup(
  wcif: Wcif,
  checks: Map<string, CheckRecord>,
  now: Date = new Date(),
  roomId?: number | null,
): AbsenceCount[] {
  const started = startedActivityIds(wcif, now, { roomId });
  const labels = groupLabels(wcif);
  const tally = new Map<number, { absent: number; total: number }>();
  for (const { activityId, record } of markedChecks(wcif, checks, started)) {
    const t = tally.get(activityId) ?? { absent: 0, total: 0 };
    t.total += 1;
    if (record.status === "absent") t.absent += 1;
    tally.set(activityId, t);
  }

  const entries = [...tally.entries()]
    .filter(([, t]) => t.absent > 0)
    .map(([activityId, t]) => {
      const label =
        labels.get(activityId) ?? activityById(wcif, activityId)?.name ?? "Unknown group";
      return { label, count: t.absent, total: t.total };
    });
  return rankedCounts(entries);
}

/**
 * The absence rate for the dashboard's summary line: staff duties marked absent
 * over the duties actually *marked* (present + absent) — both restricted to
 * already-started groups, so the rate is meaningful mid-competition. Unmarked
 * duties are excluded so they can't quietly pad the denominator as if filled.
 * Optionally scoped to a single stage.
 */
export function overallAbsenceRate(
  wcif: Wcif,
  checks: Map<string, CheckRecord>,
  now: Date = new Date(),
  roomId?: number | null,
): { absent: number; total: number } {
  const started = startedActivityIds(wcif, now, { roomId });
  let absent = 0;
  let total = 0;
  for (const { record } of markedChecks(wcif, checks, started)) {
    total += 1;
    if (record.status === "absent") absent += 1;
  }
  return { absent, total };
}

/**
 * Per-stage absence rates for a single day, so a team can compare itself against
 * the other stages. Scoped to one day because staff rotate stages day to day —
 * pooling days would blend different teams into the same bar. Stages with any
 * marked duty appear (a clean stage shows at 0%); worst rate first.
 */
export function absencesByStage(
  wcif: Wcif,
  checks: Map<string, CheckRecord>,
  date: string,
  now: Date = new Date(),
): AbsenceCount[] {
  const started = startedActivityIds(wcif, now, { date });
  const names = new Map(listStages(wcif).map((s) => [s.id, s.name]));
  const tally = new Map<number, { absent: number; total: number }>();
  for (const { activityId, record } of markedChecks(wcif, checks, started)) {
    const roomId = roomIdForActivity(wcif, activityId);
    if (roomId == null) continue;
    const t = tally.get(roomId) ?? { absent: 0, total: 0 };
    t.total += 1;
    if (record.status === "absent") t.absent += 1;
    tally.set(roomId, t);
  }

  const entries = [...tally.entries()].map(([roomId, t]) => ({
    label: names.get(roomId) ?? "Unknown stage",
    count: t.absent,
    total: t.total,
  }));
  return rankedCounts(entries);
}

/**
 * The day (YYYY-MM-DD) the dashboard's stage comparison should default to: the
 * latest scheduled day that has a group already underway, falling back to the
 * first scheduled day before the comp begins (null only when there's no schedule).
 */
export function currentCompetitionDay(wcif: Wcif, now: Date = new Date()): string | null {
  const days = listDays(wcif);
  if (days.length === 0) return null;
  const nowMs = now.getTime();
  const startedDates = new Set<string>();
  for (const stage of listStages(wcif)) {
    for (const group of groupsForRoom(wcif, stage.id)) {
      if (new Date(group.activity.startTime).getTime() <= nowMs) startedDates.add(group.date);
    }
  }
  const started = [...startedDates].sort();
  return started.length > 0 ? started[started.length - 1] : days[0];
}
