import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicWcif } from "./wca";

afterEach(() => vi.unstubAllGlobals());

describe("fetchPublicWcif", () => {
  it("maps a WCA 404 to a not-found HttpsError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(fetchPublicWcif("FakeComp2099")).rejects.toMatchObject({ code: "not-found" });
  });
});
