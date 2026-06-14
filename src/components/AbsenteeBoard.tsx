import type { AbsenceCount, AbsenteeSummary } from "../lib/absentees";
import { BarChart } from "./BarChart";
import { PersonNameButton } from "./PersonNameButton";

/** Presentational shame board: charts of who/where, then the per-person breakdown. */
export function AbsenteeBoard({
  absentees,
  byPerson = [],
  byGroup = [],
  byStage = [],
  overall = { absent: 0, total: 0 },
}: {
  absentees: AbsenteeSummary[];
  byPerson?: AbsenceCount[];
  byGroup?: AbsenceCount[];
  byStage?: AbsenceCount[];
  overall?: { absent: number; total: number };
}) {
  const overallPct = overall.total > 0 ? Math.round((overall.absent / overall.total) * 100) : 0;

  // Per-stage comparison is meaningful even when nobody is absent (clean stages
  // show at 0%), so it renders in both the empty and populated states.
  const stageChart = byStage.length > 0 && <BarChart title="Absences per stage" data={byStage} />;

  if (absentees.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="p-4 text-center">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Everyone's on it 🎉</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No one is marked absent right now.</p>
        </div>
        {stageChart}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        {absentees.length} {absentees.length === 1 ? "person" : "people"} not doing their assignment
        {overall.total > 0 && (
          <span className="font-normal text-slate-400 dark:text-slate-500">
            {" · "}
            <span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">
              {overallPct}%
            </span>{" "}
            of marked duties unfilled
          </span>
        )}
      </h2>
      {stageChart}
      <BarChart title="Most forgotten" data={byPerson} />
      <BarChart title="Absences per group" data={byGroup} />
      <ul className="flex flex-col gap-3">
        {absentees.map(({ person, missed }) => (
          <li key={person.registrantId} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-baseline justify-between">
              <PersonNameButton
                person={person}
                className="font-semibold text-slate-900 dark:text-slate-100"
              />
              <span className="text-xs text-red-600 dark:text-red-400">
                {missed.length} {missed.length === 1 ? "group" : "groups"}
              </span>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {missed.map((m, i) => (
                <li key={i} className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="text-slate-900 dark:text-slate-100">{m.groupName}</span>
                  {m.note && <span className="text-slate-500 dark:text-slate-400"> — {m.note}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
