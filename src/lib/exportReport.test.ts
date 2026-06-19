import { describe, expect, it } from "vitest";
import { toCsv, toHtml, toMarkdown, type ReportMeta } from "./exportReport";
import { DEFAULT_TIERS, type StaffTotals } from "./reimbursement";
import type { WcifPerson } from "./wca";

const person = (name: string, wcaId: string | null): WcifPerson => ({
  registrantId: 1,
  name,
  wcaUserId: 1,
  wcaId,
  countryIso2: "CA",
  roles: [],
  assignments: [],
  avatar: null,
});

const rows: StaffTotals[] = [
  {
    person: person("Bob, Brown", null),
    total: 4,
    present: 1,
    absent: 2,
    unknown: 1,
    absentRate: 0.5,
    coverage: 0.75,
  },
  {
    person: person("Alice Anderson", "2015ANDE01"),
    total: 2,
    present: 2,
    absent: 0,
    unknown: 0,
    absentRate: 0,
    coverage: 1,
  },
];

const meta: ReportMeta = {
  competitionName: "Sample Championship 2026",
  dateRange: "Jul 1 – Jul 2, 2026",
  generatedAt: new Date("2026-07-03T12:00:00Z"),
  tiers: DEFAULT_TIERS,
};

describe("toMarkdown", () => {
  it("includes a heading, every person, the unknown column and their tier", () => {
    const md = toMarkdown(rows, meta);
    expect(md).toContain("Sample Championship 2026");
    expect(md).toContain("Bob, Brown");
    expect(md).toContain("Alice Anderson");
    expect(md).toContain("Unknown");
    expect(md).toContain("50%"); // Bob's absent rate
    expect(md).toContain("None"); // Bob's tier (50% > 25)
    expect(md).toContain("Full"); // Alice's tier (0%)
  });
});

describe("toHtml", () => {
  it("is a standalone document with the rows and an unknown explanation", () => {
    const html = toHtml(rows, meta);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("<table");
    expect(html).toContain("Bob, Brown");
    expect(html).toMatch(/unknown/i);
    expect(html).toContain("None");
  });
});

describe("toCsv", () => {
  it("has a header row and one row per person", () => {
    const lines = toCsv(rows, meta).trim().split("\n");
    expect(lines[0]).toContain("Name");
    expect(lines[0]).toContain("Unknown");
    expect(lines).toHaveLength(3); // header + 2 people
  });

  it("quotes fields containing commas", () => {
    const csv = toCsv(rows, meta);
    expect(csv).toContain('"Bob, Brown"');
  });
});
