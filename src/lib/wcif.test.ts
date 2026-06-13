import { describe, expect, it } from "vitest";
import { sampleWcif } from "../test/fixtures/wcif";
import {
  defaultStageRoomId,
  deriveStageRoomId,
  groupsForRoomOnDay,
  listDays,
  listStages,
  roomIdForActivity,
  staffForGroup,
} from "./wcif";

describe("listStages", () => {
  it("returns every room as a stage with venue context", () => {
    const stages = listStages(sampleWcif);
    expect(stages).toEqual([
      { id: 1, name: "Red Stage", color: "#cc0000", venueId: 1, venueName: "Main Venue" },
      { id: 2, name: "Blue Stage", color: "#0000cc", venueId: 1, venueName: "Main Venue" },
    ]);
  });
});

describe("listDays", () => {
  it("returns distinct scheduled dates in order", () => {
    expect(listDays(sampleWcif)).toEqual(["2026-07-01", "2026-07-02"]);
  });
});

describe("roomIdForActivity", () => {
  it("maps a group activity back to its room", () => {
    expect(roomIdForActivity(sampleWcif, 101)).toBe(1);
    expect(roomIdForActivity(sampleWcif, 201)).toBe(2);
  });

  it("returns null for an unknown activity", () => {
    expect(roomIdForActivity(sampleWcif, 999)).toBeNull();
  });
});

describe("groupsForRoomOnDay", () => {
  it("returns the room's groups on that day, sorted by start time", () => {
    const groups = groupsForRoomOnDay(sampleWcif, 1, "2026-07-01");
    expect(groups.map((g) => g.id)).toEqual([101, 102]);
  });

  it("excludes groups from other days", () => {
    const groups = groupsForRoomOnDay(sampleWcif, 1, "2026-07-02");
    expect(groups.map((g) => g.id)).toEqual([111]);
  });

  it("excludes groups from other rooms", () => {
    const groups = groupsForRoomOnDay(sampleWcif, 2, "2026-07-01");
    expect(groups.map((g) => g.id)).toEqual([201]);
  });
});

describe("staffForGroup", () => {
  it("returns only staff assignments (not competitors) for the group", () => {
    const staff = staffForGroup(sampleWcif, 101);
    expect(staff).toEqual([
      { person: expect.objectContaining({ wcaUserId: 1001 }), assignmentCode: "staff-judge", stationNumber: 3 },
      { person: expect.objectContaining({ wcaUserId: 1002 }), assignmentCode: "staff-scrambler", stationNumber: null },
    ]);
  });

  it("does not include a competitor assignment", () => {
    const staff = staffForGroup(sampleWcif, 201);
    expect(staff.map((s) => s.person.wcaUserId)).toEqual([1004]);
    expect(staff[0].assignmentCode).toBe("staff-judge");
  });
});

describe("deriveStageRoomId", () => {
  it("derives the room from a person's staff assignment", () => {
    expect(deriveStageRoomId(sampleWcif, 1001)).toBe(1);
  });

  it("ignores competitor assignments and uses the staffed room", () => {
    // Dave competes on Red (room 1) but staffs on Blue (room 2).
    expect(deriveStageRoomId(sampleWcif, 1004)).toBe(2);
  });

  it("returns null when the person has no staff assignments", () => {
    expect(deriveStageRoomId(sampleWcif, 1003)).toBeNull();
  });

  it("returns null for an unknown user", () => {
    expect(deriveStageRoomId(sampleWcif, 5555)).toBeNull();
  });
});

describe("defaultStageRoomId", () => {
  it("prefers the derived stage", () => {
    expect(defaultStageRoomId(sampleWcif, 1004)).toBe(2);
  });

  it("falls back to the first stage when nothing can be derived", () => {
    expect(defaultStageRoomId(sampleWcif, 1003)).toBe(1);
    expect(defaultStageRoomId(sampleWcif, 5555)).toBe(1);
  });

  it("returns null when there are no stages", () => {
    const empty = { ...sampleWcif, schedule: { ...sampleWcif.schedule, venues: [] } };
    expect(defaultStageRoomId(empty, 1001)).toBeNull();
  });
});
