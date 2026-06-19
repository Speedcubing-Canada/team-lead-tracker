/** Server-side WCA OAuth + API calls used by the auth functions. */

import { slimWcif, type SlimWcif } from "./wcif.js";
import {
  mergeMyCompetitions,
  partitionByOngoing,
  recentPastCompetitions,
  type MyCompetition,
  type RawCompetition,
} from "./competitions.js";

const WCA_ORIGIN = process.env.WCA_ORIGIN ?? "https://www.worldcubeassociation.org";

export interface WcaIdentity {
  wcaUserId: number;
  name: string;
}

/** Exchange an authorization code for a WCA access token (confidential client). */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch(`${WCA_ORIGIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`WCA token exchange failed (${res.status})`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("WCA token exchange returned no access_token");
  return data.access_token;
}

/** Resolve the WCA identity of the access-token holder. */
export async function fetchWcaIdentity(accessToken: string): Promise<WcaIdentity> {
  const res = await fetch(`${WCA_ORIGIN}/api/v0/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`WCA /me failed (${res.status})`);
  const data = (await res.json()) as { me?: { id?: number; name?: string } };
  if (!data.me?.id) throw new Error("WCA /me returned no user id");
  return { wcaUserId: data.me.id, name: data.me.name ?? "Unknown" };
}

/**
 * Competitions the user is involved in — organizing, delegating, OR registered
 * for — via /competitions/mine (whose `future_competitions` covers not-yet-over
 * comps and `past_competitions` the finished ones; unlike /me, both include
 * delegated/organized comps). Works with the `public` scope. Past comps are
 * capped to the recent window (so a lead can still export reimbursement for a
 * just-finished comp without dragging their whole history along). Best-effort:
 * returns [] on failure so a transient error never blocks login.
 */
export async function fetchMyCompetitions(accessToken: string): Promise<MyCompetition[]> {
  try {
    const res = await fetch(`${WCA_ORIGIN}/api/v0/competitions/mine`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      future_competitions?: RawCompetition[];
      past_competitions?: RawCompetition[];
    };
    const today = new Date().toISOString().slice(0, 10);
    const { ongoing, upcoming } = partitionByOngoing(data.future_competitions ?? [], today);
    const past = recentPastCompetitions(data.past_competitions ?? [], today);
    return mergeMyCompetitions(ongoing, upcoming, past);
  } catch {
    return [];
  }
}

/**
 * Public WCIF, slimmed to the fields the web client uses. Drives both the
 * access check (the slim shape is a superset of AccessWcif) and the WCIF the
 * client renders, so we fetch and project it once.
 */
export async function fetchPublicWcif(competitionId: string): Promise<SlimWcif> {
  const res = await fetch(
    `${WCA_ORIGIN}/api/v0/competitions/${encodeURIComponent(competitionId)}/wcif/public`,
  );
  if (!res.ok) throw new Error(`Failed to load competition "${competitionId}" (${res.status})`);
  return slimWcif(await res.json());
}
