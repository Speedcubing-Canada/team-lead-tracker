import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useWcif } from "../lib/useWcif";
import { useChecks } from "../lib/useChecks";
import { writeNote, writeStatus } from "../lib/checks";
import { StageBoard, type StageBoardHandlers } from "../components/StageBoard";
import { StageBoardSkeleton } from "../components/Skeleton";
import { ErrorNotice } from "../components/ErrorNotice";

/**
 * Stage view (landing): loads the competition's WCIF, subscribes to live checks,
 * and lets the lead mark each staffer present/absent with a note.
 */
export default function StageView() {
  const { competitionId } = useParams();
  const { user } = useAuth();
  const { data: wcif, isLoading, error } = useWcif(competitionId);
  const checks = useChecks(competitionId);
  const [saveFailed, setSaveFailed] = useState(false);

  const handlers = useMemo<StageBoardHandlers>(() => {
    const save = (write: Promise<void>) =>
      write.then(
        () => setSaveFailed(false),
        () => setSaveFailed(true),
      );
    return {
      onStatus: (activityId, registrantId, status, note) => {
        if (!competitionId || !user) return;
        void save(writeStatus(competitionId, activityId, registrantId, status, user, note));
      },
      onNote: (activityId, registrantId, note) => {
        if (!competitionId || !user) return;
        void save(writeNote(competitionId, activityId, registrantId, note, user));
      },
    };
  }, [competitionId, user]);

  if (isLoading) {
    return <StageBoardSkeleton />;
  }
  // A failed background refetch keeps the cached WCIF; only a first load can fail here.
  if (!wcif) {
    return (
      <p className="p-6 text-center text-sm text-red-600 dark:text-red-400">
        {error instanceof Error ? error.message : "Could not load this competition."}
      </p>
    );
  }

  return (
    <>
      <StageBoard
        wcif={wcif}
        wcaUserId={user?.wcaUserId}
        competitionId={competitionId}
        checks={checks}
        handlers={handlers}
      />
      {saveFailed && (
        // Above the bottom tab bar, where the lead's thumb already is.
        <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30">
          <ErrorNotice
            title="Not saved"
            body="Your last change didn't reach the server. Try again, or reopen the competition from the list."
          />
        </div>
      )}
    </>
  );
}
