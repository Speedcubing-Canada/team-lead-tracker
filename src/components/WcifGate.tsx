import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useWcif } from "../lib/useWcif";
import type { Wcif } from "../lib/wca";
import { ErrorNotice } from "./ErrorNotice";

/** Loads the route's competition: its skeleton first, then the page, or why it couldn't load. */
export function WcifGate({
  skeleton,
  children,
}: {
  skeleton: ReactNode;
  children: (wcif: Wcif, competitionId: string) => ReactNode;
}) {
  const { competitionId } = useParams();
  const { data: wcif, isLoading, error } = useWcif(competitionId);
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
  return children(wcif, competitionId);
}
