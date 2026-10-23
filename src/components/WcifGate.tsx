import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useWcif } from "../lib/useWcif";
import { useChecks } from "../lib/useChecks";
import type { CheckRecord } from "../lib/checks";
import type { Wcif } from "../lib/wca";
import { ErrorNotice } from "./ErrorNotice";

/**
 * Loads the route's competition and its live checks: the skeleton first, then the page,
 * or why it couldn't load.
 */
export function WcifGate({
  skeleton,
  children,
}: {
  skeleton: ReactNode;
  children: (wcif: Wcif, competitionId: string, checks: Map<string, CheckRecord>) => ReactNode;
}) {
  const { competitionId } = useParams();
  const { data: wcif, isLoading, error } = useWcif(competitionId);
  const { checks, error: checksError } = useChecks(competitionId);
  if (isLoading) return skeleton;
  // A failed background refetch keeps the cached WCIF; only a failed first load lands here.
  if (!wcif || !competitionId) {
    return (
      <div className="p-4">
        <ErrorNotice
          title="Couldn't load this competition"
          body={error instanceof Error ? error.message : "Check your connection and try again."}
        />
      </div>
    );
  }
  return (
    <>
      {children(wcif, competitionId, checks)}
      {checksError && (
        <div className="sticky bottom-3 z-30 px-3">
          <ErrorNotice
            title="Live marks stopped"
            body="Marks from other leads aren't syncing. Reopen the competition from the list."
          />
        </div>
      )}
    </>
  );
}
