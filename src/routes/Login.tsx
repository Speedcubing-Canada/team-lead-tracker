/**
 * Login screen. Phase 0 placeholder — the WCA OAuth button and competition
 * selection are wired up in Phase 1.
 */
export default function Login() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team Lead Tracker</h1>
        <p className="mt-2 text-sm text-slate-500">
          Keep track of your stage team at a WCA championship.
        </p>
      </div>
      <button
        type="button"
        disabled
        className="min-h-12 w-full max-w-xs rounded-xl bg-indigo-600 px-4 font-semibold text-white opacity-50"
      >
        Log in with WCA (coming soon)
      </button>
    </div>
  );
}
