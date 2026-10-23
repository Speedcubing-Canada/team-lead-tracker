import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { wcifResponse } from "./wcifProxy.js";
import { COMP, json, rawWcif, stubWca, wcifPath } from "./test/wca.js";

afterEach(() => vi.unstubAllGlobals());

describe("wcifResponse", () => {
  it("rejects a missing competition id", async () => {
    expect((await wcifResponse("/", "")).status).toBe(400);
  });

  it("maps an unknown competition to 404", async () => {
    stubWca({ [wcifPath("Nope2099")]: json({}, 404) });
    expect((await wcifResponse("/api/wcif/Nope2099", "")).status).toBe(404);
  });

  it("maps other WCA failures to 502", async () => {
    stubWca({ [wcifPath("Down2026")]: json({}, 503) });
    expect((await wcifResponse("/api/wcif/Down2026", "")).status).toBe(502);
  });

  it("serves the slim WCIF gzipped with CDN cache headers", async () => {
    stubWca({ [wcifPath()]: json(rawWcif) });
    const res = await wcifResponse(`/api/wcif/${COMP}`, "gzip, br");

    expect(res.headers).toMatchObject({
      "Content-Encoding": "gzip",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      Vary: "Accept-Encoding",
    });
    const body = JSON.parse(gunzipSync(res.body).toString());
    expect(body.id).toBe(COMP);
    expect(body).not.toHaveProperty("extensions");
  });

  it("serves plain JSON to clients that don't accept gzip", async () => {
    stubWca({ [wcifPath()]: json(rawWcif) });
    const res = await wcifResponse(`/api/wcif/${COMP}`, "");
    expect(res.headers).not.toHaveProperty("Content-Encoding");
    expect(JSON.parse(res.body.toString()).id).toBe(COMP);
  });
});
