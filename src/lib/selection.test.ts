import { afterEach, describe, expect, it } from "vitest";
import { loadSelection, saveSelection } from "./selection";

afterEach(() => localStorage.clear());

describe("selection persistence", () => {
  it("round-trips a saved selection", () => {
    saveSelection("Comp1", { roomId: 2, groupActivityId: 111, savedDate: "2026-07-01" });
    expect(loadSelection("Comp1")).toEqual({
      roomId: 2,
      groupActivityId: 111,
      savedDate: "2026-07-01",
    });
  });

  it("keys selections per competition", () => {
    saveSelection("CompA", { roomId: 1, groupActivityId: 101, savedDate: "2026-07-01" });
    saveSelection("CompB", { roomId: 2, groupActivityId: 201, savedDate: "2026-07-01" });
    expect(loadSelection("CompA")?.roomId).toBe(1);
    expect(loadSelection("CompB")?.roomId).toBe(2);
  });

  it("returns null when nothing is stored", () => {
    expect(loadSelection("Missing")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    localStorage.setItem("tlt_selection_Bad", "{not json");
    expect(loadSelection("Bad")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    localStorage.setItem("tlt_selection_Partial", JSON.stringify({ roomId: 1 }));
    expect(loadSelection("Partial")).toBeNull();
  });
});
