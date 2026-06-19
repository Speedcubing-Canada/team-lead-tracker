import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIERS,
  reimbursementByPerson,
  tierFor,
  tierTally,
  toneFor,
  type StaffTotals,
} from "./reimbursement";
import { checkDocId, type CheckRecord } from "./checks";
import { sampleWcif } from "../test/fixtures/wcif";

const rec = (status: CheckRecord["status"], note = ""): CheckRecord => ({
  status,
  note,
  updatedByName: "Lead",
  updatedByWcaId: 9,
});

// All groups have started well before this instant.
const AFTER = new Date("2026-07-03T00:00:00Z");

function row(rows: ReturnType<typeof reimbursementByPerson>, name: string) {
  const r = rows.find((x) => x.person.name === name);
  if (!r) throw new Error(`no row for ${name}`);
  return r;
}

describe("reimbursementByPerson", () => {
  it("counts present, absent and unknown over a person's started staff assignments", () => {
    // Bob staffs 101 (scrambler) and 102 (runner): one present, one unmarked.
    const checks = new Map<string, CheckRecord>([[checkDocId(101, 2), rec("present")]]);

    const bob = row(reimbursementByPerson(sampleWcif, checks, AFTER), "Bob Brown");

    expect(bob.total).toBe(2);
    expect(bob.present).toBe(1);
    expect(bob.absent).toBe(0);
    expect(bob.unknown).toBe(1);
    expect(bob.absentRate).toBe(0);
    expect(bob.coverage).toBeCloseTo(0.5);
  });

  it("derives absentRate from total (incl. unknown) and coverage from marked-only", () => {
    // Bob: 101 absent, 102 unknown → 1 absent of 2 total = 50%; coverage 1/2.
    const checks = new Map<string, CheckRecord>([[checkDocId(101, 2), rec("absent", "no-show")]]);

    const bob = row(reimbursementByPerson(sampleWcif, checks, AFTER), "Bob Brown");

    expect(bob.absent).toBe(1);
    expect(bob.unknown).toBe(1);
    expect(bob.absentRate).toBeCloseTo(0.5);
    expect(bob.coverage).toBeCloseTo(0.5);
  });

  it("includes every person with at least one started staff assignment, even fully-unmarked", () => {
    const rows = reimbursementByPerson(sampleWcif, new Map(), AFTER);
    // Alice (judge 101), Bob (101+102), Dave (judge 201) staff; Carol has none.
    expect(rows.map((r) => r.person.name).sort()).toEqual([
      "Alice Anderson",
      "Bob Brown",
      "Dave Davis",
    ]);
    expect(row(rows, "Alice Anderson").unknown).toBe(1);
    expect(row(rows, "Dave Davis").total).toBe(1); // competitor assignment on 101 ignored
  });

  it("excludes not-yet-started staff assignments from the totals", () => {
    // Before any group starts, nobody has a started duty.
    const before = new Date("2026-06-01T00:00:00Z");
    expect(reimbursementByPerson(sampleWcif, new Map(), before)).toEqual([]);
  });

  it("sorts worst-first by absent rate, then unknowns, then name", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 1), rec("absent")], // Alice: 1/1 absent = 100%
      [checkDocId(101, 2), rec("absent")], // Bob: 1 absent of 2 = 50%
      [checkDocId(201, 4), rec("present")], // Dave: 0% absent
    ]);

    const rows = reimbursementByPerson(sampleWcif, checks, AFTER);
    expect(rows.map((r) => r.person.name)).toEqual(["Alice Anderson", "Bob Brown", "Dave Davis"]);
  });
});

describe("tierFor", () => {
  it("maps absence percentages to the default tiers", () => {
    expect(tierFor(0)).toBe("Full");
    expect(tierFor(4.9)).toBe("Full");
    expect(tierFor(5)).toBe("Full"); // inclusive upper bound
    expect(tierFor(10)).toBe("Partial");
    expect(tierFor(25)).toBe("Partial");
    expect(tierFor(25.1)).toBe("None");
    expect(tierFor(100)).toBe("None");
  });

  it("respects custom tiers regardless of input order", () => {
    const tiers = [
      { maxAbsentPct: 50, label: "Half" },
      { maxAbsentPct: 10, label: "Most" },
      { maxAbsentPct: Infinity, label: "Nope" },
    ];
    expect(tierFor(5, tiers)).toBe("Most");
    expect(tierFor(30, tiers)).toBe("Half");
    expect(tierFor(80, tiers)).toBe("Nope");
  });

  it("ships sensible defaults", () => {
    expect(DEFAULT_TIERS.map((t) => t.label)).toEqual(["Full", "Partial", "None"]);
  });
});

const totals = (absentRate: number): StaffTotals => ({
  person: { name: "x" } as StaffTotals["person"],
  total: 10,
  present: 0,
  absent: 0,
  unknown: 0,
  absentRate,
  coverage: 1,
});

describe("tierTally", () => {
  it("counts people per tier in tier order, including empty tiers", () => {
    const rows = [totals(0), totals(0.02), totals(0.1), totals(0.9)];
    expect(tierTally(rows, DEFAULT_TIERS)).toEqual([
      { label: "Full", count: 2 },
      { label: "Partial", count: 1 },
      { label: "None", count: 1 },
    ]);
  });

  it("returns zeroed tiers for an empty roster", () => {
    expect(tierTally([], DEFAULT_TIERS)).toEqual([
      { label: "Full", count: 0 },
      { label: "Partial", count: 0 },
      { label: "None", count: 0 },
    ]);
  });
});

describe("toneFor", () => {
  it("maps the best tier to good, the worst to bad, the rest to warn", () => {
    expect(toneFor(0, DEFAULT_TIERS)).toBe("good");
    expect(toneFor(10, DEFAULT_TIERS)).toBe("warn");
    expect(toneFor(80, DEFAULT_TIERS)).toBe("bad");
  });

  it("treats a two-tier scheme as good/bad with no warn", () => {
    const tiers = [
      { maxAbsentPct: 10, label: "Yes" },
      { maxAbsentPct: Infinity, label: "No" },
    ];
    expect(toneFor(5, tiers)).toBe("good");
    expect(toneFor(50, tiers)).toBe("bad");
  });
});
