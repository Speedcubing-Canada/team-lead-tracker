import { vi } from "vitest";

export const COMP = "FnComp2026";

export const rawWcif = {
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

type Route = () => Response | Promise<Response>;

/** Stub WCA: routes by path; anything else is a test bug. */
export function stubWca(routes: Record<string, Route>) {
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
    const path = new URL(url).pathname;
    const route = routes[path];
    if (!route) throw new Error(`unexpected fetch ${path}`);
    return route();
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

export const json = (body: unknown, status = 200) => () => Response.json(body, { status });
export const wcifPath = (id = COMP) => `/api/v0/competitions/${encodeURIComponent(id)}/wcif/public`;
