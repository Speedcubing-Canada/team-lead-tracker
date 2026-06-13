import { describe, expect, it } from "vitest";
import {
  absencesByGroup,
  absencesByPerson,
  overallAbsenceRate,
  summarizeAbsentees,
} from "./absentees";
import { checkDocId, type CheckRecord } from "./checks";
import { sampleWcif } from "../test/fixtures/wcif";

const rec = (status: CheckRecord["status"], note = ""): CheckRecord => ({
  status,
  note,
  updatedByName: "Lead",
  updatedByWcaId: 9,
});

// All fixture groups have started by this instant (latest starts 2026-07-02T09:00Z),
// so rates are measured against the full set of assignments.
const AFTER_COMP = new Date("2026-07-03T00:00:00Z");

describe("summarizeAbsentees", () => {
  it("groups absent staffers by person with the groups they missed, present ones excluded", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 2), rec("absent", "late")], // Bob absent, group 1
      [checkDocId(102, 2), rec("absent")], // Bob absent, group 2
      [checkDocId(101, 1), rec("present")], // Alice present -> excluded
      [checkDocId(201, 4), rec("absent", "no show")], // Dave absent, blue group 1
    ]);

    const result = summarizeAbsentees(sampleWcif, checks);

    expect(result.map((r) => r.person.name)).toEqual(["Bob Brown", "Dave Davis"]);

    const bob = result[0];
    expect(bob.missed).toHaveLength(2);
    expect(bob.missed.map((m) => m.groupName)).toContain("3x3x3 Cube, Round 1, Group 1");
    expect(bob.missed.find((m) => m.groupName.endsWith("Group 1"))?.note).toBe("late");

    expect(result[1].missed).toEqual([
      { groupName: "4x4x4 Cube, Round 1, Group 1", note: "no show" },
    ]);
  });

  it("returns an empty list when nobody is absent", () => {
    expect(summarizeAbsentees(sampleWcif, new Map([[checkDocId(101, 1), rec("present")]]))).toEqual(
      [],
    );
  });
});

describe("absencesByPerson", () => {
  it("counts absences over each person's staff assignments, present excluded", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 2), rec("absent")], // Bob (assigned to 2 groups)
      [checkDocId(102, 2), rec("absent")], // Bob
      [checkDocId(201, 4), rec("absent")], // Dave (assigned to 1 group)
      [checkDocId(101, 1), rec("present")], // Alice present -> excluded
    ]);
    expect(absencesByPerson(sampleWcif, checks, AFTER_COMP)).toEqual([
      { label: "Bob Brown", count: 2, total: 2, rate: 1 },
      { label: "Dave Davis", count: 1, total: 1, rate: 1 },
    ]);
  });

  it("ranks by absence rate, not raw count (a 1/1 no-show beats a 1/2 lapse)", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 2), rec("absent")], // Bob: 1 of his 2 groups -> 0.5
      [checkDocId(201, 4), rec("absent")], // Dave: his only group -> 1.0
    ]);
    expect(absencesByPerson(sampleWcif, checks, AFTER_COMP)).toEqual([
      { label: "Dave Davis", count: 1, total: 1, rate: 1 },
      { label: "Bob Brown", count: 1, total: 2, rate: 0.5 },
    ]);
  });

  it("ignores not-yet-started groups in both the count and the denominator", () => {
    // 13:15 is after group 101 (13:00) but before Bob's group 102 (13:30).
    const now = new Date("2026-07-01T13:15:00Z");
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 2), rec("absent")], // Bob's started group -> counts
      [checkDocId(102, 2), rec("absent")], // Bob's future group -> excluded both sides
    ]);
    expect(absencesByPerson(sampleWcif, checks, now)).toEqual([
      { label: "Bob Brown", count: 1, total: 1, rate: 1 },
    ]);
  });
});

describe("absencesByGroup", () => {
  it("counts absences per group with clean 'round · Group N' labels, sorted desc", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 1), rec("absent")], // 333 r1 g1
      [checkDocId(101, 2), rec("absent")], // 333 r1 g1
      [checkDocId(201, 4), rec("absent")], // 444 r1 g1
      [checkDocId(102, 2), rec("present")], // excluded
    ]);
    expect(absencesByGroup(sampleWcif, checks, AFTER_COMP)).toEqual([
      // Group 101 has 2 staff (Alice + Bob); group 201 has 1 (Dave) — both fully absent.
      { label: "3x3x3 Cube, Round 1 · Group 1", count: 2, total: 2, rate: 1 },
      { label: "4x4x4 Cube, Round 1 · Group 1", count: 1, total: 1, rate: 1 },
    ]);
  });
});

describe("overallAbsenceRate", () => {
  it("tallies absent staff checks over all staff assignments once the comp has ended", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 1), rec("absent")], // Alice absent
      [checkDocId(101, 2), rec("absent")], // Bob absent
      [checkDocId(201, 4), rec("present")], // present -> not counted as absent
    ]);
    // Staff assignments across the comp: Alice 1, Bob 2, Dave 1 = 4.
    expect(overallAbsenceRate(sampleWcif, checks, AFTER_COMP)).toEqual({ absent: 2, total: 4 });
  });

  it("counts only started assignments, so the rate isn't diluted early in the comp", () => {
    // 13:15 — only group 101 has started; staff assigned to it: Alice + Bob = 2.
    const now = new Date("2026-07-01T13:15:00Z");
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 1), rec("absent")], // Alice, started -> counts
      [checkDocId(101, 2), rec("absent")], // Bob, started -> counts
      [checkDocId(102, 2), rec("absent")], // Bob, future group -> excluded
    ]);
    expect(overallAbsenceRate(sampleWcif, checks, now)).toEqual({ absent: 2, total: 2 });
  });
});
