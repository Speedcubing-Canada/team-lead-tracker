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

import { gzipSync } from "node:zlib";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { canAccessCompetition, isPrivileged } from "./access.js";
import type { MyCompetition } from "./competitions.js";
import type { SlimWcif } from "./wcif.js";
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
  ): Promise<{
    ok: true;
    competitionName: string | null;
    privileged: boolean;
    wcif: SlimWcif;
  }> => {
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

    // Accumulate per-competition access into the user's Auth custom claims so
    // Storage rules can gate uploads on the token directly (cross-service
    // firestore.get from Storage rules proved unreliable). `comps` = every
    // competition the user is a member of (read access); `privilegedComps` =
    // those where they're a delegate/organizer (write access). The client
    // force-refreshes its ID token after this call so the claims take effect.
    const auth = getAuth();
    const existing = (await auth.getUser(request.auth.uid)).customClaims ?? {};
    const comps: Record<string, true> = { ...(existing.comps ?? {}), [competitionId]: true };
    const privilegedComps: Record<string, true> = { ...(existing.privilegedComps ?? {}) };
    if (privileged) privilegedComps[competitionId] = true;
    else delete privilegedComps[competitionId];
    await auth.setCustomUserClaims(request.auth.uid, { ...existing, comps, privilegedComps });

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

/**
 * Public WCIF proxy. Fetches the WCA WCIF, slims it to the fields the client
 * uses, gzips it, and returns it with a cache header so Firebase Hosting's CDN
 * edge-caches the (~45× smaller) response. We gzip here ourselves because
 * Hosting only auto-compresses static assets, not dynamic function responses.
 * Used for reloads and routes that don't go through the access-granting flow.
 * Reached via the /api/wcif/** Hosting rewrite, so it's same-origin (no CORS).
 */
export const wcif = onRequest(async (req, res) => {
  const competitionId = req.path.split("/").filter(Boolean).pop();
  if (!competitionId) {
    res.status(400).json({ error: "Missing competition id" });
    return;
  }
  try {
    const slim = await fetchPublicWcif(decodeURIComponent(competitionId));
    const body = JSON.stringify(slim);
    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    res.set("Content-Type", "application/json; charset=utf-8");
    res.set("Vary", "Accept-Encoding");
    if ((req.headers["accept-encoding"] ?? "").includes("gzip")) {
      res.set("Content-Encoding", "gzip");
      res.end(gzipSync(body));
    } else {
      res.end(body);
    }
  } catch {
    res.status(502).json({ error: `Failed to load competition "${competitionId}"` });
  }
});
