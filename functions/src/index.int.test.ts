import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { authWithWca, grantCompetitionAccess } from "./index.js";
import { COMP, json, rawWcif, stubWca, wcifPath } from "./test/wca.js";

type Caller = { uid: string; token: Record<string, unknown> };

function callable<T>(data: T, auth?: Caller) {
  return { data, auth, rawRequest: {} } as unknown as CallableRequest<T>;
}

let uidSeq = 0;
/** A fresh Auth emulator user signed in with the WCA identity claims authWithWca mints. */
async function createUser(wcaUserId: number, claims: Record<string, unknown> = {}): Promise<Caller> {
  const uid = `wca:${wcaUserId}:${++uidSeq}`;
  await getAuth().createUser({ uid });
  if (Object.keys(claims).length) await getAuth().setCustomUserClaims(uid, claims);
  return { uid, token: { wcaUserId, name: "Test User" } };
}

const claimsOf = async (user: Caller) => (await getAuth().getUser(user.uid)).customClaims;

beforeEach(() => {
  vi.stubEnv("WCA_CLIENT_ID", "client-id");
  vi.stubEnv("WCA_CLIENT_SECRET", "client-secret");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("authWithWca", () => {
  const login = () => authWithWca.run(callable({ code: "c", redirectUri: "http://x/cb" }));

  it("rejects a call without code and redirectUri", async () => {
    await expect(authWithWca.run(callable({ code: "c" }))).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("fails cleanly when WCA_CLIENT_ID isn't configured", async () => {
    vi.stubEnv("WCA_CLIENT_ID", undefined);
    await expect(login()).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("mints a custom token carrying the WCA identity and returns the user's comps", async () => {
    stubWca({
      "/oauth/token": json({ access_token: "at" }),
      "/api/v0/me": json({ me: { id: 1001, name: "Del" } }),
      "/api/v0/competitions/mine": json({
        future_competitions: [
          { id: "Later2099", name: "Later", start_date: "2099-01-01", end_date: "2099-01-02" },
        ],
      }),
    });

    const res = await login();

    const payload = JSON.parse(Buffer.from(res.token.split(".")[1]!, "base64url").toString());
    expect(payload).toMatchObject({ uid: "wca:1001", claims: { wcaUserId: 1001, name: "Del" } });
    expect(res.competitions.map((c) => c.id)).toEqual(["Later2099"]);
  });

  it("still signs in when the competitions lookup fails", async () => {
    stubWca({
      "/oauth/token": json({ access_token: "at" }),
      "/api/v0/me": json({ me: { id: 1001, name: "Del" } }),
      "/api/v0/competitions/mine": json({}, 500),
    });
    expect((await login()).competitions).toEqual([]);
  });

  it("surfaces a failed token exchange", async () => {
    stubWca({ "/oauth/token": json({ error: "invalid_grant" }, 401) });
    await expect(login()).rejects.toThrow("WCA token exchange failed (401)");
  });
});

describe("grantCompetitionAccess", () => {
  const grant = (auth?: Caller, competitionId = COMP) =>
    grantCompetitionAccess.run(callable({ competitionId }, auth));

  it("requires sign-in", async () => {
    await expect(grant()).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("requires a WCA identity claim", async () => {
    await expect(grant({ uid: "u", token: {} })).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("requires an alphanumeric competition id", async () => {
    const user = await createUser(1001);
    await expect(grant(user, "")).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(grant(user, "a/b")).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("returns not-found for a competition WCA doesn't know", async () => {
    stubWca({ [wcifPath("Nope2099")]: json({}, 404) });
    await expect(grant(await createUser(1001), "Nope2099")).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("denies a plain competitor and grants nothing", async () => {
    stubWca({ [wcifPath()]: json(rawWcif) });
    const user = await createUser(1003);
    await expect(grant(user)).rejects.toMatchObject({ code: "permission-denied" });
    const member = await getFirestore().doc(`competitions/${COMP}/members/${user.uid}`).get();
    expect(member.exists).toBe(false);
    expect(await claimsOf(user)).toBeUndefined();
  });

  it("grants a delegate privileged access: membership doc, comp doc, claims, slim WCIF", async () => {
    stubWca({ [wcifPath()]: json(rawWcif) });
    const user = await createUser(1001, { comps: { Older2025: true } });

    const res = await grant(user);

    expect(res).toMatchObject({ ok: true, competitionName: "Functions Championship", privileged: true });
    expect(res.wcif).not.toHaveProperty("extensions");
    const db = getFirestore();
    expect((await db.doc(`competitions/${COMP}`).get()).data()).toMatchObject({
      name: "Functions Championship",
    });
    expect((await db.doc(`competitions/${COMP}/members/${user.uid}`).get()).data()).toMatchObject({
      wcaUserId: 1001,
      privileged: true,
    });
    expect(await claimsOf(user)).toEqual({
      comps: { Older2025: true, [COMP]: true },
      privilegedComps: { [COMP]: true },
    });
  });

  it("grants staff non-privileged access", async () => {
    stubWca({ [wcifPath()]: json(rawWcif) });
    const user = await createUser(1002, { comps: { [COMP]: true }, privilegedComps: { [COMP]: true } });

    expect((await grant(user)).privileged).toBe(false);
    expect(await claimsOf(user)).toEqual({ comps: { [COMP]: true }, privilegedComps: {} });
  });

  it("keys access on WCA's canonical id when the caller types another casing", async () => {
    const typed = COMP.toLowerCase();
    stubWca({ [wcifPath(typed)]: json(rawWcif) });
    const user = await createUser(1001);

    await grant(user, typed);

    expect(await claimsOf(user)).toEqual({ comps: { [COMP]: true }, privilegedComps: { [COMP]: true } });
    expect((await getFirestore().doc(`competitions/${COMP}/members/${user.uid}`).get()).exists).toBe(true);
    expect((await getFirestore().doc(`competitions/${typed}`).get()).exists).toBe(false);
  });

  it("refuses a WCA id that isn't safe as a path segment", async () => {
    stubWca({ [wcifPath()]: json({ ...rawWcif, id: "a/b" }) });
    await expect(grant(await createUser(1001))).rejects.toMatchObject({ code: "internal" });
  });
});
