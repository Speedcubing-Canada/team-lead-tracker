/** Server-side WCA OAuth + API calls used by the auth functions. */

import type { AccessWcif } from "./access.js";
import {
  mergeMyCompetitions,
  partitionByOngoing,
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
 * comps and, unlike /me, includes delegated/organized ones). Works with the
 * `public` scope. Best-effort: returns [] on failure so a transient error never
 * blocks login (manual entry remains available).
 */
export async function fetchMyCompetitions(accessToken: string): Promise<MyCompetition[]> {
  try {
    const res = await fetch(`${WCA_ORIGIN}/api/v0/competitions/mine`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { future_competitions?: RawCompetition[] };
    const today = new Date().toISOString().slice(0, 10);
    const { ongoing, upcoming } = partitionByOngoing(data.future_competitions ?? [], today);
    return mergeMyCompetitions(ongoing, upcoming);
  } catch {
    return [];
  }
}

/** Public WCIF (only the fields the access check needs). */
export async function fetchPublicWcif(competitionId: string): Promise<AccessWcif & { name?: string }> {
  const res = await fetch(
    `${WCA_ORIGIN}/api/v0/competitions/${encodeURIComponent(competitionId)}/wcif/public`,
  );
  if (!res.ok) throw new Error(`Failed to load competition "${competitionId}" (${res.status})`);
  return (await res.json()) as AccessWcif & { name?: string };
}
