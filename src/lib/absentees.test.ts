import { describe, expect, it } from "vitest";
import {
  absencesByGroup,
  absencesByPerson,
  absencesByStage,
  currentCompetitionDay,
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

  it("scopes the absentee list to a single stage when given a roomId", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 2), rec("absent")], // Bob, Red Stage (room 1)
      [checkDocId(201, 4), rec("absent")], // Dave, Blue Stage (room 2)
    ]);
    expect(summarizeAbsentees(sampleWcif, checks, 1).map((r) => r.person.name)).toEqual([
      "Bob Brown",
    ]);
    expect(summarizeAbsentees(sampleWcif, checks, 2).map((r) => r.person.name)).toEqual([
      "Dave Davis",
    ]);
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

  it("ranks by absence rate over *marked* duties, not raw count (a 1/1 no-show beats a 1/2 lapse)", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 2), rec("absent")], // Bob: absent on group 1
      [checkDocId(102, 2), rec("present")], // Bob: present on group 2 -> 1 of 2 marked = 0.5
      [checkDocId(201, 4), rec("absent")], // Dave: his only marked group -> 1.0
    ]);
    expect(absencesByPerson(sampleWcif, checks, AFTER_COMP)).toEqual([
      { label: "Dave Davis", count: 1, total: 1, rate: 1 },
      { label: "Bob Brown", count: 1, total: 2, rate: 0.5 },
    ]);
  });

  it("excludes unmarked duties from the denominator (only present/absent count)", () => {
    // Bob is assigned to 2 groups but only one is marked; the unmarked one must
    // not inflate his denominator into a falsely-low rate.
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 2), rec("absent")], // Bob: marked absent
      // group 102 (Bob) left unmarked -> ignored
    ]);
    expect(absencesByPerson(sampleWcif, checks, AFTER_COMP)).toEqual([
      { label: "Bob Brown", count: 1, total: 1, rate: 1 },
    ]);
  });

  it("scopes to a single stage (room) when given a roomId", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 2), rec("absent")], // Bob, Red Stage
      [checkDocId(201, 4), rec("absent")], // Dave, Blue Stage
    ]);
    expect(absencesByPerson(sampleWcif, checks, AFTER_COMP, 1)).toEqual([
      { label: "Bob Brown", count: 1, total: 1, rate: 1 },
    ]);
    expect(absencesByPerson(sampleWcif, checks, AFTER_COMP, 2)).toEqual([
      { label: "Dave Davis", count: 1, total: 1, rate: 1 },
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
  it("tallies absent staff checks over the *marked* duties, ignoring unmarked ones", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 1), rec("absent")], // Alice absent
      [checkDocId(101, 2), rec("absent")], // Bob absent
      [checkDocId(201, 4), rec("present")], // present -> in denominator, not numerator
      // Bob's group-102 duty is left unmarked, so it must not count toward total.
    ]);
    // 3 duties were actually marked (2 absent + 1 present); the 4th assignment is unmarked.
    expect(overallAbsenceRate(sampleWcif, checks, AFTER_COMP)).toEqual({ absent: 2, total: 3 });
  });

  it("scopes the rate to one stage when given a roomId", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 1), rec("absent")], // Alice, Red Stage
      [checkDocId(101, 2), rec("present")], // Bob, Red Stage
      [checkDocId(201, 4), rec("absent")], // Dave, Blue Stage
    ]);
    expect(overallAbsenceRate(sampleWcif, checks, AFTER_COMP, 1)).toEqual({ absent: 1, total: 2 });
    expect(overallAbsenceRate(sampleWcif, checks, AFTER_COMP, 2)).toEqual({ absent: 1, total: 1 });
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

describe("absencesByStage", () => {
  it("compares stages for one day, rating absences over that stage's marked duties", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 1), rec("absent")], // Red, day 1
      [checkDocId(101, 2), rec("present")], // Red, day 1 -> Red marked = 2, absent = 1 -> 0.5
      [checkDocId(201, 4), rec("present")], // Blue, day 1 -> Blue marked = 1, absent = 0 -> 0
    ]);
    expect(absencesByStage(sampleWcif, checks, "2026-07-01", AFTER_COMP)).toEqual([
      { label: "Red Stage", count: 1, total: 2, rate: 0.5 },
      { label: "Blue Stage", count: 0, total: 1, rate: 0 },
    ]);
  });

  it("excludes checks from other days so daily stage rotation isn't mixed", () => {
    const checks = new Map<string, CheckRecord>([
      [checkDocId(101, 1), rec("absent")], // Red, day 1
      [checkDocId(111, 2), rec("absent")], // Red, day 2 (2x2 group) -> excluded when querying day 1
    ]);
    expect(absencesByStage(sampleWcif, checks, "2026-07-01", AFTER_COMP)).toEqual([
      { label: "Red Stage", count: 1, total: 1, rate: 1 },
    ]);
  });
});

describe("currentCompetitionDay", () => {
  it("returns the latest day that has a started group", () => {
    // Mid-day-1: only day 1 groups have started.
    expect(currentCompetitionDay(sampleWcif, new Date("2026-07-01T13:15:00Z"))).toBe("2026-07-01");
    // After everything: the latest day.
    expect(currentCompetitionDay(sampleWcif, AFTER_COMP)).toBe("2026-07-02");
  });

  it("falls back to the first scheduled day before the comp starts", () => {
    expect(currentCompetitionDay(sampleWcif, new Date("2026-06-01T00:00:00Z"))).toBe("2026-07-01");
  });
});
