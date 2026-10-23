/**
 * Cloud Functions for WCA-gated access.
 *
 * authWithWca: exchanges a WCA OAuth code for identity and mints a
 *                       Firebase custom token (no competition access yet).
 * grantCompetitionAccess: for the signed-in user, verifies a delegate/organizer/
 *                       staff role in the competition's WCIF and writes the
 *                       membership doc that Firestore rules gate on.
 *
 * The membership doc is written here with the Admin SDK (which bypasses
 * security rules), so clients can never grant themselves access.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { canAccessCompetition, isPrivileged, mergeAccessClaims } from "./access.js";
import type { MyCompetition } from "./competitions.js";
import type { SlimWcif } from "./wcif.js";
import {
  exchangeCodeForToken,
  fetchMyCompetitions,
  fetchPublicWcif,
  fetchWcaIdentity,
} from "./wca.js";
import { wcifResponse } from "./wcifProxy.js";

initializeApp();

const WCA_CLIENT_SECRET = defineSecret("WCA_CLIENT_SECRET");

/** Deterministic Firebase uid for a WCA account. */
function uidForWca(wcaUserId: number): string {
  return `wca:${wcaUserId}`;
}

export const authWithWca = onCall(
  { secrets: [WCA_CLIENT_SECRET] },
  async (request): Promise<{ token: string; competitions: MyCompetition[] }> => {
    const { code, redirectUri } = (request.data ?? {}) as {
      code?: string;
      redirectUri?: string;
    };
    if (!code || !redirectUri) {
      throw new HttpsError("invalid-argument", "code and redirectUri are required");
    }

    const clientId = process.env["WCA_CLIENT_ID"];
    if (!clientId) throw new HttpsError("failed-precondition", "WCA_CLIENT_ID is not configured");

    const accessToken = await exchangeCodeForToken(
      code,
      redirectUri,
      clientId,
      WCA_CLIENT_SECRET.value(),
    );
    const [identity, competitions] = await Promise.all([
      fetchWcaIdentity(accessToken),
      fetchMyCompetitions(accessToken),
    ]);

    const token = await getAuth().createCustomToken(uidForWca(identity.wcaUserId), {
      wcaUserId: identity.wcaUserId,
      name: identity.name,
    });
    return { token, competitions };
  },
);

export const grantCompetitionAccess = onCall(
  async (
    request,
  ): Promise<{
    ok: true;
    competitionName: string | null;
    privileged: boolean;
    wcif: SlimWcif;
  }> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in first");
    }
    const wcaUserId = request.auth.token["wcaUserId"] as number | undefined;
    const name = (request.auth.token["name"] as string | undefined) ?? "Unknown";
    if (typeof wcaUserId !== "number") {
      throw new HttpsError("permission-denied", "Missing WCA identity claim");
    }

    const { competitionId } = (request.data ?? {}) as { competitionId?: string };
    // Used raw as a Firestore path segment and a claims key.
    if (!competitionId || !/^[A-Za-z0-9]+$/.test(competitionId)) {
      throw new HttpsError("invalid-argument", "A valid competitionId is required");
    }

    const wcif = await fetchPublicWcif(competitionId);
    if (!canAccessCompetition(wcif, wcaUserId)) {
      throw new HttpsError(
        "permission-denied",
        "Your WCA account isn't a delegate, organizer, or staff member of this competition.",
      );
    }

    const privileged = isPrivileged(wcif, wcaUserId);

    // Claims, not a cross-service firestore.get (unreliable from Storage rules), gate photos.
    // The client force-refreshes its ID token after this call so they take effect.
    const auth = getAuth();
    const existing = (await auth.getUser(request.auth.uid)).customClaims ?? {};
    await auth.setCustomUserClaims(
      request.auth.uid,
      mergeAccessClaims(existing, competitionId, privileged),
    );

    const db = getFirestore();
    const compRef = db.doc(`competitions/${competitionId}`);
    await compRef.set(
      { name: wcif.name ?? competitionId, fetchedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    await compRef.collection("members").doc(request.auth.uid).set({
      wcaUserId,
      name,
      privileged,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Return the (already-fetched, slimmed) WCIF so the client can seed its
    // TanStack cache and skip a redundant multi-MB download on navigation.
    return { ok: true, competitionName: wcif.name ?? null, privileged, wcif };
  },
);

/** WCIF proxy, reached same-origin via the /api/wcif/** Hosting rewrite. */
export const wcif = onRequest(async (req, res) => {
  const { status, headers, body } = await wcifResponse(req.path, req.headers["accept-encoding"] ?? "");
  res.status(status).set(headers).end(body);
});
