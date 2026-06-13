import { useEffect, useRef, useState } from "react";
import { toggleStatus, type CheckRecord, type CheckStatus } from "../lib/checks";

interface StaffRowProps {
  name: string;
  station: number | null;
  check?: CheckRecord;
  onStatus: (status: CheckStatus | null) => void;
  onNote: (note: string) => void;
}

/**
 * A single staffer. The name gets the whole left column (names can be long) and
 * the controls are compact icon buttons on the right: present (✓), absent (✕),
 * and a note toggle (💬) that stays out of the way until tapped.
 */
export function StaffRow({ name, station, check, onStatus, onNote }: StaffRowProps) {
  const status = check?.status ?? null;

  // Local note state, kept in sync with remote unless this lead is editing.
  const [note, setNote] = useState(check?.note ?? "");
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setNote(check?.note ?? "");
  }, [check?.note]);

  // Notes are opt-in: hidden until tapped, but always shown if a note exists.
  const [showNote, setShowNote] = useState(Boolean(check?.note));
  useEffect(() => {
    if (check?.note) setShowNote(true);
  }, [check?.note]);

  function commitNote() {
    editing.current = false;
    if (note !== (check?.note ?? "")) onNote(note);
  }

  return (
    <li className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm text-slate-900 dark:text-slate-100">{name}</span>
          {station != null && <span className="text-xs text-slate-500 dark:text-slate-400">Station {station}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <IconButton
            label="Present"
            active={status === "present"}
            activeClass="border-green-600 bg-green-600 text-white"
            onClick={() => onStatus(toggleStatus(status, "present"))}
          >
            ✓
          </IconButton>
          <IconButton
            label="Absent"
            active={status === "absent"}
            activeClass="border-red-600 bg-red-600 text-white"
            onClick={() => onStatus(toggleStatus(status, "absent"))}
          >
            ✕
          </IconButton>
          <IconButton
            label="Add note"
            active={showNote || Boolean(note)}
            activeClass="border-slate-400 bg-white text-slate-700 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-300"
            onClick={() => setShowNote((v) => !v)}
          >
            💬
          </IconButton>
        </span>
      </div>

      {showNote && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onFocus={() => (editing.current = true)}
          onBlur={commitNote}
          placeholder="Add a note (e.g. left early, swapped)…"
          className="mt-2 min-h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      )}
    </li>
  );
}

function IconButton({
  label,
  active,
  activeClass,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  activeClass: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-lg border text-base font-semibold ${
        active ? activeClass : "border-slate-300 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      {children}
    </button>
  );
}
