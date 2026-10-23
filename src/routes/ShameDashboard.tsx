import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  absencesByGroup,
  absencesByPerson,
  absencesByStage,
  currentCompetitionDay,
  overallAbsenceRate,
  summarizeAbsentees,
} from "../lib/absentees";
import { listDays, listStages } from "../lib/wcif";
import { initialStageId } from "../lib/selection";
import { AbsenteeBoard } from "../components/AbsenteeBoard";
import { DashboardSkeleton } from "../components/Skeleton";
import { WcifGate } from "../components/WcifGate";
import type { Wcif } from "../lib/wca";
import type { CheckRecord } from "../lib/checks";

type Scope = "team" | "global";

/** Format a YYYY-MM-DD day for the comparison day picker, e.g. "Wed Jul 1". */
function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Shame dashboard. Scopes to the lead's own stage ("My team") or the whole
 * competition ("All stages"); the global view adds a per-day stage comparison so
 * a team can see where it ranks. All rates measure absences over *marked* duties
 * only, so duties nobody has ticked yet don't pose as filled.
 */
export default function ShameDashboard() {
  return (
    <WcifGate skeleton={<DashboardSkeleton />}>
      {(wcif, competitionId, checks) => (
        <Dashboard wcif={wcif} competitionId={competitionId} checks={checks} />
      )}
    </WcifGate>
  );
}

function Dashboard({
  wcif,
  competitionId,
  checks,
}: {
  wcif: Wcif;
  competitionId: string;
  checks: Map<string, CheckRecord>;
}) {
  const { user } = useAuth();

  const [scope, setScope] = useState<Scope>("team");
  const [day, setDay] = useState<string | null>(null);

  const myStageId = useMemo(
    () => initialStageId(wcif, competitionId, user?.wcaUserId),
    [wcif, competitionId, user],
  );

  const myStageName = listStages(wcif).find((s) => s.id === myStageId)?.name;
  const days = listDays(wcif);
  const effectiveDay = day ?? currentCompetitionDay(wcif);

  const { absentees, byPerson, byGroup, byStage, overall } = useMemo(() => {
    const stageId = scope === "team" ? myStageId : null;
    return {
      absentees: summarizeAbsentees(wcif, checks, stageId),
      byPerson: absencesByPerson(wcif, checks, undefined, stageId),
      byGroup: absencesByGroup(wcif, checks, undefined, stageId),
      byStage:
        scope === "global" && effectiveDay ? absencesByStage(wcif, checks, effectiveDay) : [],
      overall: overallAbsenceRate(wcif, checks, undefined, stageId),
    };
  }, [wcif, checks, scope, myStageId, effectiveDay]);

  const tab = (value: Scope, label: string) => (
    <button
      type="button"
      onClick={() => setScope(value)}
      aria-pressed={scope === value}
      className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors ${
        scope === value
          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
          : "text-slate-500 dark:text-slate-400"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2 p-4 pb-0">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {tab("team", myStageName ? `My team · ${myStageName}` : "My team")}
          {tab("global", "All stages")}
        </div>
        {scope === "global" && days.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="shrink-0">Compare on</span>
            <select
              aria-label="Comparison day"
              className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={effectiveDay ?? ""}
              onChange={(e) => setDay(e.target.value)}
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <AbsenteeBoard
        absentees={absentees}
        byPerson={byPerson}
        byGroup={byGroup}
        byStage={byStage}
        overall={overall}
      />
    </div>
  );
}
