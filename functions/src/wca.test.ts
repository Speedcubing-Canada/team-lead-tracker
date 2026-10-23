import { afterEach, describe, expect, it, vi } from "vitest";
import {
  exchangeCodeForToken,
  fetchMyCompetitions,
  fetchPublicWcif,
  fetchWcaIdentity,
} from "./wca.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubFetch(response: () => Response | Promise<Response>) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => response());
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("exchangeCodeForToken", () => {
  it("posts the authorization code as a confidential client and returns the access token", async () => {
    const fetch = stubFetch(() => Response.json({ access_token: "at" }));

    await expect(exchangeCodeForToken("code", "http://x/cb", "id", "secret")).resolves.toBe("at");

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toMatch(/\/oauth\/token$/);
    expect(Object.fromEntries(init!.body as URLSearchParams)).toEqual({
      grant_type: "authorization_code",
      code: "code",
      redirect_uri: "http://x/cb",
      client_id: "id",
      client_secret: "secret",
    });
  });

  it("throws on a non-OK response or a missing token", async () => {
    stubFetch(() => new Response("", { status: 401 }));
    await expect(exchangeCodeForToken("c", "r", "i", "s")).rejects.toThrow("(401)");
    stubFetch(() => Response.json({}));
    await expect(exchangeCodeForToken("c", "r", "i", "s")).rejects.toThrow("no access_token");
  });
});

describe("fetchWcaIdentity", () => {
  it("sends the bearer token and maps /me to an identity", async () => {
    const fetch = stubFetch(() => Response.json({ me: { id: 7, name: "Lead" } }));
    await expect(fetchWcaIdentity("at")).resolves.toEqual({ wcaUserId: 7, name: "Lead" });
    expect(fetch.mock.calls[0]![1]?.headers).toEqual({ Authorization: "Bearer at" });
  });

  it("defaults a missing name and rejects a missing id or failed call", async () => {
    stubFetch(() => Response.json({ me: { id: 7 } }));
    await expect(fetchWcaIdentity("at")).resolves.toEqual({ wcaUserId: 7, name: "Unknown" });
    stubFetch(() => Response.json({ me: {} }));
    await expect(fetchWcaIdentity("at")).rejects.toThrow("no user id");
    stubFetch(() => new Response("", { status: 500 }));
    await expect(fetchWcaIdentity("at")).rejects.toThrow("(500)");
  });
});

describe("fetchMyCompetitions", () => {
  it("merges ongoing, upcoming, and recently-ended competitions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    stubFetch(() =>
      Response.json({
        future_competitions: [
          { id: "Soon", name: "Soon", start_date: "2026-08-01", end_date: "2026-08-02" },
          { id: "Live", name: "Live", start_date: "2026-07-09", end_date: "2026-07-11" },
        ],
        past_competitions: [
          { id: "Recent", name: "Recent", start_date: "2026-07-04", end_date: "2026-07-05" },
          { id: "Ancient", name: "Ancient", start_date: "2020-01-01", end_date: "2020-01-02" },
        ],
      }),
    );

    const comps = await fetchMyCompetitions("at");

    expect(comps.map((c) => [c.id, c.ongoing])).toEqual([
      ["Live", true],
      ["Soon", false],
      ["Recent", false],
    ]);
  });

  it("returns [] instead of failing login when WCA errors or is unreachable", async () => {
    stubFetch(() => new Response("", { status: 503 }));
    await expect(fetchMyCompetitions("at")).resolves.toEqual([]);
    stubFetch(() => Promise.reject(new TypeError("network")));
    await expect(fetchMyCompetitions("at")).resolves.toEqual([]);
  });
});

describe("fetchPublicWcif", () => {
  it("maps a WCA 404 to a not-found HttpsError", async () => {
    stubFetch(() => new Response("", { status: 404 }));
    await expect(fetchPublicWcif("FakeComp2099")).rejects.toMatchObject({ code: "not-found" });
  });

  it("throws a plain error with the status for other failures", async () => {
    stubFetch(() => new Response("", { status: 503 }));
    await expect(fetchPublicWcif("Down2026")).rejects.toThrow('"Down2026" (503)');
  });

  it("url-encodes the competition id", async () => {
    const fetch = stubFetch(() => new Response("", { status: 404 }));
    await fetchPublicWcif("a/b").catch(() => {});
    expect(fetch.mock.calls[0]![0]).toContain("/competitions/a%2Fb/wcif/public");
  });
});
