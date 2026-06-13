import { useMemo, useState } from "react";
import type { Wcif } from "../lib/wca";
import {
  defaultStageRoomId,
  groupsForRoomOnDay,
  listDays,
  listStages,
  staffForGroup,
} from "../lib/wcif";

const ASSIGNMENT_LABELS: Record<string, string> = {
  "staff-judge": "Judge",
  "staff-scrambler": "Scrambler",
  "staff-runner": "Runner",
  "staff-dataentry": "Data entry",
  "staff-announcer": "Announcer",
};

function assignmentLabel(code: string): string {
  return ASSIGNMENT_LABELS[code] ?? code.replace(/^staff-/, "");
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Read-only board for a single stage + day: the groups on that stage and the
 * staff assigned to each. Present/absent toggles are layered on in Phase 3.
 * Pure with respect to its props (no network) so it's straightforward to test.
 */
export function StageBoard({ wcif, wcaUserId }: { wcif: Wcif; wcaUserId?: number }) {
  const stages = useMemo(() => listStages(wcif), [wcif]);
  const days = useMemo(() => listDays(wcif), [wcif]);

  const [roomId, setRoomId] = useState<number | null>(
    () => (wcaUserId != null ? defaultStageRoomId(wcif, wcaUserId) : stages[0]?.id) ?? null,
  );
  const [day, setDay] = useState<string | undefined>(() => days[0]);

  const groups = useMemo(
    () => (roomId != null && day ? groupsForRoomOnDay(wcif, roomId, day) : []),
    [wcif, roomId, day],
  );

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex gap-2 border-b border-slate-200 bg-white p-3">
        <select
          aria-label="Stage"
          className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base"
          value={roomId ?? ""}
          onChange={(e) => setRoomId(Number(e.target.value))}
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Day"
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base"
          value={day ?? ""}
          onChange={(e) => setDay(e.target.value)}
        >
          {days.map((d) => (
            <option key={d} value={d}>
              {dayLabel(d)}
            </option>
          ))}
        </select>
      </header>

      {groups.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">No groups on this stage for this day.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {groups.map((group) => {
            const staff = staffForGroup(wcif, group.id);
            return (
              <li key={group.id} className="p-3">
                <h3 className="text-sm font-semibold text-slate-900">{group.name}</h3>
                {staff.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-400">No staff assigned.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1">
                    {staff.map((s) => (
                      <li
                        key={`${group.id}-${s.person.registrantId}-${s.assignmentCode}`}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <span className="text-sm text-slate-900">{s.person.name}</span>
                        <span className="text-xs font-medium text-slate-500">
                          {assignmentLabel(s.assignmentCode)}
                          {s.stationNumber != null ? ` · #${s.stationNumber}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
