/**
 * Compact event labels for tight UI (the group <select> on a phone, the shame
 * dashboard). WCA activity codes carry the event id (e.g. "333oh-r1-g1"), and
 * the full WCIF round names ("3x3x3 One-Handed, Round 1") are too long to read
 * alongside a group number in a narrow control. These short codes mirror the
 * abbreviations cubers already use.
 */
const EVENT_SHORT_NAMES: Record<string, string> = {
  "222": "2x2",
  "333": "3x3",
  "444": "4x4",
  "555": "5x5",
  "666": "6x6",
  "777": "7x7",
  "333bf": "3BLD",
  "333fm": "FMC",
  "333oh": "OH",
  clock: "Clock",
  minx: "Mega",
  pyram: "Pyra",
  skewb: "Skewb",
  sq1: "Sq-1",
  "444bf": "4BLD",
  "555bf": "5BLD",
  "333mbf": "MBLD",
  "333ft": "Feet", // deprecated, but still appears in historical schedules
};

/** The event id portion of an activity code: the segment before the first "-". */
export function eventIdFromActivityCode(activityCode: string): string {
  return activityCode.split("-")[0];
}

/** Short code for a WCA event id (e.g. "333oh" → "OH"), or null when unknown. */
export function shortEventName(eventId: string): string | null {
  return EVENT_SHORT_NAMES[eventId] ?? null;
}

/**
 * A compact label for a group activity code, e.g. "333oh-r2-g3" → "OH R2 · G3".
 * The round segment is dropped when absent. Returns null when the event id is
 * unknown or the code carries no group number, so callers can fall back to the
 * full WCIF-derived label.
 */
export function shortGroupLabel(activityCode: string): string | null {
  const short = shortEventName(eventIdFromActivityCode(activityCode));
  if (short == null) return null;

  const group = activityCode.match(/-g(\d+)\b/);
  if (!group) return null;

  const round = activityCode.match(/-r(\d+)\b/);
  const roundPart = round ? ` R${round[1]}` : "";
  return `${short}${roundPart} · G${group[1]}`;
}
