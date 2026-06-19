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
  /** WCA profile photo. Present in the public WCIF; null when the person has none. */
  avatar: { url: string; thumbUrl: string } | null;
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

/** A competition the signed-in user is involved in (from the WCA /me endpoint). */
export interface MyCompetition {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  ongoing: boolean;
}

const WCA_ORIGIN = import.meta.env?.VITE_WCA_ORIGIN ?? "https://www.worldcubeassociation.org";

/** Public WCA profile page for a person, e.g. .../persons/2015ANDE01. */
export function wcaProfileUrl(wcaId: string): string {
  return `${WCA_ORIGIN}/persons/${wcaId}`;
}

/**
 * The OAuth redirect URI for the *current* origin (custom domain, web.app, or localhost).
 * Deriving it at runtime keeps the authorize and token-exchange redirect_uri identical on
 * whatever domain the user loaded the app from. Falls back to the env var when window is
 * unavailable (tests/SSR).
 */
export function wcaRedirectUri(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  return import.meta.env.VITE_WCA_REDIRECT_URI;
}

/** Build the WCA OAuth authorize URL to redirect the browser to (scope: public). */
export function buildWcaAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_WCA_CLIENT_ID,
    redirect_uri: wcaRedirectUri(),
    response_type: "code",
    scope: "public",
    state,
  });
  return `${WCA_ORIGIN}/oauth/authorize?${params.toString()}`;
}

/**
 * Fetch the public WCIF (unauthenticated; assignments and roles are public).
 *
 * In production we hit our same-origin `/api/wcif/:id` proxy, which returns a
 * slimmed WCIF that Firebase Hosting gzips and CDN-caches (~45× smaller than
 * WCA's uncompressed payload). In dev there's no Hosting rewrite, so we go
 * straight to WCA.
 */
export async function fetchPublicWcif(competitionId: string, signal?: AbortSignal): Promise<Wcif> {
  const url = import.meta.env?.DEV
    ? `${WCA_ORIGIN}/api/v0/competitions/${encodeURIComponent(competitionId)}/wcif/public`
    : `/api/wcif/${encodeURIComponent(competitionId)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to load competition "${competitionId}" (${res.status})`);
  }
  return (await res.json()) as Wcif;
}
