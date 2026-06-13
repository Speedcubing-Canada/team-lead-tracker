import { useEffect, useRef, useState } from "react";
import { toggleStatus, type CheckRecord, type CheckStatus } from "../lib/checks";

interface StaffRowProps {
  name: string;
  detail: string;
  check?: CheckRecord;
  onStatus: (status: CheckStatus | null) => void;
  onNote: (note: string) => void;
}

/** A single staffer: name + assignment, a present/absent toggle, and an optional note. */
export function StaffRow({ name, detail, check, onStatus, onNote }: StaffRowProps) {
  const status = check?.status ?? null;

  // Local note state, kept in sync with remote unless this lead is editing.
  const [note, setNote] = useState(check?.note ?? "");
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setNote(check?.note ?? "");
  }, [check?.note]);

  function commitNote() {
    editing.current = false;
    if (note !== (check?.note ?? "")) onNote(note);
  }

  return (
    <li className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-sm text-slate-900">{name}</span>
          <span className="block text-xs text-slate-500">{detail}</span>
        </span>
        <span className="flex shrink-0 overflow-hidden rounded-lg border border-slate-300">
          <StatusButton
            label="Present"
            active={status === "present"}
            activeClass="bg-green-600 text-white"
            onClick={() => onStatus(toggleStatus(status, "present"))}
          />
          <StatusButton
            label="Absent"
            active={status === "absent"}
            activeClass="bg-red-600 text-white"
            onClick={() => onStatus(toggleStatus(status, "absent"))}
          />
        </span>
      </div>

      {(status !== null || note) && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onFocus={() => (editing.current = true)}
          onBlur={commitNote}
          placeholder="Add a note (e.g. left early, swapped)…"
          className="mt-2 min-h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
        />
      )}
    </li>
  );
}

function StatusButton({
  label,
  active,
  activeClass,
  onClick,
}: {
  label: string;
  active: boolean;
  activeClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 min-w-16 px-3 text-sm font-medium ${
        active ? activeClass : "bg-white text-slate-600"
      }`}
    >
      {label}
    </button>
  );
}
