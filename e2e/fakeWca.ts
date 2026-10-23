import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { sampleWcif } from "../src/test/fixtures/wcif";
import type { Wcif, WcifActivity } from "../src/lib/wca";

/** Stand-in for the WCA website: OAuth, /me, /competitions/mine and the public WCIF. */

export const FAKE_WCA_PORT = 9300;
export const FAKE_WCA = `http://127.0.0.1:${FAKE_WCA_PORT}`;
export const COMP = sampleWcif.id;
export const COMP_NAME = sampleWcif.name;

/** wcaUserIds of the people in the fake comp. Pat only competes, so has no access. */
export const USERS = {
  alice: 1001, // delegate, judges Red
  bob: 1002, // staffs Red
  dave: 1004, // competes on Red, judges Blue
  pat: 1005, // competitor only
} as const;

/** Log in as this to make the WCA token exchange fail. */
export const WCA_DOWN = 0;

/** Cookie on the fake WCA origin picking who "logs in"; set it with `loginAs`. */
export const USER_COOKIE = "wca_user";

const today = () => new Date().toISOString().slice(0, 10);

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The sample comp moved so day 1 is today (UTC), so it's live for both the browser and the functions. */
function wcifToday(): Wcif {
  const wcif = structuredClone(sampleWcif);
  const offset = Date.parse(today()) - Date.parse(wcif.schedule.startDate);
  const shift = (iso: string) => new Date(Date.parse(iso) + offset).toISOString();
  const move = (a: WcifActivity) => {
    a.startTime = shift(a.startTime);
    a.endTime = shift(a.endTime);
    a.childActivities.forEach(move);
  };
  wcif.schedule.startDate = today();
  wcif.schedule.venues.forEach((v) => v.rooms.forEach((r) => r.activities.forEach(move)));
  // No requests to the real avatar CDN.
  for (const p of wcif.persons) p.avatar = null;
  wcif.persons.push({
    registrantId: 5,
    name: "Pat Player",
    wcaUserId: USERS.pat,
    wcaId: null,
    countryIso2: "CA",
    roles: [],
    assignments: [{ activityId: 101, assignmentCode: "competitor", stationNumber: null }],
    avatar: null,
  });
  return wcif;
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Content-Type": "application/json",
  });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

function cookie(req: IncomingMessage, name: string): string | undefined {
  return req.headers.cookie
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === name)?.[1];
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

/** "token-1002" → the person with wcaUserId 1002. */
function personFor(wcif: Wcif, token: string | undefined) {
  const id = Number(token?.split("-")[1]);
  return wcif.persons.find((p) => p.wcaUserId === id);
}

async function handle(wcif: Wcif, req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", FAKE_WCA);
  if (req.method === "OPTIONS") return send(res, 204);

  if (url.pathname === "/oauth/authorize") {
    const back = new URL(url.searchParams.get("redirect_uri") ?? "");
    back.searchParams.set("code", `code-${cookie(req, USER_COOKIE) ?? USERS.alice}`);
    back.searchParams.set("state", url.searchParams.get("state") ?? "");
    res.writeHead(302, { Location: back.toString() }).end();
    return;
  }
  if (url.pathname === "/oauth/token" && req.method === "POST") {
    const code = new URLSearchParams(await readBody(req)).get("code");
    if (code === `code-${WCA_DOWN}`) return send(res, 503, { error: "maintenance" });
    if (!code?.startsWith("code-")) return send(res, 400, { error: "invalid_grant" });
    return send(res, 200, { access_token: code.replace("code-", "token-") });
  }

  const person = personFor(wcif, req.headers.authorization?.replace("Bearer ", ""));
  if (url.pathname === "/api/v0/me") {
    if (!person) return send(res, 401, { error: "unauthorized" });
    return send(res, 200, { me: { id: person.wcaUserId, name: person.name } });
  }
  if (url.pathname === "/api/v0/competitions/mine") {
    if (!person) return send(res, 401, { error: "unauthorized" });
    return send(res, 200, {
      future_competitions: [
        { id: COMP, name: COMP_NAME, start_date: wcif.schedule.startDate, end_date: addDays(wcif.schedule.startDate, 1) },
      ],
      past_competitions: [],
    });
  }
  if (url.pathname === `/api/v0/competitions/${COMP}/wcif/public`) return send(res, 200, wcif);
  if (/^\/api\/v0\/competitions\/[^/]+\/wcif\/public$/.test(url.pathname)) {
    return send(res, 404, { error: "Competition not found" });
  }
  send(res, 404, { error: `fake WCA has no route for ${req.method} ${url.pathname}` });
}

export function startFakeWca(): Promise<Server> {
  // Built once so a run crossing UTC midnight keeps one schedule.
  const wcif = wcifToday();
  const server = createServer((req, res) => {
    handle(wcif, req, res).catch((err) => send(res, 500, { error: String(err) }));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject).listen(FAKE_WCA_PORT, "127.0.0.1", () => resolve(server));
  });
}
