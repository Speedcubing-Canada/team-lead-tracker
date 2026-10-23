import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { authWithWca, grantCompetitionAccess, wcif } from "./index.js";

const COMP = "FnComp2026";

const rawWcif = {
  formatVersion: "1.0",
  id: COMP,
  name: "Functions Championship",
  persons: [
    { registrantId: 1, name: "Del", wcaUserId: 1001, roles: ["delegate"], assignments: [] },
    {
      registrantId: 2,
      name: "Staffer",
      wcaUserId: 1002,
      roles: [],
      assignments: [{ activityId: 101, assignmentCode: "staff-judge" }],
    },
    {
      registrantId: 3,
      name: "Comp",
      wcaUserId: 1003,
      roles: [],
      assignments: [{ activityId: 101, assignmentCode: "competitor" }],
    },
  ],
  events: [],
  schedule: { startDate: "2026-07-01", numberOfDays: 1, venues: [] },
  extensions: ["dropped by slimWcif"],
};

/** Stub WCA: routes by path; anything else is a test bug. */
function stubWca(routes: Record<string, () => Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      const route = routes[path];
      if (!route) throw new Error(`unexpected fetch ${path}`);
      return route();
    }),
  );
}

const json = (body: unknown, status = 200) => () => Response.json(body, { status });
const wcifPath = (id = COMP) => `/api/v0/competitions/${id}/wcif/public`;

function callable<T>(data: T, auth?: { uid: string; token: Record<string, unknown> }) {
  return { data, auth, rawRequest: {} } as unknown as CallableRequest<T>;
}

let uidSeq = 0;
async function signedIn(wcaUserId: number, claims: Record<string, unknown> = {}) {
  const uid = `wca:${wcaUserId}:${++uidSeq}`;
  await getAuth().createUser({ uid });
  if (Object.keys(claims).length) await getAuth().setCustomUserClaims(uid, claims);
  return { uid, token: { wcaUserId, name: "Test User" } };
}

beforeEach(() => {
  process.env["WCA_CLIENT_ID"] = "client-id";
  process.env["WCA_CLIENT_SECRET"] = "client-secret";
});

afterEach(() => vi.unstubAllGlobals());

describe("authWithWca", () => {
  it("rejects a call without code and redirectUri", async () => {
    await expect(authWithWca.run(callable({ code: "c" }))).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("fails cleanly when WCA_CLIENT_ID isn't configured", async () => {
    delete process.env["WCA_CLIENT_ID"];
    await expect(
      authWithWca.run(callable({ code: "c", redirectUri: "http://x/cb" })),
    ).rejects.toMatchObject({ code: "failed-precondition" });
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

    const res = await authWithWca.run(callable({ code: "c", redirectUri: "http://x/cb" }));

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
    const res = await authWithWca.run(callable({ code: "c", redirectUri: "http://x/cb" }));
    expect(res.competitions).toEqual([]);
  });

  it("surfaces a failed token exchange", async () => {
    stubWca({ "/oauth/token": json({ error: "invalid_grant" }, 401) });
    await expect(
      authWithWca.run(callable({ code: "bad", redirectUri: "http://x/cb" })),
    ).rejects.toThrow("WCA token exchange failed (401)");
  });
});

describe("grantCompetitionAccess", () => {
  const grant = (auth?: { uid: string; token: Record<string, unknown> }, competitionId = COMP) =>
    grantCompetitionAccess.run(callable({ competitionId }, auth));

  it("requires sign-in, a WCA claim, and a competition id", async () => {
    await expect(grant()).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(grant({ uid: "u", token: {} })).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(grant(await signedIn(1001), "")).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("returns not-found for a competition WCA doesn't know", async () => {
    stubWca({ [wcifPath("Nope2099")]: json({}, 404) });
    await expect(grant(await signedIn(1001), "Nope2099")).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("denies a plain competitor and writes nothing", async () => {
    stubWca({ [wcifPath()]: json(rawWcif) });
    const user = await signedIn(1003);
    await expect(grant(user)).rejects.toMatchObject({ code: "permission-denied" });
    const member = await getFirestore().doc(`competitions/${COMP}/members/${user.uid}`).get();
    expect(member.exists).toBe(false);
    expect((await getAuth().getUser(user.uid)).customClaims).toBeUndefined();
  });

  it("rejects a competition id that isn't alphanumeric", async () => {
    await expect(grant(await signedIn(1001), "a/b")).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("grants a delegate privileged access: membership doc, comp doc, claims, slim WCIF", async () => {
    stubWca({ [wcifPath()]: json(rawWcif) });
    const user = await signedIn(1001, { comps: { Older2025: true } });

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
    expect((await getAuth().getUser(user.uid)).customClaims).toEqual({
      comps: { Older2025: true, [COMP]: true },
      privilegedComps: { [COMP]: true },
    });
  });

  it("grants staff non-privileged access and drops a stale privileged claim", async () => {
    stubWca({ [wcifPath()]: json(rawWcif) });
    const user = await signedIn(1002, {
      comps: { [COMP]: true, Other2026: true },
      privilegedComps: { [COMP]: true, Other2026: true },
    });

    const res = await grant(user);

    expect(res.privileged).toBe(false);
    expect((await getAuth().getUser(user.uid)).customClaims).toEqual({
      comps: { [COMP]: true, Other2026: true },
      privilegedComps: { Other2026: true },
    });
  });
});

describe("wcif proxy", () => {
  function fakeRes() {
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      set(name: string, value: string) {
        res.headers[name] = value;
        return res;
      },
      json(body: unknown) {
        res.body = body;
      },
      end(body: unknown) {
        res.body = body;
      },
    };
    return res;
  }

  async function get(path: string, acceptEncoding = "") {
    const res = fakeRes();
    await (wcif as unknown as (req: unknown, res: unknown) => Promise<void>)(
      { path, headers: { "accept-encoding": acceptEncoding } },
      res,
    );
    return res;
  }

  it("rejects a missing competition id", async () => {
    expect((await get("/")).statusCode).toBe(400);
  });

  it("maps an unknown competition to 404 and other WCA failures to 502", async () => {
    stubWca({ [wcifPath("Nope2099")]: json({}, 404), [wcifPath("Down2026")]: json({}, 503) });
    expect((await get("/api/wcif/Nope2099")).statusCode).toBe(404);
    expect((await get("/api/wcif/Down2026")).statusCode).toBe(502);
  });

  it("serves the slim WCIF gzipped with CDN cache headers", async () => {
    stubWca({ [wcifPath()]: json(rawWcif) });
    const res = await get(`/api/wcif/${COMP}`, "gzip, br");

    expect(res.headers).toMatchObject({
      "Content-Encoding": "gzip",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      Vary: "Accept-Encoding",
    });
    const body = JSON.parse(gunzipSync(res.body as Buffer).toString());
    expect(body.id).toBe(COMP);
    expect(body).not.toHaveProperty("extensions");
  });

  it("serves plain JSON to clients that don't accept gzip", async () => {
    stubWca({ [wcifPath()]: json(rawWcif) });
    const res = await get(`/api/wcif/${COMP}`);
    expect(res.headers).not.toHaveProperty("Content-Encoding");
    expect(JSON.parse(res.body as string).id).toBe(COMP);
  });
});
