import { useEffect } from "react";
import { wcaProfileUrl, type WcifPerson } from "../lib/wca";

/**
 * Mobile bottom-sheet showing a staffer's WCA profile so a lead can match a
 * name to a face. The avatar <img> only mounts here, so the photo is fetched
 * strictly on demand (never preloaded with the staff list).
 */
export function PersonSheet({ person, onClose }: { person: WcifPerson; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const avatarUrl = person.avatar?.url ?? person.avatar?.thumbUrl ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={person.name}
      className="fixed inset-0 z-50 flex flex-col justify-end"
    >
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] dark:bg-slate-800">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />

        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={person.name}
              className="h-20 w-20 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-200 text-2xl font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              {initials(person.name)}
            </div>
          )}
          <div className="min-w-0">
            <p className="break-words text-lg font-semibold text-slate-900 dark:text-slate-100">
              {person.name}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{person.countryIso2}</p>
          </div>
        </div>

        <dl className="mt-4 flex flex-col gap-2 text-sm">
          {person.wcaId && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">WCA ID</dt>
              <dd>
                <a
                  href={wcaProfileUrl(person.wcaId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-600 underline dark:text-indigo-400"
                >
                  {person.wcaId}
                </a>
              </dd>
            </div>
          )}
          {person.registrantId != null && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">WCA Live ID</dt>
              <dd className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {person.registrantId}
              </dd>
            </div>
          )}
        </dl>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-12 w-full rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
