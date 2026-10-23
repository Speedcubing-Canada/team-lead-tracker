import { useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useChecks } from "../lib/useChecks";
import { writeNote, writeStatus } from "../lib/checks";
import { StageBoard, type StageBoardHandlers } from "../components/StageBoard";
import { StageBoardSkeleton } from "../components/Skeleton";
import { ErrorNotice } from "../components/ErrorNotice";
import { WcifGate } from "../components/WcifGate";
import type { Wcif } from "../lib/wca";

/**
 * Stage view (landing): loads the competition's WCIF, subscribes to live checks,
 * and lets the lead mark each staffer present/absent with a note.
 */
export default function StageView() {
  return (
    <WcifGate skeleton={<StageBoardSkeleton />}>
      {(wcif, competitionId) => <StageViewBody wcif={wcif} competitionId={competitionId} />}
    </WcifGate>
  );
}

function StageViewBody({ wcif, competitionId }: { wcif: Wcif; competitionId: string }) {
  const { user } = useAuth();
  const checks = useChecks(competitionId);
  const [saveFailed, setSaveFailed] = useState(false);
  const writeSeq = useRef(0);
  const lastFailedSeq = useRef(0);

  const handlers = useMemo<StageBoardHandlers>(() => {
    const save = (write: Promise<void>) => {
      const seq = ++writeSeq.current;
      return write.then(
        // A slow earlier write succeeding doesn't mean a later failed one went through.
        () => seq > lastFailedSeq.current && setSaveFailed(false),
        () => {
          lastFailedSeq.current = seq;
          setSaveFailed(true);
        },
      );
    };
    return {
      onStatus: (activityId, registrantId, status, note) => {
        if (!user) return;
        void save(writeStatus(competitionId, activityId, registrantId, status, user, note));
      },
      onNote: (activityId, registrantId, note) => {
        if (!user) return;
        void save(writeNote(competitionId, activityId, registrantId, note, user));
      },
    };
  }, [competitionId, user]);

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
