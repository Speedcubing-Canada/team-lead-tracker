import type { Wcif, WcifPerson } from "./wca";
import { activityById, groupsForRoom, listStages } from "./wcif";
import { parseCheckDocId, type CheckRecord } from "./checks";

export interface MissedGroup {
  groupName: string;
  note: string;
}

export interface AbsenteeSummary {
  person: WcifPerson;
  missed: MissedGroup[];
}

/** A labeled tally, used to drive the shame-page bar charts. */
export interface AbsenceCount {
  label: string;
  count: number;
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

/** A tally sorted by count descending, then label ascending for stable ordering. */
function rankedCounts(counts: Map<string, number>): AbsenceCount[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** How many groups each person is currently marked absent for, worst first. */
export function absencesByPerson(wcif: Wcif, checks: Map<string, CheckRecord>): AbsenceCount[] {
  const counts = new Map<string, number>();
  for (const [id, record] of checks) {
    if (record.status !== "absent") continue;
    const parsed = parseCheckDocId(id);
    if (!parsed) continue;
    const person = wcif.persons.find((p) => p.registrantId === parsed.registrantId);
    if (!person) continue;
    counts.set(person.name, (counts.get(person.name) ?? 0) + 1);
  }
  return rankedCounts(counts);
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

/** How many absences each group has accumulated, worst first, with clean labels. */
export function absencesByGroup(wcif: Wcif, checks: Map<string, CheckRecord>): AbsenceCount[] {
  const labels = groupLabels(wcif);
  const counts = new Map<string, number>();
  for (const [id, record] of checks) {
    if (record.status !== "absent") continue;
    const parsed = parseCheckDocId(id);
    if (!parsed) continue;
    const label =
      labels.get(parsed.activityId) ??
      activityById(wcif, parsed.activityId)?.name ??
      "Unknown group";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return rankedCounts(counts);
}
