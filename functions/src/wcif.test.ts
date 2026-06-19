import { describe, expect, it } from "vitest";
import { slimWcif } from "./wcif";

// A raw WCIF carrying both the fields we keep and bulky fields we drop.
const raw = {
  formatVersion: "1.0",
  id: "SAC2026",
  name: "Some Awesome Comp 2026",
  shortName: "SAC 2026",
  competitorLimit: 600,
  extensions: [{ id: "x", data: { lots: "of stuff" } }],
  persons: [
    {
      registrantId: 1,
      name: "Alex Ondet",
      wcaUserId: 42,
      wcaId: "2015ANDE01",
      countryIso2: "CA",
      gender: "m",
      registration: { status: "accepted", eventIds: ["333"] },
      personalBests: [{ eventId: "333", best: 700, type: "single" }],
      roles: ["delegate"],
      assignments: [
        { activityId: 10, assignmentCode: "staff-judge", stationNumber: 3, extra: "drop" },
        { activityId: 11, assignmentCode: "competitor" },
      ],
      avatar: { url: "https://x/full.jpg", thumbUrl: "https://x/thumb.jpg", id: 9, status: "ok" },
    },
    {
      registrantId: null,
      name: "No Avatar",
      wcaUserId: 7,
      wcaId: null,
      countryIso2: "US",
      roles: [],
      assignments: [],
      avatar: null,
    },
  ],
  events: [
    {
      id: "333",
      rounds: [
        { id: "333-r1", results: [{ huge: "payload" }], scrambleSets: 5 },
        { id: "333-r2" },
      ],
    },
  ],
  schedule: {
    startDate: "2026-08-01",
    numberOfDays: 2,
    venues: [
      {
        id: 1,
        name: "Main Venue",
        timezone: "America/Toronto",
        latitudeMicrodegrees: 1,
        rooms: [
          {
            id: 100,
            name: "Red Stage",
            color: "#f00",
            activities: [
              {
                id: 10,
                name: "3x3 Round 1",
                activityCode: "333-r1",
                startTime: "2026-08-01T09:00:00Z",
                endTime: "2026-08-01T10:00:00Z",
                childActivities: [
                  {
                    id: 1001,
                    name: "3x3 Round 1, Group 1",
                    activityCode: "333-r1-g1",
                    startTime: "2026-08-01T09:00:00Z",
                    endTime: "2026-08-01T09:30:00Z",
                    childActivities: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

describe("slimWcif", () => {
  const slim = slimWcif(raw);

  it("keeps the top-level identity fields", () => {
    expect(slim.id).toBe("SAC2026");
    expect(slim.name).toBe("Some Awesome Comp 2026");
    expect(slim.shortName).toBe("SAC 2026");
    expect(slim.formatVersion).toBe("1.0");
  });

  it("drops bulky unused fields", () => {
    expect(slim).not.toHaveProperty("competitorLimit");
    expect(slim).not.toHaveProperty("extensions");
    expect(slim.persons[0]).not.toHaveProperty("personalBests");
    expect(slim.persons[0]).not.toHaveProperty("registration");
    expect(slim.persons[0]).not.toHaveProperty("gender");
  });

  it("preserves person roles, assignments, and avatar", () => {
    const p = slim.persons[0];
    expect(p.roles).toEqual(["delegate"]);
    expect(p.assignments).toEqual([
      { activityId: 10, assignmentCode: "staff-judge", stationNumber: 3 },
      { activityId: 11, assignmentCode: "competitor", stationNumber: null },
    ]);
    expect(p.avatar).toEqual({ url: "https://x/full.jpg", thumbUrl: "https://x/thumb.jpg" });
    expect(slim.persons[1].avatar).toBeNull();
  });

  it("keeps only event/round ids", () => {
    expect(slim.events).toEqual([{ id: "333", rounds: [{ id: "333-r1" }, { id: "333-r2" }] }]);
  });

  it("preserves the schedule down to group childActivities", () => {
    const group = slim.schedule.venues[0].rooms[0].activities[0].childActivities[0];
    expect(group.id).toBe(1001);
    expect(group.activityCode).toBe("333-r1-g1");
    expect(group.childActivities).toEqual([]);
  });
});
