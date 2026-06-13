import { describe, expect, it } from "vitest";
import { dutyRank, dutyStyle } from "./duties";

describe("dutyStyle", () => {
  it("maps known staff codes to a label and a non-empty badge class", () => {
    expect(dutyStyle("staff-judge").label).toBe("Judge");
    expect(dutyStyle("staff-judge").badge).toMatch(/blue/);
    expect(dutyStyle("staff-scrambler").label).toBe("Scrambler");
    expect(dutyStyle("staff-runner").label).toBe("Runner");
    expect(dutyStyle("staff-dataentry").label).toBe("Data entry");
    expect(dutyStyle("staff-announcer").label).toBe("Announcer");
  });

  it("gives each known duty a distinct badge color", () => {
    const codes = [
      "staff-judge",
      "staff-scrambler",
      "staff-runner",
      "staff-dataentry",
      "staff-announcer",
    ];
    const badges = codes.map((c) => dutyStyle(c).badge);
    expect(new Set(badges).size).toBe(codes.length);
  });

  it("falls back to a slate badge and strips the staff- prefix for unknown codes", () => {
    const unknown = dutyStyle("staff-mystery");
    expect(unknown.label).toBe("mystery");
    expect(unknown.badge).toMatch(/slate/);
  });
});

describe("dutyRank", () => {
  it("orders the known duties judge < scrambler < runner < dataentry < announcer", () => {
    expect(dutyRank("staff-judge")).toBeLessThan(dutyRank("staff-scrambler"));
    expect(dutyRank("staff-scrambler")).toBeLessThan(dutyRank("staff-runner"));
    expect(dutyRank("staff-runner")).toBeLessThan(dutyRank("staff-dataentry"));
    expect(dutyRank("staff-dataentry")).toBeLessThan(dutyRank("staff-announcer"));
  });

  it("ranks unknown duties last", () => {
    expect(dutyRank("staff-mystery")).toBeGreaterThan(dutyRank("staff-announcer"));
  });
});
