import { FunctionsError, httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { MyCompetition, Wcif } from "./wca";

/** Calls a Cloud Function, rethrowing errors with the server's own message. */
async function call<Req, Res>(name: string, data: Req): Promise<Res> {
  try {
    return (await httpsCallable<Req, Res>(functions(), name)(data)).data;
  } catch (err) {
    // The SDK appends " [httpStatus]" to every message, which users would see verbatim.
    if (err instanceof FunctionsError) err.message = err.message.replace(/ \[\d+\]$/, "");
    throw err;
  }
}

/** Exchange a WCA OAuth code for a Firebase custom token + the user's competitions. */
export function authWithWca(
  code: string,
  redirectUri: string,
): Promise<{ token: string; competitions: MyCompetition[] }> {
  return call("authWithWca", { code, redirectUri });
}

/**
 * Verify and record the signed-in user's access to a competition. Throws if
 * denied. Returns the slimmed WCIF the function already fetched, so the caller
 * can seed the query cache and avoid a second download.
 */
export function grantCompetitionAccess(
  competitionId: string,
): Promise<{ ok: true; competitionName: string | null; privileged: boolean; wcif: Wcif }> {
  return call("grantCompetitionAccess", { competitionId });
}
