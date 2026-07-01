import type { Wcif, WcifActivity, WcifPerson, WcifRoom, WcifVenue } from "./wca";
import { dutyRank } from "./duties";
import { shortGroupLabel } from "./events";

/**
 * A trackable stage. Usually a WCIF room, but WCA also packs several stages into
 * one room, distinguished only by a token (usually a colour) inside each group's
 * name — so a stage is a room *plus* an optional sub-stage label. `id` is a
 * stable string: the bare room id (`"0"`) for a one-stage-per-room comp, or
 * `"{roomId}:{subStage}"` (`"0:Red"`) for a packed room.
 */
export interface Stage {
  id: string;
  /** The WCIF room this stage lives in. */
  roomId: number;
  /** The stage token within the room (e.g. "Red"), or null for a whole-room stage. */
  subStage: string | null;
  /** Display name: the sub-stage label when packed, else the room name. */
  name: string;
  color: string;
  /** The containing room's name, for grouping stages in a picker. */
  roomName: string;
  venueId: number;
  venueName: string;
}

export interface StaffAssignment {
  person: WcifPerson;
  assignmentCode: string;
  stationNumber: number | null;
}

/** A staff assignment code is any code in the "staff-*" namespace. */
export function isStaffCode(code: string): boolean {
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

/** Group words that precede a group number in a group name, across locales. */
const GROUP_WORDS = new Set(["group", "groupe", "grupo", "gruppe", "gr"]);

/**
 * The sub-stage label encoded in a group activity's name, relative to its parent
 * round. We take the part of the group name after the round-name prefix and drop
 * the group-number tokens — a bare number, a "g1"-style token, or a group word
 * ("Group"/"Grupo"/…). What's left is the stage token: "" on comps that model
 * each stage as its own room (e.g. "…Round 1, Group 2" → ""), or the stage's
 * name — usually a colour — on comps that pack several stages into one room
 * (e.g. "…Round 1 Red 2" → "Red"). Returns "" when the name doesn't start with
 * the round name (so we never invent a stage from an unexpected format).
 */
export function subStageLabel(roundName: string, groupName: string): string {
  if (!groupName.startsWith(roundName)) return "";
  const rest = groupName.slice(roundName.length);
  return rest
    .split(/[\s,]+/)
    .filter(
      (t) => t !== "" && !/^\d+$/.test(t) && !/^g\d+$/i.test(t) && !GROUP_WORDS.has(t.toLowerCase()),
    )
    .join(" ");
}

/** Named-colour palette for sub-stages, whose only "colour" is a word in the name. */
const STAGE_COLORS: Record<string, string> = {
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  orange: "#ea580c",
  yellow: "#eab308",
  purple: "#9333ea",
  violet: "#7c3aed",
  indigo: "#4f46e5",
  pink: "#db2777",
  cyan: "#0891b2",
  teal: "#0d9488",
  brown: "#92400e",
  white: "#e5e7eb",
  black: "#111827",
  gray: "#6b7280",
  grey: "#6b7280",
};

/**
 * A stage's colour swatch. Whole-room stages use the WCIF room colour; packed
 * sub-stages have no colour field, so we map their name word (Red → red …),
 * falling back to the room colour for a non-colour label.
 */
export function stageColor(subStage: string | null, roomColor: string): string {
  if (subStage) {
    const hex = STAGE_COLORS[subStage.trim().toLowerCase()];
    if (hex) return hex;
  }
  return roomColor;
}

/** Distinct non-empty sub-stage labels within a room, ascending. Empty ⇒ whole-room stage. */
function distinctSubStages(room: WcifRoom): string[] {
  const labels = new Set<string>();
  for (const round of room.activities) {
    for (const group of round.childActivities) {
      const label = subStageLabel(round.name, group.name);
      if (label) labels.add(label);
    }
  }
  return [...labels].sort();
}

function makeStage(venue: WcifVenue, room: WcifRoom, subStage: string | null): Stage {
  return {
    id: subStage != null ? `${room.id}:${subStage}` : String(room.id),
    roomId: room.id,
    subStage,
    name: subStage ?? room.name,
    color: stageColor(subStage, room.color),
    roomName: room.name,
    venueId: venue.id,
    venueName: venue.name,
  };
}

/**
 * Every stage of the competition. A room with no sub-stage tokens yields one
 * whole-room stage (the classic one-stage-per-room comp); a room whose groups
 * carry stage tokens is split into one stage per distinct token (e.g. one Main
 * Hall room → Red/Blue/Green/Orange stages).
 */
export function listStages(wcif: Wcif): Stage[] {
  const stages: Stage[] = [];
  for (const venue of wcif.schedule.venues) {
    for (const room of venue.rooms) {
      const labels = distinctSubStages(room);
      if (labels.length === 0) {
        stages.push(makeStage(venue, room, null));
      } else {
        for (const label of labels) stages.push(makeStage(venue, room, label));
      }
    }
  }
  return stages;
}

/** Split a stage id into its room id and optional sub-stage label. */
function parseStageId(stageId: string): { roomId: number; subStage: string | null } {
  const idx = stageId.indexOf(":");
  if (idx === -1) return { roomId: Number(stageId), subStage: null };
  return { roomId: Number(stageId.slice(0, idx)), subStage: stageId.slice(idx + 1) };
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
  /** Sub-stage token within the room (e.g. "Red"), or "" for a whole-room stage. */
  subStage: string;
  /** `${roundName} · Group ${n}`, falling back to the raw name when unparseable. */
  label: string;
  /** Compact `OH R1 · G1` label for tight selectors; falls back to `label`. */
  shortLabel: string;
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
        const label = groupNumber != null ? `${round.name} · Group ${groupNumber}` : group.name;
        return {
          activity: group,
          roundName: round.name,
          groupNumber,
          subStage: subStageLabel(round.name, group.name),
          label,
          shortLabel: shortGroupLabel(group.activityCode) ?? label,
          date: dateOf(group.startTime),
        };
      }),
    )
    .sort((a, b) => a.activity.startTime.localeCompare(b.activity.startTime));
}

/**
 * The groups of a single stage: all of its room's groups when the stage is the
 * whole room, or just the groups carrying the stage's sub-stage token when the
 * room is split into several stages.
 */
export function groupsForStage(wcif: Wcif, stageId: string): GroupView[] {
  const { roomId, subStage } = parseStageId(stageId);
  const target = subStage ?? "";
  return groupsForRoom(wcif, roomId).filter((g) => g.subStage === target);
}

/** The stage id owning a group activity (searches room → round → group), else null. */
export function stageIdForActivity(wcif: Wcif, activityId: number): string | null {
  for (const room of eachRoom(wcif)) {
    for (const round of room.activities) {
      if (round.id === activityId) return String(room.id);
      for (const group of round.childActivities) {
        if (group.id !== activityId) continue;
        const label = subStageLabel(round.name, group.name);
        return label ? `${room.id}:${label}` : String(room.id);
      }
    }
  }
  return null;
}

/**
 * Index into `groupsForStage(stageId)` of the group to land a lead on for `now`:
 * the group currently in progress, else the next upcoming group **today**, else
 * the last group of today once all have ended, else 0 (no groups today, or the
 * stage has none). "Today" is compared on the same date basis as `GroupView.date`.
 */
export function defaultGroupIndex(wcif: Wcif, stageId: string, now: Date = new Date()): number {
  const groups = groupsForStage(wcif, stageId);
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

/** A group's staff sharing one duty (e.g. all judges), sorted by station then name. */
export interface DutyGroup {
  assignmentCode: string;
  staff: StaffAssignment[];
}

/**
 * Order staff by station number (ascending, numerically) so a lead can walk the
 * stage station-by-station, with unstationed staff last and name as a tiebreak.
 * Comps that assign no stations have every station null, so this degrades to the
 * plain alphabetical order.
 */
function byStationThenName(a: StaffAssignment, b: StaffAssignment): number {
  const sa = a.stationNumber;
  const sb = b.stationNumber;
  if (sa !== sb) {
    if (sa == null) return 1; // unstationed staff go last
    if (sb == null) return -1;
    return sa - sb; // numeric, so 2 sorts before 10
  }
  return a.person.name.localeCompare(b.person.name);
}

/**
 * Staff for a group, grouped by duty (judges together, scramblers together, …)
 * in duty order, with people sorted by station (then name) within each. Lets a
 * delegate scan one duty at a time, station-by-station, instead of a mixed list.
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
      staff: staff.sort(byStationThenName),
    }))
    .sort(
      (a, b) =>
        dutyRank(a.assignmentCode) - dutyRank(b.assignmentCode) ||
        a.assignmentCode.localeCompare(b.assignmentCode),
    );
}

/**
 * Derive a person's stage from their *staff* assignments: the stage where they
 * have the most staff assignments. Competitor assignments are ignored. When
 * `onDate` (YYYY-MM-DD) is given, only assignments scheduled that day are
 * counted — used to find the stage a lead is working *today*, since at a
 * multi-day comp the all-time max stage may differ from today's. Counting is by
 * stage id, so a lead on the "Red" half of a packed room derives "Red", not the
 * whole room. Returns null when no (matching) staff assignments exist.
 */
export function deriveStageId(wcif: Wcif, wcaUserId: number, onDate?: string): string | null {
  const person = wcif.persons.find((p) => p.wcaUserId === wcaUserId);
  if (!person) return null;

  const counts = new Map<string, number>();
  for (const assignment of person.assignments) {
    if (!isStaffCode(assignment.assignmentCode)) continue;
    if (onDate != null) {
      const activity = activityById(wcif, assignment.activityId);
      if (!activity || dateOf(activity.startTime) !== onDate) continue;
    }
    const stageId = stageIdForActivity(wcif, assignment.activityId);
    if (stageId == null) continue;
    counts.set(stageId, (counts.get(stageId) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [stageId, count] of counts) {
    if (count > bestCount) {
      best = stageId;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The calendar day whose stage a lead should land on for `today`: the earliest
 * day they staff that is still `>= today` (so before/at the comp they see their
 * next working day, and each day rolls forward automatically), else — if all
 * their staff assignments are in the past — the last day they staffed. Returns
 * null when the person has no staff assignments at all. Competitor assignments
 * are ignored, matching `deriveStageId`.
 */
export function relevantStaffDay(wcif: Wcif, wcaUserId: number, today: string): string | null {
  const person = wcif.persons.find((p) => p.wcaUserId === wcaUserId);
  if (!person) return null;

  const days = new Set<string>();
  for (const assignment of person.assignments) {
    if (!isStaffCode(assignment.assignmentCode)) continue;
    const activity = activityById(wcif, assignment.activityId);
    if (activity) days.add(dateOf(activity.startTime));
  }
  if (days.size === 0) return null;

  const sorted = [...days].sort();
  return sorted.find((d) => d >= today) ?? sorted[sorted.length - 1];
}

/**
 * The stage to land a lead on: the stage they're staffing on their most relevant
 * day — today if they staff today, otherwise their next upcoming working day (so
 * before the comp starts they see day 1's stage, not an all-time favourite),
 * falling back to the first stage of the competition. Null only when the
 * competition has no stages.
 */
export function defaultStageId(
  wcif: Wcif,
  wcaUserId: number,
  now: Date = new Date(),
): string | null {
  const today = dateOf(now.toISOString());
  const day = relevantStaffDay(wcif, wcaUserId, today);
  return (
    (day != null ? deriveStageId(wcif, wcaUserId, day) : null) ??
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
