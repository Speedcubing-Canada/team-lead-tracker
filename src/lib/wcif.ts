import type { Wcif, WcifActivity, WcifPerson, WcifRoom } from "./wca";
import { dutyRank } from "./duties";

export interface Stage {
  id: number;
  name: string;
  color: string;
  venueId: number;
  venueName: string;
}

export interface StaffAssignment {
  person: WcifPerson;
  assignmentCode: string;
  stationNumber: number | null;
}

/** A staff assignment code is any code in the "staff-*" namespace. */
function isStaffCode(code: string): boolean {
  return code.startsWith("staff");
}

/** Date portion (YYYY-MM-DD) of an ISO datetime. */
function dateOf(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

function eachRoom(wcif: Wcif): WcifRoom[] {
  return wcif.schedule.venues.flatMap((venue) => venue.rooms);
}

/** All activity ids in an activity subtree (the activity itself + descendants). */
function activityIds(activity: WcifActivity): number[] {
  return [activity.id, ...activity.childActivities.flatMap(activityIds)];
}

/** Every room is a stage. */
export function listStages(wcif: Wcif): Stage[] {
  return wcif.schedule.venues.flatMap((venue) =>
    venue.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      color: room.color,
      venueId: venue.id,
      venueName: venue.name,
    })),
  );
}

/** Distinct scheduled dates across all rooms, ascending. */
export function listDays(wcif: Wcif): string[] {
  const dates = new Set<string>();
  for (const room of eachRoom(wcif)) {
    for (const activity of room.activities) {
      dates.add(dateOf(activity.startTime));
    }
  }
  return [...dates].sort();
}

/** Find an activity anywhere in the schedule by id (searches descendants), else null. */
export function activityById(wcif: Wcif, activityId: number): WcifActivity | null {
  function search(activity: WcifActivity): WcifActivity | null {
    if (activity.id === activityId) return activity;
    for (const child of activity.childActivities) {
      const found = search(child);
      if (found) return found;
    }
    return null;
  }
  for (const room of eachRoom(wcif)) {
    for (const activity of room.activities) {
      const found = search(activity);
      if (found) return found;
    }
  }
  return null;
}

/** The room containing the given activity (or any of its descendants), else null. */
export function roomIdForActivity(wcif: Wcif, activityId: number): number | null {
  for (const room of eachRoom(wcif)) {
    for (const activity of room.activities) {
      if (activityIds(activity).includes(activityId)) return room.id;
    }
  }
  return null;
}

/** A group activity enriched with a clean, display-ready label. */
export interface GroupView {
  activity: WcifActivity;
  /** Parent round name, e.g. "3x3x3 Cube, Round 1". */
  roundName: string;
  /** Group number parsed from the activity code, or null when absent. */
  groupNumber: number | null;
  /** `${roundName} · Group ${n}`, falling back to the raw name when unparseable. */
  label: string;
  /** Scheduled date (YYYY-MM-DD), for grouping in a picker. */
  date: string;
}

/** Parse the group number out of an activity code like "333-r1-g1" → 1, else null. */
export function groupNumberFromCode(activityCode: string): number | null {
  const match = activityCode.match(/-g(\d+)\b/);
  return match ? Number(match[1]) : null;
}

/**
 * All of a room's groups across every day, sorted by start time, each carrying a
 * clean "round · Group N" label derived from the parent round name plus the group
 * number in the activity code. This avoids trusting the raw WCIF group `name`,
 * which on some comps leaks the zone/room name (e.g. "…Round 1 Zona 1").
 */
export function groupsForRoom(wcif: Wcif, roomId: number): GroupView[] {
  const room = eachRoom(wcif).find((r) => r.id === roomId);
  if (!room) return [];
  return room.activities
    .flatMap((round) =>
      round.childActivities.map((group): GroupView => {
        const groupNumber = groupNumberFromCode(group.activityCode);
        return {
          activity: group,
          roundName: round.name,
          groupNumber,
          label: groupNumber != null ? `${round.name} · Group ${groupNumber}` : group.name,
          date: dateOf(group.startTime),
        };
      }),
    )
    .sort((a, b) => a.activity.startTime.localeCompare(b.activity.startTime));
}

/**
 * Index into `groupsForRoom(roomId)` of the group to land a lead on for `now`:
 * the group currently in progress, else the next upcoming group **today**, else
 * the last group of today once all have ended, else 0 (no groups today, or the
 * room has none). "Today" is compared on the same date basis as `GroupView.date`.
 */
export function defaultGroupIndex(wcif: Wcif, roomId: number, now: Date = new Date()): number {
  const groups = groupsForRoom(wcif, roomId);
  if (groups.length === 0) return 0;

  const today = dateOf(now.toISOString());
  const nowMs = now.getTime();
  let lastTodayIndex = -1;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].date !== today) continue;
    lastTodayIndex = i;
    // Groups are start-time sorted, so the first whose end is still in the
    // future is either in progress or the next one to start.
    if (nowMs < new Date(groups[i].activity.endTime).getTime()) return i;
  }
  return lastTodayIndex >= 0 ? lastTodayIndex : 0;
}

/** Staff assigned to a specific group activity, in WCIF person order. */
export function staffForGroup(wcif: Wcif, activityId: number): StaffAssignment[] {
  const result: StaffAssignment[] = [];
  for (const person of wcif.persons) {
    for (const assignment of person.assignments) {
      if (assignment.activityId === activityId && isStaffCode(assignment.assignmentCode)) {
        result.push({
          person,
          assignmentCode: assignment.assignmentCode,
          stationNumber: assignment.stationNumber,
        });
      }
    }
  }
  return result;
}

/** A group's staff sharing one duty (e.g. all judges), people sorted by name. */
export interface DutyGroup {
  assignmentCode: string;
  staff: StaffAssignment[];
}

/**
 * Staff for a group, grouped by duty (judges together, scramblers together, …)
 * in duty order, with people sorted by name within each. Lets a delegate scan
 * one duty at a time instead of a mixed list.
 */
export function staffByDuty(wcif: Wcif, activityId: number): DutyGroup[] {
  const byCode = new Map<string, StaffAssignment[]>();
  for (const assignment of staffForGroup(wcif, activityId)) {
    const list = byCode.get(assignment.assignmentCode);
    if (list) list.push(assignment);
    else byCode.set(assignment.assignmentCode, [assignment]);
  }

  return [...byCode.entries()]
    .map(([assignmentCode, staff]) => ({
      assignmentCode,
      staff: staff.sort((a, b) => a.person.name.localeCompare(b.person.name)),
    }))
    .sort(
      (a, b) =>
        dutyRank(a.assignmentCode) - dutyRank(b.assignmentCode) ||
        a.assignmentCode.localeCompare(b.assignmentCode),
    );
}

/**
 * Derive a person's stage from their *staff* assignments: the room where they
 * have the most staff assignments. Competitor assignments are ignored. When
 * `onDate` (YYYY-MM-DD) is given, only assignments scheduled that day are
 * counted — used to find the stage a lead is working *today*, since at a
 * multi-day comp the all-time max room may be a different stage than today's.
 * Returns null when no (matching) staff assignments exist.
 */
export function deriveStageRoomId(wcif: Wcif, wcaUserId: number, onDate?: string): number | null {
  const person = wcif.persons.find((p) => p.wcaUserId === wcaUserId);
  if (!person) return null;

  const counts = new Map<number, number>();
  for (const assignment of person.assignments) {
    if (!isStaffCode(assignment.assignmentCode)) continue;
    if (onDate != null) {
      const activity = activityById(wcif, assignment.activityId);
      if (!activity || dateOf(activity.startTime) !== onDate) continue;
    }
    const roomId = roomIdForActivity(wcif, assignment.activityId);
    if (roomId == null) continue;
    counts.set(roomId, (counts.get(roomId) ?? 0) + 1);
  }

  let best: number | null = null;
  let bestCount = 0;
  for (const [roomId, count] of counts) {
    if (count > bestCount) {
      best = roomId;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The stage to land a lead on: the stage they're staffing *today* (so it lines
 * up with the day-aware group auto-detection), falling back to their all-time
 * derived stage, then the first stage of the competition. Null only when the
 * competition has no stages.
 */
export function defaultStageRoomId(
  wcif: Wcif,
  wcaUserId: number,
  now: Date = new Date(),
): number | null {
  const today = dateOf(now.toISOString());
  return (
    deriveStageRoomId(wcif, wcaUserId, today) ??
    deriveStageRoomId(wcif, wcaUserId) ??
    listStages(wcif)[0]?.id ??
    null
  );
}

/** WCIF roles that, on their own, grant access to a competition's tracker. */
const PRIVILEGED_ROLES = new Set(["delegate", "trainee-delegate", "organizer"]);

/**
 * Whether a WCA user may access a competition's tracker: they must hold a
 * delegate/organizer role, or have at least one staff assignment (a stage lead
 * who is only listed as staff still belongs). This is the authority the
 * authWithWca Cloud Function enforces before writing a membership doc.
 */
export function canAccessCompetition(wcif: Wcif, wcaUserId: number): boolean {
  const person = wcif.persons.find((p) => p.wcaUserId === wcaUserId);
  if (!person) return false;
  if (person.roles.some((role) => PRIVILEGED_ROLES.has(role))) return true;
  return person.assignments.some((a) => isStaffCode(a.assignmentCode));
}
