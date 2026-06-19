/** Normalizes the competition lists from the WCA /me endpoint for the client. */

/** Competition shape as returned by the WCA REST API (snake_case). */
export interface RawCompetition {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

export interface MyCompetition {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  ongoing: boolean;
}

/**
 * Split a list of not-yet-over competitions into those happening now (today
 * within [start_date, end_date], inclusive) and those still upcoming.
 */
export function partitionByOngoing(
  future: RawCompetition[],
  today: string,
): { ongoing: RawCompetition[]; upcoming: RawCompetition[] } {
  const ongoing: RawCompetition[] = [];
  const upcoming: RawCompetition[] = [];
  for (const c of future) {
    if (c.start_date <= today && today <= c.end_date) ongoing.push(c);
    else upcoming.push(c);
  }
  return { ongoing, upcoming };
}

function normalize(c: RawCompetition, ongoing: boolean): MyCompetition {
  return { id: c.id, name: c.name, startDate: c.start_date, endDate: c.end_date, ongoing };
}

function byStartDate(a: MyCompetition, b: MyCompetition): number {
  return a.startDate.localeCompare(b.startDate);
}

/** A YYYY-MM-DD date `days` before `today`. */
function isoDaysBefore(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Past competitions that ended within the last `days` (default 45), most-recent
 * first. The WCA past list can span a competitor's whole history, so we cap it
 * server-side to keep the payload small; the client applies its own (shorter)
 * window on top.
 */
export function recentPastCompetitions(
  past: RawCompetition[],
  today: string,
  days = 45,
): MyCompetition[] {
  const cutoff = isoDaysBefore(today, days);
  return past
    .filter((c) => c.end_date >= cutoff && c.end_date < today)
    .map((c) => normalize(c, false))
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
}

/**
 * Ongoing competitions first, then upcoming, then recently-ended past ones; the
 * future groups sorted by start date, past by end date (most recent first),
 * deduped by id across all three.
 */
export function mergeMyCompetitions(
  ongoing: RawCompetition[],
  upcoming: RawCompetition[],
  past: MyCompetition[] = [],
): MyCompetition[] {
  const seen = new Set<string>();
  const ongoingNorm: MyCompetition[] = [];
  for (const c of ongoing) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    ongoingNorm.push(normalize(c, true));
  }
  const upcomingNorm: MyCompetition[] = [];
  for (const c of upcoming) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    upcomingNorm.push(normalize(c, false));
  }
  const pastNorm: MyCompetition[] = [];
  for (const c of past) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    pastNorm.push(c);
  }
  return [...ongoingNorm.sort(byStartDate), ...upcomingNorm.sort(byStartDate), ...pastNorm];
}
