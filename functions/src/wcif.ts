/**
 * Slim WCIF transform.
 *
 * The WCA public WCIF is large (multi-MB) and served uncompressed — most of it
 * (`personalBests`, event results, registration metadata, …) the app never
 * reads. `slimWcif` keeps only the fields the web client's `Wcif` type declares,
 * shrinking the payload ~3.5× before it's gzipped and cached. The shape here is
 * kept in sync with `Wcif` in `src/lib/wca.ts` (the Functions package is bundled
 * independently and can't import from the web app's source tree).
 *
 * `SlimWcif` is a structural superset of `AccessWcif` (`./access.ts`), so the
 * access-check helpers accept it unchanged.
 */

export interface SlimWcifAssignment {
  activityId: number;
  assignmentCode: string;
  stationNumber: number | null;
}

export interface SlimWcifPerson {
  registrantId: number | null;
  name: string;
  wcaUserId: number;
  wcaId: string | null;
  countryIso2: string;
  roles: string[];
  assignments: SlimWcifAssignment[];
  avatar: { url: string; thumbUrl: string } | null;
}

export interface SlimWcifActivity {
  id: number;
  name: string;
  activityCode: string;
  startTime: string;
  endTime: string;
  childActivities: SlimWcifActivity[];
}

export interface SlimWcif {
  formatVersion: string;
  id: string;
  name: string;
  shortName?: string;
  persons: SlimWcifPerson[];
  events: { id: string; rounds: { id: string }[] }[];
  schedule: {
    startDate: string;
    numberOfDays: number;
    venues: {
      id: number;
      name: string;
      timezone: string;
      rooms: { id: number; name: string; color: string; activities: SlimWcifActivity[] }[];
    }[];
  };
}

/** Shape of the raw WCA WCIF, narrowed to the fields we read. */
type RawWcif = SlimWcif & Record<string, unknown>;

function slimActivity(a: SlimWcifActivity): SlimWcifActivity {
  return {
    id: a.id,
    name: a.name,
    activityCode: a.activityCode,
    startTime: a.startTime,
    endTime: a.endTime,
    childActivities: (a.childActivities ?? []).map(slimActivity),
  };
}

/** Project the full WCA WCIF down to the fields the web client uses. */
export function slimWcif(raw: unknown): SlimWcif {
  const w = raw as RawWcif;
  return {
    formatVersion: w.formatVersion,
    id: w.id,
    name: w.name,
    shortName: w.shortName,
    persons: (w.persons ?? []).map((p) => ({
      registrantId: p.registrantId,
      name: p.name,
      wcaUserId: p.wcaUserId,
      wcaId: p.wcaId,
      countryIso2: p.countryIso2,
      roles: p.roles ?? [],
      assignments: (p.assignments ?? []).map((a) => ({
        activityId: a.activityId,
        assignmentCode: a.assignmentCode,
        stationNumber: a.stationNumber ?? null,
      })),
      avatar: p.avatar ? { url: p.avatar.url, thumbUrl: p.avatar.thumbUrl } : null,
    })),
    events: (w.events ?? []).map((e) => ({
      id: e.id,
      rounds: (e.rounds ?? []).map((r) => ({ id: r.id })),
    })),
    schedule: {
      startDate: w.schedule.startDate,
      numberOfDays: w.schedule.numberOfDays,
      venues: (w.schedule.venues ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        timezone: v.timezone,
        rooms: (v.rooms ?? []).map((room) => ({
          id: room.id,
          name: room.name,
          color: room.color,
          activities: (room.activities ?? []).map(slimActivity),
        })),
      })),
    },
  };
}
