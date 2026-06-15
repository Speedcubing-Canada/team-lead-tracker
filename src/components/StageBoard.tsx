import { useEffect, useMemo, useState } from "react";
import type { Wcif } from "../lib/wca";
import {
  defaultGroupIndex,
  defaultStageRoomId,
  groupsForRoom,
  listStages,
  staffByDuty,
  type GroupView,
} from "../lib/wcif";
import { dutyStyle } from "../lib/duties";
import { checkDocId, type CheckRecord, type CheckStatus } from "../lib/checks";
import { loadSelection, saveSelection } from "../lib/selection";
import { StaffRow } from "./StaffRow";
import { PersonNameButton } from "./PersonNameButton";

export interface StageBoardHandlers {
  onStatus: (activityId: number, registrantId: number, status: CheckStatus | null) => void;
  onNote: (activityId: number, registrantId: number, note: string) => void;
}

const NOOP_HANDLERS: StageBoardHandlers = { onStatus: () => {}, onNote: () => {} };

/** Today's calendar date (YYYY-MM-DD) on the same UTC basis as GroupView.date. */
function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The stage + group to open on, computed once on mount: a saved selection from
 * *today* wins (so navigating away and back never resets it); otherwise the
 * lead's derived stage plus today's current/next group is auto-detected.
 */
function computeInitialSelection(
  wcif: Wcif,
  wcaUserId: number | undefined,
  competitionId: string | undefined,
): { roomId: number | null; groupIndex: number } {
  const stages = listStages(wcif);
  const stored = competitionId ? loadSelection(competitionId) : null;
  const storedStageExists = stored != null && stages.some((s) => s.id === stored.roomId);

  const roomId = storedStageExists
    ? stored!.roomId
    : (wcaUserId != null ? defaultStageRoomId(wcif, wcaUserId) : stages[0]?.id) ?? null;
  if (roomId == null) return { roomId: null, groupIndex: 0 };

  // Same-day saved group restores exactly; a stale (earlier-day) one is dropped
  // so we re-detect today's group on the saved stage.
  if (storedStageExists && stored!.savedDate === todayDate()) {
    const idx = groupsForRoom(wcif, roomId).findIndex(
      (g) => g.activity.id === stored!.groupActivityId,
    );
    if (idx >= 0) return { roomId, groupIndex: idx };
  }
  return { roomId, groupIndex: defaultGroupIndex(wcif, roomId) };
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timeLabel(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Group the stage's groups by day so the picker can show day headers. */
function byDay(groups: GroupView[]): { date: string; items: { index: number; label: string }[] }[] {
  const out: { date: string; items: { index: number; label: string }[] }[] = [];
  groups.forEach((g, index) => {
    let bucket = out[out.length - 1];
    if (!bucket || bucket.date !== g.date) {
      bucket = { date: g.date, items: [] };
      out.push(bucket);
    }
    bucket.items.push({ index, label: g.shortLabel });
  });
  return out;
}

/**
 * Board for a single stage, navigated one group at a time (Competition-Groups
 * style): a stage selector plus prev/next and a jump-to picker, then the staff
 * assigned to the current group with present/absent toggles. Pure w.r.t. props.
 */
export function StageBoard({
  wcif,
  wcaUserId,
  competitionId,
  checks = new Map<string, CheckRecord>(),
  handlers = NOOP_HANDLERS,
}: {
  wcif: Wcif;
  wcaUserId?: number;
  competitionId?: string;
  checks?: Map<string, CheckRecord>;
  handlers?: StageBoardHandlers;
}) {
  const stages = useMemo(() => listStages(wcif), [wcif]);

  const [initial] = useState(() => computeInitialSelection(wcif, wcaUserId, competitionId));
  const [roomId, setRoomId] = useState<number | null>(initial.roomId);
  const [groupIndex, setGroupIndex] = useState(initial.groupIndex);

  const groups = useMemo(
    () => (roomId != null ? groupsForRoom(wcif, roomId) : []),
    [wcif, roomId],
  );
  const dayBuckets = useMemo(() => byDay(groups), [groups]);

  const index = Math.min(groupIndex, Math.max(groups.length - 1, 0));
  const current = groups[index];

  // Persist the selection so it survives tab navigation and reloads. Also stamps
  // the auto-detected selection as "today's" on first mount, which is intended.
  useEffect(() => {
    if (!competitionId || roomId == null || !current) return;
    saveSelection(competitionId, {
      roomId,
      groupActivityId: current.activity.id,
      savedDate: todayDate(),
    });
  }, [competitionId, roomId, current?.activity.id]);

  function changeStage(id: number) {
    setRoomId(id);
    // Land on the new stage's current/next group, not always its first.
    setGroupIndex(defaultGroupIndex(wcif, id));
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <select
          aria-label="Stage"
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          value={roomId ?? ""}
          onChange={(e) => changeStage(Number(e.target.value))}
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {current && (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous group"
                disabled={index === 0}
                onClick={() => setGroupIndex(index - 1)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                ◀
              </button>
              <select
                aria-label="Group"
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={index}
                onChange={(e) => setGroupIndex(Number(e.target.value))}
              >
                {dayBuckets.map((bucket) => (
                  <optgroup key={bucket.date} label={dayLabel(bucket.date)}>
                    {bucket.items.map((item) => (
                      <option key={item.index} value={item.index}>
                        {item.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                aria-label="Next group"
                disabled={index >= groups.length - 1}
                onClick={() => setGroupIndex(index + 1)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                ▶
              </button>
            </div>
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              {dayLabel(current.date)} · {timeLabel(current.activity.startTime)} · Group{" "}
              {index + 1} of {groups.length}
            </p>
          </>
        )}
      </header>

      {!current ? (
        <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No groups on this stage.</p>
      ) : (
        <div className="p-3">
          <h2 className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">{current.label}</h2>
          <StaffList wcif={wcif} groupId={current.activity.id} checks={checks} handlers={handlers} />
        </div>
      )}
    </div>
  );
}

function StaffList({
  wcif,
  groupId,
  checks,
  handlers,
}: {
  wcif: Wcif;
  groupId: number;
  checks: Map<string, CheckRecord>;
  handlers: StageBoardHandlers;
}) {
  const dutyGroups = staffByDuty(wcif, groupId);
  if (dutyGroups.length === 0) {
    return <p className="text-xs text-slate-400 dark:text-slate-500">No staff assigned.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {dutyGroups.map(({ assignmentCode, staff }) => {
        const duty = dutyStyle(assignmentCode);
        return (
          <section key={assignmentCode}>
            <h3
              data-testid="duty-header"
              className={`mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${duty.badge}`}
            >
              {duty.label} · {staff.length}
            </h3>
            <ul className="flex flex-col gap-2">
              {staff.map((s) => {
                const registrantId = s.person.registrantId;
                // Staffers without a registrantId can't be tracked; show read-only.
                if (registrantId == null) {
                  return (
                    <li
                      key={`${s.person.wcaUserId}-${assignmentCode}`}
                      className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <PersonNameButton person={s.person} />
                      {s.stationNumber != null && (
                        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">Station {s.stationNumber}</span>
                      )}
                    </li>
                  );
                }
                return (
                  <StaffRow
                    key={`${registrantId}-${assignmentCode}`}
                    person={s.person}
                    station={s.stationNumber}
                    check={checks.get(checkDocId(groupId, registrantId))}
                    onStatus={(status) => handlers.onStatus(groupId, registrantId, status)}
                    onNote={(note) => handlers.onNote(groupId, registrantId, note)}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
