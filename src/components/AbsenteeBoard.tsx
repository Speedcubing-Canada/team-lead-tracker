import type { AbsenceCount, AbsenteeSummary } from "../lib/absentees";
import { BarChart } from "./BarChart";

/** Presentational shame board: charts of who/where, then the per-person breakdown. */
export function AbsenteeBoard({
  absentees,
  byPerson = [],
  byGroup = [],
}: {
  absentees: AbsenteeSummary[];
  byPerson?: AbsenceCount[];
  byGroup?: AbsenceCount[];
}) {
  if (absentees.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-base font-semibold text-slate-900">Everyone's on it 🎉</p>
        <p className="mt-1 text-sm text-slate-500">No one is marked absent right now.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold text-slate-500">
        {absentees.length} {absentees.length === 1 ? "person" : "people"} not doing their assignment
      </h2>
      <BarChart title="Most forgotten" data={byPerson} />
      <BarChart title="Absences per group" data={byGroup} />
      <ul className="flex flex-col gap-3">
        {absentees.map(({ person, missed }) => (
          <li key={person.registrantId} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-slate-900">{person.name}</span>
              <span className="text-xs text-red-600">
                {missed.length} {missed.length === 1 ? "group" : "groups"}
              </span>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {missed.map((m, i) => (
                <li key={i} className="text-sm text-slate-600">
                  <span className="text-slate-900">{m.groupName}</span>
                  {m.note && <span className="text-slate-500"> — {m.note}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
