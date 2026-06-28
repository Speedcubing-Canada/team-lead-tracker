import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useWcif } from "../lib/useWcif";
import { useChecks } from "../lib/useChecks";
import { writeNote, writeStatus } from "../lib/checks";
import { StageBoard, type StageBoardHandlers } from "../components/StageBoard";
import { StageBoardSkeleton } from "../components/Skeleton";

/**
 * Stage view (landing): loads the competition's WCIF, subscribes to live checks,
 * and lets the lead mark each staffer present/absent with a note.
 */
export default function StageView() {
  const { competitionId } = useParams();
  const { user } = useAuth();
  const { data: wcif, isLoading, isError, error } = useWcif(competitionId);
  const checks = useChecks(competitionId);

  const handlers = useMemo<StageBoardHandlers>(
    () => ({
      onStatus: (activityId, registrantId, status, note) => {
        if (!competitionId || !user) return;
        void writeStatus(competitionId, activityId, registrantId, status, user, note);
      },
      onNote: (activityId, registrantId, note) => {
        if (!competitionId || !user) return;
        void writeNote(competitionId, activityId, registrantId, note, user);
      },
    }),
    [competitionId, user],
  );

  if (isLoading) {
    return <StageBoardSkeleton />;
  }
  if (isError || !wcif) {
    return (
      <p className="p-6 text-center text-sm text-red-600 dark:text-red-400">
        {error instanceof Error ? error.message : "Could not load this competition."}
      </p>
    );
  }

  return (
    <StageBoard
      wcif={wcif}
      wcaUserId={user?.wcaUserId}
      competitionId={competitionId}
      checks={checks}
      handlers={handlers}
    />
  );
}
