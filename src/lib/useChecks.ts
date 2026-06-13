import { useEffect, useState } from "react";
import { subscribeToChecks, type CheckRecord } from "./checks";

/** Live map of a competition's checks (keyed by check id), synced across leads. */
export function useChecks(competitionId: string | undefined): Map<string, CheckRecord> {
  const [checks, setChecks] = useState<Map<string, CheckRecord>>(new Map());

  useEffect(() => {
    if (!competitionId) {
      setChecks(new Map());
      return;
    }
    const unsubscribe = subscribeToChecks(competitionId, setChecks);
    return () => unsubscribe();
  }, [competitionId]);

  return checks;
}
