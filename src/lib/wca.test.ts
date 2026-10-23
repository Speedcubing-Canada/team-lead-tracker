import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildWcaAuthorizeUrl, fetchPublicWcif } from "./wca";

const wcif = { id: "Comp2026" };
const wcaUrl = /\/api\/v0\/competitions\/Comp2026\/wcif\/public$/;

function stubFetch(...responses: (() => Response | Promise<Response>)[]) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => responses.shift()!());
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fetchPublicWcif in production", () => {
  beforeEach(() => vi.stubEnv("DEV", false));

  it("uses the same-origin proxy", async () => {
    const fetch = stubFetch(() => Response.json(wcif));
    await expect(fetchPublicWcif("Comp2026")).resolves.toEqual(wcif);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe("/api/wcif/Comp2026");
  });

  it("falls back to WCA when the proxy fails or is unreachable", async () => {
    let fetch = stubFetch(() => new Response("", { status: 502 }), () => Response.json(wcif));
    await expect(fetchPublicWcif("Comp2026")).resolves.toEqual(wcif);
    expect(fetch.mock.calls[1]![0]).toMatch(wcaUrl);

    fetch = stubFetch(() => Promise.reject(new TypeError("network")), () => Response.json(wcif));
    await expect(fetchPublicWcif("Comp2026")).resolves.toEqual(wcif);
    expect(fetch.mock.calls[1]![0]).toMatch(wcaUrl);
  });

  it("rethrows an abort without falling back", async () => {
    const controller = new AbortController();
    const fetch = stubFetch(() => {
      controller.abort();
      return Promise.reject(new DOMException("aborted", "AbortError"));
    });
    await expect(fetchPublicWcif("Comp2026", controller.signal)).rejects.toThrow("aborted");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("fetchPublicWcif in dev", () => {
  it("goes straight to WCA and reports the status on failure", async () => {
    const fetch = stubFetch(() => new Response("", { status: 404 }));
    await expect(fetchPublicWcif("Comp2026")).rejects.toThrow('Failed to load competition "Comp2026" (404)');
    expect(fetch.mock.calls[0]![0]).toMatch(wcaUrl);
  });
});

describe("buildWcaAuthorizeUrl", () => {
  it("redirects back to the origin the app was loaded from", () => {
    vi.stubEnv("VITE_WCA_CLIENT_ID", "client-id");
    const url = new URL(buildWcaAuthorizeUrl("xyz"));
    expect(url.pathname).toBe("/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "client-id",
      redirect_uri: `${window.location.origin}/auth/callback`,
      response_type: "code",
      scope: "public",
      state: "xyz",
    });
  });
});
