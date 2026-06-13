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

function normalize(c: RawCompetition, ongoing: boolean): MyCompetition {
  return { id: c.id, name: c.name, startDate: c.start_date, endDate: c.end_date, ongoing };
}

function byStartDate(a: MyCompetition, b: MyCompetition): number {
  return a.startDate.localeCompare(b.startDate);
}

/** Ongoing competitions first, then upcoming; each group sorted by start date, deduped by id. */
export function mergeMyCompetitions(
  ongoing: RawCompetition[],
  upcoming: RawCompetition[],
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
  return [...ongoingNorm.sort(byStartDate), ...upcomingNorm.sort(byStartDate)];
}
