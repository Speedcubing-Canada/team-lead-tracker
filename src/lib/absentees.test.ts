import { describe, expect, it } from "vitest";
import { summarizeAbsentees } from "./absentees";
import { checkDocId, type CheckRecord } from "./checks";
import { sampleWcif } from "../test/fixtures/wcif";

const rec = (status: CheckRecord["status"], note = ""): CheckRecord => ({
  status,
  note,
  updatedByName: "Lead",
  updatedByWcaId: 9,
});

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
