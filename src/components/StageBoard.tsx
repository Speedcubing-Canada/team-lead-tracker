import { useMemo, useState } from "react";
import type { Wcif } from "../lib/wca";
import {
  defaultStageRoomId,
  groupsForRoom,
  listStages,
  staffByDuty,
  type GroupView,
} from "../lib/wcif";
import { dutyStyle } from "../lib/duties";
import { checkDocId, type CheckRecord, type CheckStatus } from "../lib/checks";
import { StaffRow } from "./StaffRow";

export interface StageBoardHandlers {
  onStatus: (activityId: number, registrantId: number, status: CheckStatus | null) => void;
  onNote: (activityId: number, registrantId: number, note: string) => void;
}

const NOOP_HANDLERS: StageBoardHandlers = { onStatus: () => {}, onNote: () => {} };

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
    bucket.items.push({ index, label: g.label });
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
  checks = new Map<string, CheckRecord>(),
  handlers = NOOP_HANDLERS,
}: {
  wcif: Wcif;
  wcaUserId?: number;
  checks?: Map<string, CheckRecord>;
  handlers?: StageBoardHandlers;
}) {
  const stages = useMemo(() => listStages(wcif), [wcif]);

  const [roomId, setRoomId] = useState<number | null>(
    () => (wcaUserId != null ? defaultStageRoomId(wcif, wcaUserId) : stages[0]?.id) ?? null,
  );
  const [groupIndex, setGroupIndex] = useState(0);

  const groups = useMemo(
    () => (roomId != null ? groupsForRoom(wcif, roomId) : []),
    [wcif, roomId],
  );
  const dayBuckets = useMemo(() => byDay(groups), [groups]);

  const index = Math.min(groupIndex, Math.max(groups.length - 1, 0));
  const current = groups[index];

  function changeStage(id: number) {
    setRoomId(id);
    setGroupIndex(0);
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-slate-200 bg-white p-3">
        <select
          aria-label="Stage"
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
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
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg disabled:opacity-40"
              >
                ◀
              </button>
              <select
                aria-label="Group"
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base"
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
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg disabled:opacity-40"
              >
                ▶
              </button>
            </div>
            <p className="text-center text-xs text-slate-500">
              {dayLabel(current.date)} · {timeLabel(current.activity.startTime)} · Group{" "}
              {index + 1} of {groups.length}
            </p>
          </>
        )}
      </header>

      {!current ? (
        <p className="p-6 text-center text-sm text-slate-500">No groups on this stage.</p>
      ) : (
        <div className="p-3">
          <h2 className="mb-2 text-base font-semibold text-slate-900">{current.label}</h2>
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
    return <p className="text-xs text-slate-400">No staff assigned.</p>;
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
                      className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900"
                    >
                      {s.person.name}
                      {s.stationNumber != null && (
                        <span className="ml-2 text-xs text-slate-500">Station {s.stationNumber}</span>
                      )}
                    </li>
                  );
                }
                return (
                  <StaffRow
                    key={`${registrantId}-${assignmentCode}`}
                    name={s.person.name}
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
