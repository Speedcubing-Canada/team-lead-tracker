/**
 * WCA API types and access helpers.
 *
 * Only the subset of the WCIF (WCA Competition Interchange Format) we actually
 * use is typed here. The full spec lives at
 * https://github.com/thewca/wcif/blob/master/specification.md
 */

export interface Wcif {
  formatVersion: string;
  id: string;
  name: string;
  shortName?: string;
  persons: WcifPerson[];
  events: WcifEvent[];
  schedule: WcifSchedule;
}

export interface WcifPerson {
  registrantId: number | null;
  name: string;
  wcaUserId: number;
  wcaId: string | null;
  countryIso2: string;
  roles: string[];
  assignments: WcifAssignment[];
}

export interface WcifAssignment {
  activityId: number;
  /** e.g. "competitor", "staff-judge", "staff-scrambler", "staff-runner". */
  assignmentCode: string;
  stationNumber: number | null;
}

export interface WcifEvent {
  id: string;
  rounds: { id: string }[];
}

export interface WcifSchedule {
  startDate: string;
  numberOfDays: number;
  venues: WcifVenue[];
}

export interface WcifVenue {
  id: number;
  name: string;
  timezone: string;
  rooms: WcifRoom[];
}

export interface WcifRoom {
  id: number;
  name: string;
  color: string;
  activities: WcifActivity[];
}

export interface WcifActivity {
  id: number;
  name: string;
  activityCode: string;
  startTime: string;
  endTime: string;
  childActivities: WcifActivity[];
}

const WCA_ORIGIN = import.meta.env?.VITE_WCA_ORIGIN ?? "https://www.worldcubeassociation.org";

/** Build the WCA OAuth authorize URL to redirect the browser to (scope: public). */
export function buildWcaAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_WCA_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_WCA_REDIRECT_URI,
    response_type: "code",
    scope: "public",
    state,
  });
  return `${WCA_ORIGIN}/oauth/authorize?${params.toString()}`;
}

/** Fetch the public WCIF (unauthenticated; assignments and roles are public). */
export async function fetchPublicWcif(competitionId: string, signal?: AbortSignal): Promise<Wcif> {
  const res = await fetch(
    `${WCA_ORIGIN}/api/v0/competitions/${encodeURIComponent(competitionId)}/wcif/public`,
    { signal },
  );
  if (!res.ok) {
    throw new Error(`Failed to load competition "${competitionId}" (${res.status})`);
  }
  return (await res.json()) as Wcif;
}
