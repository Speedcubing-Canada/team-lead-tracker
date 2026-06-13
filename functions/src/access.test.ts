import { describe, expect, it } from "vitest";
import { canAccessCompetition, type AccessWcif } from "./access";

const wcif: AccessWcif = {
  persons: [
    { wcaUserId: 1, roles: ["delegate"], assignments: [] },
    { wcaUserId: 2, roles: ["organizer"], assignments: [] },
    { wcaUserId: 3, roles: [], assignments: [{ assignmentCode: "staff-judge" }] },
    { wcaUserId: 4, roles: [], assignments: [{ assignmentCode: "competitor" }] },
  ],
};

describe("canAccessCompetition (functions)", () => {
  it("allows delegates, organizers, and staff", () => {
    expect(canAccessCompetition(wcif, 1)).toBe(true);
    expect(canAccessCompetition(wcif, 2)).toBe(true);
    expect(canAccessCompetition(wcif, 3)).toBe(true);
  });

  it("denies plain competitors and unknown users", () => {
    expect(canAccessCompetition(wcif, 4)).toBe(false);
    expect(canAccessCompetition(wcif, 999)).toBe(false);
  });
});
