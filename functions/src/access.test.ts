import { describe, expect, it } from "vitest";
import {
  canAccessCompetition,
  isPrivileged,
  mergeAccessClaims,
  MAX_CLAIMED_COMPS,
  type AccessWcif,
} from "./access.js";

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

describe("isPrivileged (functions)", () => {
  it("is true only for delegates and organizers", () => {
    expect(isPrivileged(wcif, 1)).toBe(true);
    expect(isPrivileged(wcif, 2)).toBe(true);
  });

  it("is false for staff-only members, competitors, and unknown users", () => {
    expect(isPrivileged(wcif, 3)).toBe(false);
    expect(isPrivileged(wcif, 4)).toBe(false);
    expect(isPrivileged(wcif, 999)).toBe(false);
  });
});

describe("mergeAccessClaims", () => {
  it("adds the comp and keeps unrelated claims", () => {
    expect(mergeAccessClaims({ admin: true, comps: { Old2025: true } }, "New2026", true)).toEqual({
      admin: true,
      comps: { Old2025: true, New2026: true },
      privilegedComps: { New2026: true },
    });
  });

  it("drops a privileged claim the user no longer holds, keeping other comps'", () => {
    const existing = {
      comps: { Comp2026: true, Other2026: true },
      privilegedComps: { Comp2026: true, Other2026: true },
    };
    expect(mergeAccessClaims(existing, "Comp2026", false)).toEqual({
      comps: { Other2026: true, Comp2026: true },
      privilegedComps: { Other2026: true },
    });
  });

  it("keeps only the newest comps, re-granting one as newest", () => {
    let claims: Record<string, unknown> = {};
    for (let i = 0; i < MAX_CLAIMED_COMPS + 2; i++) claims = mergeAccessClaims(claims, `C${i}`, true);
    claims = mergeAccessClaims(claims, "C2", true);

    const comps = Object.keys(claims["comps"] as object);
    expect(comps).toHaveLength(MAX_CLAIMED_COMPS);
    expect(comps.at(-1)).toBe("C2");
    expect(comps).not.toContain("C0");
    expect(Object.keys(claims["privilegedComps"] as object)).toEqual(comps);
  });

  it("stays under Firebase's 1000-byte claims limit with max-length WCA ids", () => {
    let claims: Record<string, unknown> = { wcaUserId: 1234567, name: "A Rather Long Delegate Name" };
    for (let i = 0; i < 50; i++) {
      claims = mergeAccessClaims(claims, `${"X".repeat(28)}${String(i).padStart(4, "0")}`, true);
    }
    expect(JSON.stringify(claims).length).toBeLessThan(1000);
  });
});
