import { gzipSync } from "node:zlib";
import { HttpsError } from "firebase-functions/v2/https";
import { fetchPublicWcif } from "./wca.js";

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: string | Buffer;
}

const JSON_TYPE = "application/json; charset=utf-8";

const error = (status: number, message: string): ProxyResponse => ({
  status,
  headers: { "Content-Type": JSON_TYPE },
  body: JSON.stringify({ error: message }),
});

/**
 * The public WCIF, slimmed to the fields the client uses and gzipped ourselves:
 * Hosting only auto-compresses static assets, and its CDN edge-caches the result.
 */
export async function wcifResponse(path: string, acceptEncoding: string): Promise<ProxyResponse> {
  const competitionId = path.split("/").filter(Boolean).pop();
  if (!competitionId) return error(400, "Missing competition id");

  let body: string;
  try {
    body = JSON.stringify(await fetchPublicWcif(decodeURIComponent(competitionId)));
  } catch (err) {
    if (err instanceof HttpsError && err.code === "not-found") return error(404, err.message);
    return error(502, `Failed to load competition "${competitionId}"`);
  }

  const headers = {
    "Cache-Control": "public, max-age=300, s-maxage=300",
    "Content-Type": JSON_TYPE,
    Vary: "Accept-Encoding",
  };
  if (!acceptEncoding.includes("gzip")) return { status: 200, headers, body };
  return { status: 200, headers: { ...headers, "Content-Encoding": "gzip" }, body: gzipSync(body) };
}
