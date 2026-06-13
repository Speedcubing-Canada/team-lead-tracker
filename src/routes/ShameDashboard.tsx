import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useWcif } from "../lib/useWcif";
import { useChecks } from "../lib/useChecks";
import { absencesByGroup, absencesByPerson, summarizeAbsentees } from "../lib/absentees";
import { AbsenteeBoard } from "../components/AbsenteeBoard";

/** Shame dashboard: everyone currently marked absent across the competition. */
export default function ShameDashboard() {
  const { competitionId } = useParams();
  const { data: wcif, isLoading } = useWcif(competitionId);
  const checks = useChecks(competitionId);

  const { absentees, byPerson, byGroup } = useMemo(() => {
    if (!wcif) return { absentees: [], byPerson: [], byGroup: [] };
    return {
      absentees: summarizeAbsentees(wcif, checks),
      byPerson: absencesByPerson(wcif, checks),
      byGroup: absencesByGroup(wcif, checks),
    };
  }, [wcif, checks]);

  if (isLoading) {
    return <p className="p-6 text-center text-sm text-slate-500">Loading…</p>;
  }

  return <AbsenteeBoard absentees={absentees} byPerson={byPerson} byGroup={byGroup} />;
}
