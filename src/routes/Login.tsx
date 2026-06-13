import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { grantCompetitionAccess } from "../lib/authApi";

/**
 * Login + competition entry. Logged out: a WCA OAuth button. Logged in: pick a
 * competition; the Cloud Function verifies the user's role before granting access.
 */
export default function Login() {
  const { user, loading, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [competitionId, setCompetitionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <p className="flex h-full items-center justify-center text-sm text-slate-500">Loading…</p>;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const id = competitionId.trim();
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      await grantCompetitionAccess(id);
      navigate(`/c/${encodeURIComponent(id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this competition.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team Lead Tracker</h1>
        <p className="mt-2 text-sm text-slate-500">
          Keep track of your stage team at a WCA championship.
        </p>
      </div>

      {!user ? (
        <button
          type="button"
          onClick={signIn}
          className="min-h-12 w-full max-w-xs rounded-xl bg-indigo-600 px-4 font-semibold text-white"
        >
          Log in with WCA
        </button>
      ) : (
        <form onSubmit={onSubmit} className="flex w-full max-w-xs flex-col gap-3">
          <p className="text-sm text-slate-600">
            Signed in as <span className="font-semibold">{user.name}</span>
          </p>
          <input
            value={competitionId}
            onChange={(e) => setCompetitionId(e.target.value)}
            placeholder="Competition ID (e.g. WC2025)"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-base"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !competitionId.trim()}
            className="min-h-12 rounded-xl bg-indigo-600 px-4 font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Checking access…" : "Open competition"}
          </button>
          <button type="button" onClick={signOut} className="min-h-10 text-sm text-slate-500">
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}
