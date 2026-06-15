import { describe, expect, it } from "vitest";
import { eventIdFromActivityCode, shortEventName, shortGroupLabel } from "./events";

describe("eventIdFromActivityCode", () => {
  it("returns the segment before the first hyphen", () => {
    expect(eventIdFromActivityCode("333oh-r1-g1")).toBe("333oh");
    expect(eventIdFromActivityCode("333-r1")).toBe("333");
    expect(eventIdFromActivityCode("clock-r2-g3")).toBe("clock");
  });
});

describe("shortEventName", () => {
  it("maps known WCA event ids to short codes", () => {
    expect(shortEventName("333")).toBe("3x3");
    expect(shortEventName("333oh")).toBe("OH");
    expect(shortEventName("333bf")).toBe("3BLD");
    expect(shortEventName("444bf")).toBe("4BLD");
    expect(shortEventName("333mbf")).toBe("MBLD");
    expect(shortEventName("minx")).toBe("Mega");
  });

  it("returns null for an unknown event id", () => {
    expect(shortEventName("xyz")).toBeNull();
  });
});

describe("shortGroupLabel", () => {
  it("builds a compact 'EVENT Rn · Gn' label from a group activity code", () => {
    expect(shortGroupLabel("333-r1-g1")).toBe("3x3 R1 · G1");
    expect(shortGroupLabel("333oh-r2-g3")).toBe("OH R2 · G3");
    expect(shortGroupLabel("222-r1-g1")).toBe("2x2 R1 · G1");
  });

  it("omits the round segment when the code has none", () => {
    expect(shortGroupLabel("333oh-g2")).toBe("OH · G2");
  });

  it("returns null when the event id is unknown", () => {
    expect(shortGroupLabel("xyz-r1-g1")).toBeNull();
  });

  it("returns null when there is no group number to show", () => {
    expect(shortGroupLabel("333-r1")).toBeNull();
  });
});
