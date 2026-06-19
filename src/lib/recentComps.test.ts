import { describe, expect, it } from "vitest";
import { recentlyEndedComps, upcomingComps } from "./recentComps";
import type { MyCompetition } from "./wca";

const comp = (id: string, startDate: string, endDate: string, ongoing = false): MyCompetition => ({
  id,
  name: id,
  startDate,
  endDate,
  ongoing,
});

const NOW = new Date("2026-06-18T12:00:00Z");

describe("recentlyEndedComps", () => {
  it("keeps comps that ended within the window, sorted most-recent first", () => {
    const comps = [
      comp("Old", "2026-04-01", "2026-04-02"), // > 30 days ago
      comp("Recent", "2026-06-10", "2026-06-11"), // 7 days ago
      comp("Yesterday", "2026-06-16", "2026-06-17"), // 1 day ago
    ];
    expect(recentlyEndedComps(comps, NOW).map((c) => c.id)).toEqual(["Yesterday", "Recent"]);
  });

  it("excludes ongoing competitions and ones that haven't ended yet", () => {
    const comps = [
      comp("Live", "2026-06-17", "2026-06-19", true),
      comp("Future", "2026-07-01", "2026-07-02"),
      comp("Done", "2026-06-12", "2026-06-13"),
    ];
    expect(recentlyEndedComps(comps, NOW).map((c) => c.id)).toEqual(["Done"]);
  });

  it("honours a custom window length", () => {
    const comps = [comp("TwoWeeks", "2026-06-03", "2026-06-04")];
    expect(recentlyEndedComps(comps, NOW, 7)).toEqual([]);
    expect(recentlyEndedComps(comps, NOW, 30).map((c) => c.id)).toEqual(["TwoWeeks"]);
  });
});

describe("upcomingComps", () => {
  it("keeps ongoing and not-yet-ended comps, drops finished ones", () => {
    const comps = [
      comp("Live", "2026-06-17", "2026-06-19", true),
      comp("Future", "2026-07-01", "2026-07-02"),
      comp("Done", "2026-06-12", "2026-06-13"),
    ];
    expect(upcomingComps(comps, NOW).map((c) => c.id)).toEqual(["Live", "Future"]);
  });

  it("treats a comp ending today as still upcoming (not finished)", () => {
    const comps = [comp("EndsToday", "2026-06-16", "2026-06-18")];
    expect(upcomingComps(comps, NOW).map((c) => c.id)).toEqual(["EndsToday"]);
  });
});
