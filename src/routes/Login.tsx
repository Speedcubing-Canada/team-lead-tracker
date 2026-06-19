import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { auth } from "../lib/firebase";
import { grantCompetitionAccess } from "../lib/authApi";
import { loadMyCompetitions } from "../lib/myCompetitions";
import { hasCheckData, recentlyEndedComps, upcomingComps } from "../lib/recentComps";
import type { MyCompetition } from "../lib/wca";
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
  const queryClient = useQueryClient();
  const [competitions] = useState(() => loadMyCompetitions());
  const upcoming = upcomingComps(competitions);
  const [manual, setManual] = useState(false);
  const [competitionId, setCompetitionId] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<MyCompetition[]>([]);

  // Recently-ended comps the lead still tracked: those with check data. Resolved
  // after sign-in (the data check needs an authenticated Firestore read).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const candidates = recentlyEndedComps(competitions);
      const withData = await Promise.all(candidates.map((c) => hasCheckData(c.id)));
      if (!cancelled) setRecent(candidates.filter((_, i) => withData[i]));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, competitions]);

  if (loading) {
    return <p className="flex h-full items-center justify-center text-sm text-slate-500">Loading…</p>;
  }

  async function open(id: string, subpath = "") {
    const competitionId = id.trim();
    if (!competitionId) return;
    setPendingId(competitionId);
    setError(null);
    try {
      const { wcif } = await grantCompetitionAccess(competitionId);
      // Seed the cache with the WCIF the function already fetched, so StageView
      // renders without re-downloading it (within the query's staleTime).
      queryClient.setQueryData(["wcif", competitionId], wcif);
      // Pull the freshly-set comps/privilegedComps claims into the active ID
      // token so Storage rules (which read the token) authorize this session.
      await auth().currentUser?.getIdToken(true);
      navigate(`/c/${encodeURIComponent(competitionId)}${subpath}`);
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

        {upcoming.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {upcoming.map((c) => (
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

        {recent.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recently ended
            </h2>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Export who's eligible for reimbursement.
            </p>
            <ul className="flex flex-col gap-2">
              {recent.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void open(c.id, "/reimbursement")}
                    disabled={pendingId !== null}
                    className="flex min-h-16 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <span>
                      <span className="block font-semibold text-slate-900 dark:text-slate-100">
                        {c.name}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {formatRange(c.startDate, c.endDate)}
                      </span>
                    </span>
                    {pendingId === c.id ? (
                      <span className="text-xs text-slate-400 dark:text-slate-500">Opening…</span>
                    ) : (
                      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        Export →
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
