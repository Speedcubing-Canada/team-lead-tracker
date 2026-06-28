import { useEffect, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { wcaProfileUrl, type WcifPerson } from "../lib/wca";
import type { PersonPhoto } from "../lib/photos";

/**
 * Mobile bottom-sheet showing a staffer's profile so a lead can match a name to
 * a face. Prefers a delegate-uploaded photo over the WCA avatar; the image only
 * mounts here, so the photo is fetched strictly on demand (never preloaded with
 * the staff list). Privileged leads get upload/replace/remove controls.
 */
export function PersonSheet({
  person,
  onClose,
  photo = null,
  photoUrl = null,
  canUpload = false,
  onUpload,
  onRemove,
}: {
  person: WcifPerson;
  onClose: () => void;
  /** Metadata for an uploaded photo, if one exists (drives attribution + Remove). */
  photo?: PersonPhoto | null;
  /** Resolved download URL for the uploaded photo (null if none / still resolving). */
  photoUrl?: string | null;
  canUpload?: boolean;
  onUpload?: (file: File) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const avatarUrl = photoUrl ?? person.avatar?.url ?? person.avatar?.thumbUrl ?? null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file || !onUpload) return;
    setError(null);
    setBusy(true);
    try {
      await onUpload(file);
    } catch (err) {
      console.error("Photo upload failed", err);
      setError(`Upload failed: ${describeError(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!onRemove) return;
    setError(null);
    setBusy(true);
    try {
      await onRemove();
    } catch (err) {
      console.error("Photo removal failed", err);
      setError(`Couldn't remove the photo: ${describeError(err)}`);
    } finally {
      setBusy(false);
    }
  }

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
            {photo && (
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                Photo added by {photo.uploadedByName}
              </p>
            )}
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

        {canUpload && (
          <div className="mt-4 flex flex-col gap-2">
            <label
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white ${
                busy ? "opacity-60" : "cursor-pointer"
              }`}
            >
              {busy ? (
                <>
                  <Loader2 size={16} aria-hidden className="motion-safe:animate-spin" />
                  Working…
                </>
              ) : (
                <>
                  <Upload size={16} aria-hidden />
                  {photo ? "Replace photo" : "Upload photo"}
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={busy}
                onChange={handleFile}
              />
            </label>
            {photo && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-50 text-sm font-semibold text-rose-600 disabled:opacity-60 dark:bg-rose-950 dark:text-rose-400"
              >
                <Trash2 size={16} aria-hidden />
                Remove photo
              </button>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-rose-600 dark:text-rose-400">
                {error}
              </p>
            )}
          </div>
        )}

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

/** Best-effort human-readable string from a thrown value (Firebase errors carry a `code`). */
function describeError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; message?: unknown };
    if (typeof e.code === "string" && e.code) return e.code;
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return String(err);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
