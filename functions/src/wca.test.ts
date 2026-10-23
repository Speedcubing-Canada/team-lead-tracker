import { afterEach, describe, expect, it, vi } from "vitest";
import {
  exchangeCodeForToken,
  fetchMyCompetitions,
  fetchPublicWcif,
  fetchWcaIdentity,
} from "./wca.js";
import { json, stubWca, wcifPath } from "./test/wca.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("exchangeCodeForToken", () => {
  it("posts the authorization code as a confidential client and returns the access token", async () => {
    const fetch = stubWca({ "/oauth/token": json({ access_token: "at" }) });

    await expect(exchangeCodeForToken("code", "http://x/cb", "id", "secret")).resolves.toBe("at");

    expect(Object.fromEntries(fetch.mock.calls[0]![1]!.body as URLSearchParams)).toEqual({
      grant_type: "authorization_code",
      code: "code",
      redirect_uri: "http://x/cb",
      client_id: "id",
      client_secret: "secret",
    });
  });

  it("throws with the status on a non-OK response", async () => {
    stubWca({ "/oauth/token": json({}, 401) });
    await expect(exchangeCodeForToken("c", "r", "i", "s")).rejects.toThrow("(401)");
  });

  it("throws when the response has no token", async () => {
    stubWca({ "/oauth/token": json({}) });
    await expect(exchangeCodeForToken("c", "r", "i", "s")).rejects.toThrow("no access_token");
  });
});

describe("fetchWcaIdentity", () => {
  it("sends the bearer token and maps /me to an identity", async () => {
    const fetch = stubWca({ "/api/v0/me": json({ me: { id: 7, name: "Lead" } }) });
    await expect(fetchWcaIdentity("at")).resolves.toEqual({ wcaUserId: 7, name: "Lead" });
    expect(fetch.mock.calls[0]![1]?.headers).toEqual({ Authorization: "Bearer at" });
  });

  it("defaults a missing name", async () => {
    stubWca({ "/api/v0/me": json({ me: { id: 7 } }) });
    await expect(fetchWcaIdentity("at")).resolves.toEqual({ wcaUserId: 7, name: "Unknown" });
  });

  it("rejects a response without a user id", async () => {
    stubWca({ "/api/v0/me": json({ me: {} }) });
    await expect(fetchWcaIdentity("at")).rejects.toThrow("no user id");
  });

  it("throws with the status on a failed call", async () => {
    stubWca({ "/api/v0/me": json({}, 500) });
    await expect(fetchWcaIdentity("at")).rejects.toThrow("(500)");
  });
});

describe("fetchMyCompetitions", () => {
  it("merges ongoing, upcoming, and recently-ended competitions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    stubWca({
      "/api/v0/competitions/mine": json({
        future_competitions: [
          { id: "Soon", name: "Soon", start_date: "2026-08-01", end_date: "2026-08-02" },
          { id: "Live", name: "Live", start_date: "2026-07-09", end_date: "2026-07-11" },
        ],
        past_competitions: [
          { id: "Recent", name: "Recent", start_date: "2026-07-04", end_date: "2026-07-05" },
          { id: "Ancient", name: "Ancient", start_date: "2020-01-01", end_date: "2020-01-02" },
        ],
      }),
    });

    const comps = await fetchMyCompetitions("at");

    expect(comps.map((c) => [c.id, c.ongoing])).toEqual([
      ["Live", true],
      ["Soon", false],
      ["Recent", false],
    ]);
  });

  it("returns [] instead of failing login when WCA errors", async () => {
    stubWca({ "/api/v0/competitions/mine": json({}, 503) });
    await expect(fetchMyCompetitions("at")).resolves.toEqual([]);
  });

  it("returns [] instead of failing login when WCA is unreachable", async () => {
    stubWca({ "/api/v0/competitions/mine": () => Promise.reject(new TypeError("network")) });
    await expect(fetchMyCompetitions("at")).resolves.toEqual([]);
  });
});

describe("fetchPublicWcif", () => {
  it("maps a WCA 404 to a not-found HttpsError", async () => {
    stubWca({ [wcifPath("FakeComp2099")]: json({}, 404) });
    await expect(fetchPublicWcif("FakeComp2099")).rejects.toMatchObject({ code: "not-found" });
  });

  it("throws a plain error with the status for other failures", async () => {
    stubWca({ [wcifPath("Down2026")]: json({}, 503) });
    await expect(fetchPublicWcif("Down2026")).rejects.toThrow('"Down2026" (503)');
  });

  it("url-encodes the competition id", async () => {
    stubWca({ "/api/v0/competitions/a%2Fb/wcif/public": json({}, 404) });
    await expect(fetchPublicWcif("a/b")).rejects.toMatchObject({ code: "not-found" });
  });
});
