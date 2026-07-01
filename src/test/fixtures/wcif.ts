import type { Wcif } from "../../lib/wca";

/**
 * A small but structurally-real WCIF used by the selector tests.
 *
 * - 1 venue, 2 rooms (= 2 stages): Red Stage (id 1), Blue Stage (id 2).
 * - 2 days: 2026-07-01, 2026-07-02.
 * - Red Stage: 333 round 1 on day 1 with groups g1 (101) and g2 (102);
 *   222 round 1 on day 2 with group g1 (111).
 * - Blue Stage: 444 round 1 on day 1 with group g1 (201).
 * - People exercise the assignment-code and role variety we care about.
 */
export const sampleWcif: Wcif = {
  formatVersion: "1.0",
  id: "SampleComp2026",
  name: "Sample Championship 2026",
  persons: [
    {
      // Delegate who staff-judges on the Red Stage.
      registrantId: 1,
      name: "Alice Anderson",
      wcaUserId: 1001,
      wcaId: "2015ANDE01",
      countryIso2: "CA",
      roles: ["delegate"],
      assignments: [{ activityId: 101, assignmentCode: "staff-judge", stationNumber: 3 }],
      avatar: {
        url: "https://avatars.worldcubeassociation.org/uploads/user/avatar/2015ANDE01/full.jpg",
        thumbUrl: "https://avatars.worldcubeassociation.org/uploads/user/avatar/2015ANDE01/thumb.jpg",
      },
    },
    {
      // Pure staffer on the Red Stage across two groups.
      registrantId: 2,
      name: "Bob Brown",
      wcaUserId: 1002,
      wcaId: null,
      countryIso2: "US",
      roles: [],
      assignments: [
        { activityId: 101, assignmentCode: "staff-scrambler", stationNumber: null },
        { activityId: 102, assignmentCode: "staff-runner", stationNumber: null },
      ],
      // Newcomer without a profile photo — exercises the avatar fallback.
      avatar: null,
    },
    {
      // Organizer with NO assignments — stage cannot be derived (manual fallback).
      registrantId: 3,
      name: "Carol Clark",
      wcaUserId: 1003,
      wcaId: "2012CLAR02",
      countryIso2: "GB",
      roles: ["organizer"],
      assignments: [],
      avatar: null,
    },
    {
      // Competes on Red Stage but STAFFS on Blue Stage — derivation must pick Blue.
      registrantId: 4,
      name: "Dave Davis",
      wcaUserId: 1004,
      wcaId: "2018DAVI03",
      countryIso2: "FR",
      roles: [],
      assignments: [
        { activityId: 101, assignmentCode: "competitor", stationNumber: null },
        { activityId: 201, assignmentCode: "staff-judge", stationNumber: 1 },
      ],
      avatar: null,
    },
  ],
  events: [
    { id: "333", rounds: [{ id: "333-r1" }] },
    { id: "222", rounds: [{ id: "222-r1" }] },
    { id: "444", rounds: [{ id: "444-r1" }] },
  ],
  schedule: {
    startDate: "2026-07-01",
    numberOfDays: 2,
    venues: [
      {
        id: 1,
        name: "Main Venue",
        timezone: "America/Toronto",
        rooms: [
          {
            id: 1,
            name: "Red Stage",
            color: "#cc0000",
            activities: [
              {
                id: 100,
                name: "3x3x3 Cube, Round 1",
                activityCode: "333-r1",
                startTime: "2026-07-01T13:00:00Z",
                endTime: "2026-07-01T14:00:00Z",
                childActivities: [
                  {
                    id: 101,
                    name: "3x3x3 Cube, Round 1, Group 1",
                    activityCode: "333-r1-g1",
                    startTime: "2026-07-01T13:00:00Z",
                    endTime: "2026-07-01T13:30:00Z",
                    childActivities: [],
                  },
                  {
                    id: 102,
                    name: "3x3x3 Cube, Round 1, Group 2",
                    activityCode: "333-r1-g2",
                    startTime: "2026-07-01T13:30:00Z",
                    endTime: "2026-07-01T14:00:00Z",
                    childActivities: [],
                  },
                ],
              },
              {
                id: 110,
                name: "2x2x2 Cube, Round 1",
                activityCode: "222-r1",
                startTime: "2026-07-02T09:00:00Z",
                endTime: "2026-07-02T09:30:00Z",
                childActivities: [
                  {
                    id: 111,
                    name: "2x2x2 Cube, Round 1, Group 1",
                    activityCode: "222-r1-g1",
                    startTime: "2026-07-02T09:00:00Z",
                    endTime: "2026-07-02T09:30:00Z",
                    childActivities: [],
                  },
                ],
              },
            ],
          },
          {
            id: 2,
            name: "Blue Stage",
            color: "#0000cc",
            activities: [
              {
                id: 200,
                name: "4x4x4 Cube, Round 1",
                activityCode: "444-r1",
                startTime: "2026-07-01T15:00:00Z",
                endTime: "2026-07-01T16:00:00Z",
                childActivities: [
                  {
                    id: 201,
                    name: "4x4x4 Cube, Round 1, Group 1",
                    activityCode: "444-r1-g1",
                    startTime: "2026-07-01T15:00:00Z",
                    endTime: "2026-07-01T16:00:00Z",
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

/**
 * A WCIF using the *packed-room* pattern (as at NAC2026): a single room whose
 * stages live inside the group names as a colour token, so one room is really
 * several stages. Used to test sub-stage detection.
 *
 * - "Arena" (room 5) holds two stages, Red and Blue, encoded in group names
 *   ("3x3x3 Cube Round 1 Red 1" …). The Red/Blue groups even share activity
 *   codes (…-g1/…-g2) but have distinct ids.
 * - "Annex" (room 6) is a classic whole-room stage ("… Group 1", no colour).
 * - Rita staffs Red, Blake staffs Blue, Sam staffs the Annex.
 */
export const multiStageWcif: Wcif = {
  formatVersion: "1.0",
  id: "PackedComp2026",
  name: "Packed Championship 2026",
  persons: [
    {
      registrantId: 1,
      name: "Rita Reed",
      wcaUserId: 2001,
      wcaId: null,
      countryIso2: "CA",
      roles: [],
      assignments: [
        { activityId: 501, assignmentCode: "staff-judge", stationNumber: 1 },
        { activityId: 502, assignmentCode: "staff-judge", stationNumber: 1 },
      ],
      avatar: null,
    },
    {
      registrantId: 2,
      name: "Blake Blue",
      wcaUserId: 2002,
      wcaId: null,
      countryIso2: "US",
      roles: [],
      assignments: [
        { activityId: 503, assignmentCode: "staff-judge", stationNumber: 1 },
        { activityId: 504, assignmentCode: "staff-scrambler", stationNumber: null },
      ],
      avatar: null,
    },
    {
      registrantId: 3,
      name: "Sam Stone",
      wcaUserId: 2003,
      wcaId: null,
      countryIso2: "GB",
      roles: [],
      assignments: [{ activityId: 601, assignmentCode: "staff-runner", stationNumber: null }],
      avatar: null,
    },
  ],
  events: [
    { id: "333", rounds: [{ id: "333-r1" }] },
    { id: "222", rounds: [{ id: "222-r1" }] },
  ],
  schedule: {
    startDate: "2026-07-01",
    numberOfDays: 1,
    venues: [
      {
        id: 1,
        name: "Main Venue",
        timezone: "America/Toronto",
        rooms: [
          {
            id: 5,
            name: "Arena",
            color: "#222222",
            activities: [
              {
                id: 500,
                name: "3x3x3 Cube Round 1",
                activityCode: "333-r1",
                startTime: "2026-07-01T13:00:00Z",
                endTime: "2026-07-01T14:00:00Z",
                childActivities: [
                  {
                    id: 501,
                    name: "3x3x3 Cube Round 1 Red 1",
                    activityCode: "333-r1-g1",
                    startTime: "2026-07-01T13:00:00Z",
                    endTime: "2026-07-01T13:30:00Z",
                    childActivities: [],
                  },
                  {
                    id: 502,
                    name: "3x3x3 Cube Round 1 Red 2",
                    activityCode: "333-r1-g2",
                    startTime: "2026-07-01T13:30:00Z",
                    endTime: "2026-07-01T14:00:00Z",
                    childActivities: [],
                  },
                  {
                    id: 503,
                    name: "3x3x3 Cube Round 1 Blue 1",
                    activityCode: "333-r1-g1",
                    startTime: "2026-07-01T13:00:00Z",
                    endTime: "2026-07-01T13:30:00Z",
                    childActivities: [],
                  },
                  {
                    id: 504,
                    name: "3x3x3 Cube Round 1 Blue 2",
                    activityCode: "333-r1-g2",
                    startTime: "2026-07-01T13:30:00Z",
                    endTime: "2026-07-01T14:00:00Z",
                    childActivities: [],
                  },
                ],
              },
            ],
          },
          {
            id: 6,
            name: "Annex",
            color: "#777777",
            activities: [
              {
                id: 600,
                name: "2x2x2 Cube Round 1",
                activityCode: "222-r1",
                startTime: "2026-07-01T13:00:00Z",
                endTime: "2026-07-01T13:30:00Z",
                childActivities: [
                  {
                    id: 601,
                    name: "2x2x2 Cube Round 1 Group 1",
                    activityCode: "222-r1-g1",
                    startTime: "2026-07-01T13:00:00Z",
                    endTime: "2026-07-01T13:30:00Z",
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
