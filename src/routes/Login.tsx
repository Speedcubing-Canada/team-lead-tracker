import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { auth } from "../lib/firebase";
import { grantCompetitionAccess } from "../lib/authApi";
import { loadMyCompetitions } from "../lib/myCompetitions";
import { ThemeToggle } from "../components/ThemeToggle";

function formatRange(startDate: string, endDate: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = new Date(`${startDate}T00:00:00`).toLocaleDateString(undefined, opts);
  if (startDate === endDate) return start;
  return `${start} – ${new Date(`${endDate}T00:00:00`).toLocaleDateString(undefined, opts)}`;
}

/**
 * Login + competition entry. Logged out: a WCA OAuth button. Logged in: a
 * one-tap list of the user's competitions (with manual ID entry as a fallback);
 * the Cloud Function verifies the user's role before granting access.
 */
export default function Login() {
  const { user, loading, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [competitions] = useState(() => loadMyCompetitions());
  const [manual, setManual] = useState(false);
  const [competitionId, setCompetitionId] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <p className="flex h-full items-center justify-center text-sm text-slate-500">Loading…</p>;
  }

  async function open(id: string) {
    const competitionId = id.trim();
    if (!competitionId) return;
    setPendingId(competitionId);
    setError(null);
    try {
      await grantCompetitionAccess(competitionId);
      // Pull the freshly-set comps/privilegedComps claims into the active ID
      // token so Storage rules (which read the token) authorize this session.
      await auth().currentUser?.getIdToken(true);
      navigate(`/c/${encodeURIComponent(competitionId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this competition.");
      setPendingId(null);
    }
  }

  function onManualSubmit(e: FormEvent) {
    e.preventDefault();
    void open(competitionId);
  }

  if (!user) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-center dark:bg-slate-900">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Team Lead Tracker</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Keep track of your stage team at a WCA championship.
          </p>
        </div>
        <button
          type="button"
          onClick={signIn}
          className="min-h-12 w-full max-w-xs rounded-xl bg-indigo-600 px-4 font-semibold text-white"
        >
          Log in with WCA
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Your competitions</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Signed in as {user.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button type="button" onClick={signOut} className="text-sm text-slate-500 dark:text-slate-400">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {competitions.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {competitions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => void open(c.id)}
                  disabled={pendingId !== null}
                  className="flex min-h-16 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
                >
                  <span>
                    <span className="block font-semibold text-slate-900 dark:text-slate-100">{c.name}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {formatRange(c.startDate, c.endDate)}
                    </span>
                  </span>
                  {c.ongoing ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                      Live
                    </span>
                  ) : pendingId === c.id ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500">Checking…</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No upcoming competitions found on your WCA account. Enter a competition ID below.
          </p>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setManual((m) => !m)}
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
          >
            {manual ? "Hide manual entry" : "Enter a competition ID manually"}
          </button>
          {manual && (
            <form onSubmit={onManualSubmit} className="mt-2 flex gap-2">
              <input
                value={competitionId}
                onChange={(e) => setCompetitionId(e.target.value)}
                placeholder="e.g. WC2025"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-base dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={pendingId !== null || !competitionId.trim()}
                className="min-h-12 rounded-xl bg-indigo-600 px-4 font-semibold text-white disabled:opacity-50"
              >
                Open
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
