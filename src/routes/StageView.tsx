import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useWcif } from "../lib/useWcif";
import { StageBoard } from "../components/StageBoard";

/**
 * Stage view (landing): loads the competition's WCIF and shows the lead's stage.
 * Present/absent toggles arrive in Phase 3.
 */
export default function StageView() {
  const { competitionId } = useParams();
  const { user } = useAuth();
  const { data: wcif, isLoading, isError, error } = useWcif(competitionId);

  if (isLoading) {
    return <p className="p-6 text-center text-sm text-slate-500">Loading competition…</p>;
  }
  if (isError || !wcif) {
    return (
      <p className="p-6 text-center text-sm text-red-600">
        {error instanceof Error ? error.message : "Could not load this competition."}
      </p>
    );
  }

  return <StageBoard wcif={wcif} wcaUserId={user?.wcaUserId} />;
}
