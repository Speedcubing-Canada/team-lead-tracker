import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useWcif } from "../lib/useWcif";
import { useChecks } from "../lib/useChecks";
import {
  absencesByGroup,
  absencesByPerson,
  overallAbsenceRate,
  summarizeAbsentees,
} from "../lib/absentees";
import { AbsenteeBoard } from "../components/AbsenteeBoard";

/** Shame dashboard: everyone currently marked absent across the competition. */
export default function ShameDashboard() {
  const { competitionId } = useParams();
  const { data: wcif, isLoading } = useWcif(competitionId);
  const checks = useChecks(competitionId);

  const { absentees, byPerson, byGroup, overall } = useMemo(() => {
    if (!wcif) {
      return { absentees: [], byPerson: [], byGroup: [], overall: { absent: 0, total: 0 } };
    }
    return {
      absentees: summarizeAbsentees(wcif, checks),
      byPerson: absencesByPerson(wcif, checks),
      byGroup: absencesByGroup(wcif, checks),
      overall: overallAbsenceRate(wcif, checks),
    };
  }, [wcif, checks]);

  if (isLoading) {
    return <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }

  return (
    <AbsenteeBoard absentees={absentees} byPerson={byPerson} byGroup={byGroup} overall={overall} />
  );
}
