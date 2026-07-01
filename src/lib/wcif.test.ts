import { describe, expect, it } from "vitest";
import type { Wcif } from "./wca";
import { multiStageWcif, sampleWcif } from "../test/fixtures/wcif";
import {
  activityById,
  canAccessCompetition,
  defaultGroupIndex,
  defaultStageId,
  deriveStageId,
  groupNumberFromCode,
  groupsForRoom,
  groupsForStage,
  listDays,
  listStages,
  roomIdForActivity,
  staffByDuty,
  staffForGroup,
  stageColor,
  stageIdForActivity,
  subStageLabel,
} from "./wcif";

describe("listStages", () => {
  it("returns every whole-room stage with venue context", () => {
    const stages = listStages(sampleWcif);
    expect(stages).toEqual([
      { id: "1", roomId: 1, subStage: null, name: "Red Stage", color: "#cc0000", roomName: "Red Stage", venueId: 1, venueName: "Main Venue" },
      { id: "2", roomId: 2, subStage: null, name: "Blue Stage", color: "#0000cc", roomName: "Blue Stage", venueId: 1, venueName: "Main Venue" },
    ]);
  });

  it("splits a packed room into one stage per colour token, keeping whole-room rooms intact", () => {
    const stages = listStages(multiStageWcif);
    expect(stages).toEqual([
      // Arena's tokens sort alphabetically: Blue before Red.
      { id: "5:Blue", roomId: 5, subStage: "Blue", name: "Blue", color: "#2563eb", roomName: "Arena", venueId: 1, venueName: "Main Venue" },
      { id: "5:Red", roomId: 5, subStage: "Red", name: "Red", color: "#dc2626", roomName: "Arena", venueId: 1, venueName: "Main Venue" },
      { id: "6", roomId: 6, subStage: null, name: "Annex", color: "#777777", roomName: "Annex", venueId: 1, venueName: "Main Venue" },
    ]);
  });
});

describe("subStageLabel", () => {
  it("extracts a colour token after the round name", () => {
    expect(subStageLabel("3x3x3 Cube Round 1", "3x3x3 Cube Round 1 Red 2")).toBe("Red");
    expect(subStageLabel("5x5x5 Cube Round 1", "5x5x5 Cube Round 1 Orange 10")).toBe("Orange");
  });

  it("returns '' for a whole-room 'Group N' name, across separators", () => {
    expect(subStageLabel("3x3x3 Cube Round 1", "3x3x3 Cube Round 1 Group 1")).toBe("");
    expect(subStageLabel("3x3x3 Cube, Round 1", "3x3x3 Cube, Round 1, Group 2")).toBe("");
    expect(subStageLabel("R", "R g1")).toBe("");
  });

  it("returns '' when the group name doesn't start with the round name", () => {
    expect(subStageLabel("3x3x3 Cube Round 1", "Totally Different Name")).toBe("");
  });
});

describe("stageColor", () => {
  it("maps a colour word to a hex, case-insensitively", () => {
    expect(stageColor("Red", "#000000")).toBe("#dc2626");
    expect(stageColor("blue", "#000000")).toBe("#2563eb");
  });

  it("falls back to the room colour for a non-colour or null label", () => {
    expect(stageColor("Feature", "#abcdef")).toBe("#abcdef");
    expect(stageColor(null, "#abcdef")).toBe("#abcdef");
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
      shortLabel: "3x3 R1 · G1",
      date: "2026-07-01",
    });
    expect(groups[2].label).toBe("2x2x2 Cube, Round 1 · Group 1");
    expect(groups[2].shortLabel).toBe("2x2 R1 · G1");
  });

  it("excludes groups from other rooms", () => {
    const groups = groupsForRoom(sampleWcif, 2);
    expect(groups.map((g) => g.activity.id)).toEqual([201]);
  });

  it("returns an empty list for an unknown room", () => {
    expect(groupsForRoom(sampleWcif, 999)).toEqual([]);
  });
});

describe("groupsForStage", () => {
  it("returns a whole-room stage's groups by bare room id", () => {
    expect(groupsForStage(sampleWcif, "1").map((g) => g.activity.id)).toEqual([101, 102, 111]);
  });

  it("returns only the sub-stage's groups for a packed room", () => {
    expect(groupsForStage(multiStageWcif, "5:Red").map((g) => g.activity.id)).toEqual([501, 502]);
    expect(groupsForStage(multiStageWcif, "5:Blue").map((g) => g.activity.id)).toEqual([503, 504]);
    expect(groupsForStage(multiStageWcif, "6").map((g) => g.activity.id)).toEqual([601]);
  });
});

describe("stageIdForActivity", () => {
  it("maps a packed-room group to its sub-stage id", () => {
    expect(stageIdForActivity(multiStageWcif, 501)).toBe("5:Red");
    expect(stageIdForActivity(multiStageWcif, 504)).toBe("5:Blue");
    expect(stageIdForActivity(multiStageWcif, 601)).toBe("6");
  });

  it("maps a whole-room group to its bare room id, and unknown ids to null", () => {
    expect(stageIdForActivity(sampleWcif, 101)).toBe("1");
    expect(stageIdForActivity(sampleWcif, 201)).toBe("2");
    expect(stageIdForActivity(sampleWcif, 999)).toBeNull();
  });
});

describe("defaultGroupIndex", () => {
  // Red Stage (room 1) groups, sorted: [101 (07-01 13:00–13:30Z), 102 (07-01
  // 13:30–14:00Z), 111 (07-02 09:00–09:30Z)].
  it("picks the in-progress group", () => {
    expect(defaultGroupIndex(sampleWcif, "1", new Date("2026-07-01T13:15:00Z"))).toBe(0);
    expect(defaultGroupIndex(sampleWcif, "1", new Date("2026-07-01T13:45:00Z"))).toBe(1);
  });

  it("treats a group's start as in-progress and its end as over", () => {
    // At 13:30 group 101 has just ended; control passes to group 102.
    expect(defaultGroupIndex(sampleWcif, "1", new Date("2026-07-01T13:30:00Z"))).toBe(1);
  });

  it("picks the next upcoming group of the day before it starts", () => {
    expect(defaultGroupIndex(sampleWcif, "1", new Date("2026-07-01T12:00:00Z"))).toBe(0);
  });

  it("falls back to the last group of today once all of today's groups have ended", () => {
    expect(defaultGroupIndex(sampleWcif, "1", new Date("2026-07-01T20:00:00Z"))).toBe(1);
  });

  it("only considers groups scheduled for today", () => {
    // Day 2: the only group is 111 (index 2), in progress.
    expect(defaultGroupIndex(sampleWcif, "1", new Date("2026-07-02T09:15:00Z"))).toBe(2);
  });

  it("returns 0 when no group is scheduled for today", () => {
    expect(defaultGroupIndex(sampleWcif, "1", new Date("2026-07-05T10:00:00Z"))).toBe(0);
  });

  it("returns 0 for a stage with no groups", () => {
    expect(defaultGroupIndex(sampleWcif, "999", new Date("2026-07-01T13:15:00Z"))).toBe(0);
  });

  it("indexes within a single sub-stage of a packed room", () => {
    // Red groups [501 13:00–13:30, 502 13:30–14:00]; at 13:45 the second is live.
    expect(defaultGroupIndex(multiStageWcif, "5:Red", new Date("2026-07-01T13:45:00Z"))).toBe(1);
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
  // Build a judge assigned to group 101 with a given station; keeps the
  // station-sort cases readable without repeating the full person shape.
  let nextId = 100;
  function judge(name: string, stationNumber: number | null) {
    nextId += 1;
    return {
      registrantId: nextId,
      name,
      wcaUserId: 9000 + nextId,
      wcaId: null,
      countryIso2: "MX",
      roles: [],
      assignments: [{ activityId: 101, assignmentCode: "staff-judge", stationNumber }],
      avatar: null,
    };
  }
  // Alice (in the fixture) is the group-101 judge at station 3.
  const withJudges = (...extra: ReturnType<typeof judge>[]): Wcif => ({
    ...sampleWcif,
    persons: [...sampleWcif.persons, ...extra],
  });

  it("groups a group's staff by duty in duty order", () => {
    const groups = staffByDuty(sampleWcif, 101);
    expect(groups.map((g) => g.assignmentCode)).toEqual(["staff-judge", "staff-scrambler"]);
    expect(groups[0].staff.map((s) => s.person.name)).toEqual(["Alice Anderson"]);
    expect(groups[1].staff.map((s) => s.person.name)).toEqual(["Bob Brown"]);
  });

  it("sorts people by station number ascending (numerically, not lexically)", () => {
    // Stations 2, 3 (Alice), 10 — must come out 2, 3, 10, not 10, 2, 3.
    const judges = staffByDuty(withJudges(judge("Zoe Zhang", 10), judge("Mona Mills", 2)), 101)[0];
    expect(judges.staff.map((s) => s.stationNumber)).toEqual([2, 3, 10]);
    expect(judges.staff.map((s) => s.person.name)).toEqual(["Mona Mills", "Alice Anderson", "Zoe Zhang"]);
  });

  it("sorts staff without a station last", () => {
    // Alice has station 3; the two stationless judges go after her, by name.
    const judges = staffByDuty(withJudges(judge("Yara Young", null), judge("Xavier Xu", null)), 101)[0];
    expect(judges.staff.map((s) => s.person.name)).toEqual(["Alice Anderson", "Xavier Xu", "Yara Young"]);
  });

  it("uses name as a tiebreak when stations are equal", () => {
    // Alice is station 3; Adam and Beth share station 4, so they tie and sort by name.
    const judges = staffByDuty(withJudges(judge("Beth Best", 4), judge("Adam Ash", 4)), 101)[0];
    expect(judges.staff.map((s) => s.person.name)).toEqual(["Alice Anderson", "Adam Ash", "Beth Best"]);
  });

  it("falls back to alphabetical order when no stations are assigned", () => {
    // All scramblers stationless (the common case at comps without stations):
    // ordering must match the old name-sorted behavior.
    const aaron = { ...judge("Aaron Abbott", null) };
    aaron.assignments = [{ activityId: 101, assignmentCode: "staff-scrambler", stationNumber: null }];
    // Group 101's scrambler in the fixture is Bob Brown (station null).
    const scramblers = staffByDuty(withJudges(aaron), 101)[1];
    expect(scramblers.assignmentCode).toBe("staff-scrambler");
    expect(scramblers.staff.map((s) => s.person.name)).toEqual(["Aaron Abbott", "Bob Brown"]);
  });
});

describe("deriveStageId", () => {
  it("derives the stage from a person's staff assignment", () => {
    expect(deriveStageId(sampleWcif, 1001)).toBe("1");
  });

  it("ignores competitor assignments and uses the staffed stage", () => {
    // Dave competes on Red (room 1) but staffs on Blue (room 2).
    expect(deriveStageId(sampleWcif, 1004)).toBe("2");
  });

  it("derives the sub-stage a lead staffs within a packed room", () => {
    expect(deriveStageId(multiStageWcif, 2001)).toBe("5:Red");
    expect(deriveStageId(multiStageWcif, 2002)).toBe("5:Blue");
    expect(deriveStageId(multiStageWcif, 2003)).toBe("6");
  });

  it("returns null when the person has no staff assignments", () => {
    expect(deriveStageId(sampleWcif, 1003)).toBeNull();
  });

  it("returns null for an unknown user", () => {
    expect(deriveStageId(sampleWcif, 5555)).toBeNull();
  });

  it("counts only the given day's assignments when onDate is passed", () => {
    // Dave staffs Blue (room 2) via activity 201 on day 1; nothing on day 2.
    expect(deriveStageId(sampleWcif, 1004, "2026-07-01")).toBe("2");
    expect(deriveStageId(sampleWcif, 1004, "2026-07-02")).toBeNull();
  });
});

describe("defaultStageId", () => {
  it("prefers the derived stage", () => {
    expect(defaultStageId(sampleWcif, 1004)).toBe("2");
  });

  it("falls back to the first stage when nothing can be derived", () => {
    expect(defaultStageId(sampleWcif, 1003)).toBe("1");
    expect(defaultStageId(sampleWcif, 5555)).toBe("1");
  });

  it("returns null when there are no stages", () => {
    const empty = { ...sampleWcif, schedule: { ...sampleWcif.schedule, venues: [] } };
    expect(defaultStageId(empty, 1001)).toBeNull();
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

    expect(deriveStageId(wcif, 1)).toBe("1"); // all-time: room A (2 vs 1)
    expect(defaultStageId(wcif, 1, new Date("2026-07-01T09:30:00Z"))).toBe("2"); // day 1 → B
    expect(defaultStageId(wcif, 1, new Date("2026-07-02T09:30:00Z"))).toBe("1"); // day 2 → A
  });

  it("falls back to the all-time stage on a day the person isn't staffing", () => {
    // Dave only staffs on day 1; querying day 2 yields his all-time stage (Blue).
    expect(defaultStageId(sampleWcif, 1004, new Date("2026-07-02T09:30:00Z"))).toBe("2");
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
