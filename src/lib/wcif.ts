import type { Wcif, WcifActivity, WcifPerson, WcifRoom } from "./wca";

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

/** The room containing the given activity (or any of its descendants), else null. */
export function roomIdForActivity(wcif: Wcif, activityId: number): number | null {
  for (const room of eachRoom(wcif)) {
    for (const activity of room.activities) {
      if (activityIds(activity).includes(activityId)) return room.id;
    }
  }
  return null;
}

/** Group activities (childActivities) in a room on a given day, sorted by start time. */
export function groupsForRoomOnDay(wcif: Wcif, roomId: number, date: string): WcifActivity[] {
  const room = eachRoom(wcif).find((r) => r.id === roomId);
  if (!room) return [];
  return room.activities
    .flatMap((activity) => activity.childActivities)
    .filter((group) => dateOf(group.startTime) === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
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

/**
 * Derive a person's stage from their *staff* assignments: the room where they
 * have the most staff assignments. Competitor assignments are ignored. Returns
 * null when they have no staff assignments (caller falls back to manual pick).
 */
export function deriveStageRoomId(wcif: Wcif, wcaUserId: number): number | null {
  const person = wcif.persons.find((p) => p.wcaUserId === wcaUserId);
  if (!person) return null;

  const counts = new Map<number, number>();
  for (const assignment of person.assignments) {
    if (!isStaffCode(assignment.assignmentCode)) continue;
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
 * The stage to land a lead on: their derived stage, falling back to the first
 * stage of the competition. Null only when the competition has no stages.
 */
export function defaultStageRoomId(wcif: Wcif, wcaUserId: number): number | null {
  return deriveStageRoomId(wcif, wcaUserId) ?? listStages(wcif)[0]?.id ?? null;
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
