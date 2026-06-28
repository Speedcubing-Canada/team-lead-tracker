import { useEffect, useRef, useState } from "react";
import { Check, MessageSquare, X } from "lucide-react";
import { toggleStatus, type CheckRecord, type CheckStatus } from "../lib/checks";
import type { WcifPerson } from "../lib/wca";
import { PersonNameButton } from "./PersonNameButton";
import { Tooltip } from "./Tooltip";

interface StaffRowProps {
  person: WcifPerson;
  station: number | null;
  check?: CheckRecord;
  onStatus: (status: CheckStatus | null, note?: string) => void;
  onNote: (note: string) => void;
}

/**
 * A single staffer. The name gets the whole left column (names can be long) and
 * the controls are compact icon buttons on the right: present (check), absent (x),
 * and a note toggle (speech bubble) that stays out of the way until tapped.
 */
export function StaffRow({ person, station, check, onStatus, onNote }: StaffRowProps) {
  const status = check?.status ?? null;

  // Local note state, kept in sync with remote unless this lead is editing.
  const [note, setNote] = useState(check?.note ?? "");
  const editing = useRef(false);
  // Set on a status button's pointerdown (which precedes the input's blur) so the
  // ensuing blur skips its own write — the click handler folds the note into the
  // status write instead. This keeps a fresh doc from being created note-only,
  // which Firestore rules reject (a check must carry a present/absent status).
  const statusPress = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing.current) setNote(check?.note ?? "");
  }, [check?.note]);

  // Notes are opt-in: hidden until tapped, but always shown if a note exists.
  const [showNote, setShowNote] = useState(Boolean(check?.note));
  useEffect(() => {
    if (check?.note) setShowNote(true);
  }, [check?.note]);

  // Read the live input value rather than React state: tapping a button blurs the
  // input, but a phone keyboard's final keystroke/autocorrect can reach the DOM
  // after the matching setNote is scheduled, leaving `note` momentarily stale.
  function pendingNote(): string {
    return inputRef.current?.value ?? note;
  }

  function commitNote() {
    editing.current = false;
    // A status button press handles the note itself (atomically with the status).
    if (statusPress.current) return;
    const value = pendingNote();
    // A note can't exist without a present/absent mark, so don't attempt a
    // status-less create — the lead's text stays in the box until they mark one.
    if (status === null) return;
    if (value !== (check?.note ?? "")) onNote(value);
  }

  // Tapping present/absent: if the lead was editing a note, fold it into the same write so a
  // newly created doc carries both status and note. Clearing a status (toggle to
  // null) deletes the doc, so no note rides along.
  function pressStatus(next: CheckStatus | null) {
    const fold = statusPress.current && next !== null;
    statusPress.current = false;
    editing.current = false;
    const value = pendingNote();
    const changedNote = fold && value !== (check?.note ?? "");
    onStatus(next, changedNote ? value : undefined);
  }

  return (
    <li className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        {station != null && (
          <span
            aria-label={`Station ${station}`}
            className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-slate-200 px-1.5 text-sm font-semibold tabular-nums text-slate-700 dark:bg-slate-700 dark:text-slate-200"
          >
            {station}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <PersonNameButton
            person={person}
            className="block break-words text-sm text-slate-900 dark:text-slate-100"
          />
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <IconButton
            label="Present"
            active={status === "present"}
            activeClass="border-green-600 bg-green-600 text-white"
            onPointerDown={() => (statusPress.current = editing.current)}
            onClick={() => pressStatus(toggleStatus(status, "present"))}
          >
            <Check size={20} aria-hidden />
          </IconButton>
          <IconButton
            label="Absent"
            active={status === "absent"}
            activeClass="border-red-600 bg-red-600 text-white"
            onPointerDown={() => (statusPress.current = editing.current)}
            onClick={() => pressStatus(toggleStatus(status, "absent"))}
          >
            <X size={20} aria-hidden />
          </IconButton>
          <IconButton
            label={showNote ? "Hide note" : "Add note"}
            active={showNote || Boolean(note)}
            activeClass="border-slate-400 bg-white text-slate-700 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-300"
            onClick={() => setShowNote((v) => !v)}
          >
            <MessageSquare size={18} aria-hidden />
          </IconButton>
        </span>
      </div>

      {showNote && (
        <input
          ref={inputRef}
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
  onPointerDown,
  children,
}: {
  label: string;
  active: boolean;
  activeClass: string;
  onClick: () => void;
  onPointerDown?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label} longPress={false}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onPointerDown={onPointerDown}
        onClick={onClick}
        className={`flex h-11 w-11 items-center justify-center rounded-lg border font-semibold ${
          active ? activeClass : "border-slate-300 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
