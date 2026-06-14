import { describe, expect, it } from "vitest";
import type { Wcif } from "./wca";
import { sampleWcif } from "../test/fixtures/wcif";
import {
  activityById,
  canAccessCompetition,
  defaultGroupIndex,
  defaultStageRoomId,
  deriveStageRoomId,
  groupNumberFromCode,
  groupsForRoom,
  listDays,
  listStages,
  roomIdForActivity,
  staffByDuty,
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

describe("activityById", () => {
  it("finds a nested group activity by id", () => {
    expect(activityById(sampleWcif, 101)?.name).toBe("3x3x3 Cube, Round 1, Group 1");
  });

  it("returns null for an unknown id", () => {
    expect(activityById(sampleWcif, 999)).toBeNull();
  });
});

describe("groupNumberFromCode", () => {
  it("parses the group number from a group activity code", () => {
    expect(groupNumberFromCode("333-r1-g1")).toBe(1);
    expect(groupNumberFromCode("777-r1-g12")).toBe(12);
  });

  it("returns null for codes without a group segment", () => {
    expect(groupNumberFromCode("333-r1")).toBeNull();
    expect(groupNumberFromCode("nonsense")).toBeNull();
  });
});

describe("groupsForRoom", () => {
  it("returns all of a room's groups across days, sorted by start time", () => {
    const groups = groupsForRoom(sampleWcif, 1);
    expect(groups.map((g) => g.activity.id)).toEqual([101, 102, 111]);
  });

  it("derives a clean 'round · Group N' label from the parent round + activity code", () => {
    const groups = groupsForRoom(sampleWcif, 1);
    expect(groups[0]).toMatchObject({
      roundName: "3x3x3 Cube, Round 1",
      groupNumber: 1,
      label: "3x3x3 Cube, Round 1 · Group 1",
      date: "2026-07-01",
    });
    expect(groups[2].label).toBe("2x2x2 Cube, Round 1 · Group 1");
  });

  it("excludes groups from other rooms", () => {
    const groups = groupsForRoom(sampleWcif, 2);
    expect(groups.map((g) => g.activity.id)).toEqual([201]);
  });

  it("returns an empty list for an unknown room", () => {
    expect(groupsForRoom(sampleWcif, 999)).toEqual([]);
  });
});

describe("defaultGroupIndex", () => {
  // Red Stage (room 1) groups, sorted: [101 (07-01 13:00–13:30Z), 102 (07-01
  // 13:30–14:00Z), 111 (07-02 09:00–09:30Z)].
  it("picks the in-progress group", () => {
    expect(defaultGroupIndex(sampleWcif, 1, new Date("2026-07-01T13:15:00Z"))).toBe(0);
    expect(defaultGroupIndex(sampleWcif, 1, new Date("2026-07-01T13:45:00Z"))).toBe(1);
  });

  it("treats a group's start as in-progress and its end as over", () => {
    // At 13:30 group 101 has just ended; control passes to group 102.
    expect(defaultGroupIndex(sampleWcif, 1, new Date("2026-07-01T13:30:00Z"))).toBe(1);
  });

  it("picks the next upcoming group of the day before it starts", () => {
    expect(defaultGroupIndex(sampleWcif, 1, new Date("2026-07-01T12:00:00Z"))).toBe(0);
  });

  it("falls back to the last group of today once all of today's groups have ended", () => {
    expect(defaultGroupIndex(sampleWcif, 1, new Date("2026-07-01T20:00:00Z"))).toBe(1);
  });

  it("only considers groups scheduled for today", () => {
    // Day 2: the only group is 111 (index 2), in progress.
    expect(defaultGroupIndex(sampleWcif, 1, new Date("2026-07-02T09:15:00Z"))).toBe(2);
  });

  it("returns 0 when no group is scheduled for today", () => {
    expect(defaultGroupIndex(sampleWcif, 1, new Date("2026-07-05T10:00:00Z"))).toBe(0);
  });

  it("returns 0 for a room with no groups", () => {
    expect(defaultGroupIndex(sampleWcif, 999, new Date("2026-07-01T13:15:00Z"))).toBe(0);
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

describe("staffByDuty", () => {
  it("groups a group's staff by duty in duty order, people sorted by name", () => {
    const groups = staffByDuty(sampleWcif, 101);
    expect(groups.map((g) => g.assignmentCode)).toEqual(["staff-judge", "staff-scrambler"]);
    expect(groups[0].staff.map((s) => s.person.name)).toEqual(["Alice Anderson"]);
    expect(groups[1].staff.map((s) => s.person.name)).toEqual(["Bob Brown"]);
  });

  it("sorts people alphabetically within a duty", () => {
    // Add a second judge whose name sorts before Alice on group 101.
    const wcif = {
      ...sampleWcif,
      persons: [
        ...sampleWcif.persons,
        {
          registrantId: 7,
          name: "Aaron Abbott",
          wcaUserId: 1007,
          wcaId: null,
          countryIso2: "MX",
          roles: [],
          assignments: [{ activityId: 101, assignmentCode: "staff-judge", stationNumber: 5 }],
          avatar: null,
        },
      ],
    };
    const judges = staffByDuty(wcif, 101)[0];
    expect(judges.assignmentCode).toBe("staff-judge");
    expect(judges.staff.map((s) => s.person.name)).toEqual(["Aaron Abbott", "Alice Anderson"]);
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

  it("counts only the given day's assignments when onDate is passed", () => {
    // Dave staffs Blue (room 2) via activity 201 on day 1; nothing on day 2.
    expect(deriveStageRoomId(sampleWcif, 1004, "2026-07-01")).toBe(2);
    expect(deriveStageRoomId(sampleWcif, 1004, "2026-07-02")).toBeNull();
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

  it("prefers the stage staffed *today* over the all-time stage", () => {
    // P staffs room A (1) twice — but both on day 2; on day 1 P is on room B (2).
    // All-time favours A; day-1 detection must pick B.
    const wcif: Wcif = {
      formatVersion: "1.0",
      id: "TwoDay",
      name: "Two Day Comp",
      persons: [
        {
          registrantId: 1,
          name: "Pat Page",
          wcaUserId: 1,
          wcaId: null,
          countryIso2: "US",
          roles: [],
          avatar: null,
          assignments: [
            { activityId: 3, assignmentCode: "staff-judge", stationNumber: null }, // room B, day 1
            { activityId: 11, assignmentCode: "staff-judge", stationNumber: null }, // room A, day 2
            { activityId: 12, assignmentCode: "staff-judge", stationNumber: null }, // room A, day 2
          ],
        },
      ],
      events: [],
      schedule: {
        startDate: "2026-07-01",
        numberOfDays: 2,
        venues: [
          {
            id: 1,
            name: "V",
            timezone: "UTC",
            rooms: [
              {
                id: 1,
                name: "A",
                color: "#000000",
                activities: [
                  {
                    id: 10,
                    name: "R",
                    activityCode: "x-r1",
                    startTime: "2026-07-02T09:00:00Z",
                    endTime: "2026-07-02T10:00:00Z",
                    childActivities: [
                      { id: 11, name: "R g1", activityCode: "x-r1-g1", startTime: "2026-07-02T09:00:00Z", endTime: "2026-07-02T09:30:00Z", childActivities: [] },
                      { id: 12, name: "R g2", activityCode: "x-r1-g2", startTime: "2026-07-02T09:30:00Z", endTime: "2026-07-02T10:00:00Z", childActivities: [] },
                    ],
                  },
                ],
              },
              {
                id: 2,
                name: "B",
                color: "#ffffff",
                activities: [
                  {
                    id: 20,
                    name: "S",
                    activityCode: "y-r1",
                    startTime: "2026-07-01T09:00:00Z",
                    endTime: "2026-07-01T10:00:00Z",
                    childActivities: [
                      { id: 3, name: "S g1", activityCode: "y-r1-g1", startTime: "2026-07-01T09:00:00Z", endTime: "2026-07-01T10:00:00Z", childActivities: [] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    expect(deriveStageRoomId(wcif, 1)).toBe(1); // all-time: room A (2 vs 1)
    expect(defaultStageRoomId(wcif, 1, new Date("2026-07-01T09:30:00Z"))).toBe(2); // day 1 → B
    expect(defaultStageRoomId(wcif, 1, new Date("2026-07-02T09:30:00Z"))).toBe(1); // day 2 → A
  });

  it("falls back to the all-time stage on a day the person isn't staffing", () => {
    // Dave only staffs on day 1; querying day 2 yields his all-time stage (Blue).
    expect(defaultStageRoomId(sampleWcif, 1004, new Date("2026-07-02T09:30:00Z"))).toBe(2);
  });
});

describe("canAccessCompetition", () => {
  it("allows a delegate", () => {
    expect(canAccessCompetition(sampleWcif, 1001)).toBe(true);
  });

  it("allows an organizer with no assignments", () => {
    expect(canAccessCompetition(sampleWcif, 1003)).toBe(true);
  });

  it("allows a staffer with no special role", () => {
    expect(canAccessCompetition(sampleWcif, 1002)).toBe(true);
  });

  it("denies a competitor with no role and no staff assignments", () => {
    const wcif = {
      ...sampleWcif,
      persons: [
        ...sampleWcif.persons,
        {
          registrantId: 9,
          name: "Erin Evans",
          wcaUserId: 1009,
          wcaId: "2020EVAN01",
          countryIso2: "DE",
          roles: [],
          assignments: [{ activityId: 101, assignmentCode: "competitor", stationNumber: null }],
          avatar: null,
        },
      ],
    };
    expect(canAccessCompetition(wcif, 1009)).toBe(false);
  });

  it("denies someone not in the competition", () => {
    expect(canAccessCompetition(sampleWcif, 5555)).toBe(false);
  });
});
