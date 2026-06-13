import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { MyCompetition } from "./wca";

/** Exchange a WCA OAuth code for a Firebase custom token + the user's competitions. */
export async function authWithWca(
  code: string,
  redirectUri: string,
): Promise<{ token: string; competitions: MyCompetition[] }> {
  const fn = httpsCallable<
    { code: string; redirectUri: string },
    { token: string; competitions: MyCompetition[] }
  >(functions(), "authWithWca");
  const res = await fn({ code, redirectUri });
  return res.data;
}

/** Verify and record the signed-in user's access to a competition. Throws if denied. */
export async function grantCompetitionAccess(
  competitionId: string,
): Promise<{ ok: true; competitionName: string | null }> {
  const fn = httpsCallable<{ competitionId: string }, { ok: true; competitionName: string | null }>(
    functions(),
    "grantCompetitionAccess",
  );
  const res = await fn({ competitionId });
  return res.data;
}
