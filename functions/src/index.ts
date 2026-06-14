/**
 * Cloud Functions for WCA-gated access.
 *
 * authWithWca         — exchanges a WCA OAuth code for identity and mints a
 *                       Firebase custom token (no competition access yet).
 * grantCompetitionAccess — for the signed-in user, verifies a delegate/organizer/
 *                       staff role in the competition's WCIF and writes the
 *                       membership doc that Firestore rules gate on.
 *
 * The membership doc is written here with the Admin SDK (which bypasses
 * security rules), so clients can never grant themselves access.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { canAccessCompetition, isPrivileged } from "./access.js";
import type { MyCompetition } from "./competitions.js";
import {
  exchangeCodeForToken,
  fetchMyCompetitions,
  fetchPublicWcif,
  fetchWcaIdentity,
} from "./wca.js";

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

    const clientId = process.env.WCA_CLIENT_ID;
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
  ): Promise<{ ok: true; competitionName: string | null; privileged: boolean }> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in first");
    }
    const wcaUserId = request.auth.token.wcaUserId as number | undefined;
    const name = (request.auth.token.name as string | undefined) ?? "Unknown";
    if (typeof wcaUserId !== "number") {
      throw new HttpsError("permission-denied", "Missing WCA identity claim");
    }

    const { competitionId } = (request.data ?? {}) as { competitionId?: string };
    if (!competitionId) {
      throw new HttpsError("invalid-argument", "competitionId is required");
    }

    const wcif = await fetchPublicWcif(competitionId);
    if (!canAccessCompetition(wcif, wcaUserId)) {
      throw new HttpsError(
        "permission-denied",
        "Your WCA account isn't a delegate, organizer, or staff member of this competition.",
      );
    }

    const privileged = isPrivileged(wcif, wcaUserId);

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

    return { ok: true, competitionName: wcif.name ?? null, privileged };
  },
);
