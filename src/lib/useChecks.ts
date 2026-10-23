import { useEffect, useState } from "react";
import { subscribeToChecks, type CheckRecord } from "./checks";

/** Live map of a competition's checks (keyed by check id), synced across leads. */
export function useChecks(competitionId: string | undefined): {
  checks: Map<string, CheckRecord>;
  error: Error | null;
} {
  const [checks, setChecks] = useState<Map<string, CheckRecord>>(new Map());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setError(null);
    if (!competitionId) {
      setChecks(new Map());
      return;
    }
    const unsubscribe = subscribeToChecks(
      competitionId,
      (next) => {
        setChecks(next);
        setError(null);
      },
      setError,
    );
    return () => unsubscribe();
  }, [competitionId]);

  return { checks, error };
}
