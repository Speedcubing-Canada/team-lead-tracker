import type { Wcif, WcifPerson } from "./wca";
import { activityById } from "./wcif";
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
