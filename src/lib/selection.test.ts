import { afterEach, describe, expect, it } from "vitest";
import { loadSelection, saveSelection } from "./selection";

afterEach(() => localStorage.clear());

describe("selection persistence", () => {
  it("round-trips a saved selection", () => {
    saveSelection("Comp1", { stageId: "2", groupActivityId: 111, savedDate: "2026-07-01" });
    expect(loadSelection("Comp1")).toEqual({
      stageId: "2",
      groupActivityId: 111,
      savedDate: "2026-07-01",
    });
  });

  it("round-trips a packed-room sub-stage id", () => {
    saveSelection("Comp2", { stageId: "0:Red", groupActivityId: 18, savedDate: "2026-07-01" });
    expect(loadSelection("Comp2")?.stageId).toBe("0:Red");
  });

  it("keys selections per competition", () => {
    saveSelection("CompA", { stageId: "1", groupActivityId: 101, savedDate: "2026-07-01" });
    saveSelection("CompB", { stageId: "2", groupActivityId: 201, savedDate: "2026-07-01" });
    expect(loadSelection("CompA")?.stageId).toBe("1");
    expect(loadSelection("CompB")?.stageId).toBe("2");
  });

  it("returns null when nothing is stored", () => {
    expect(loadSelection("Missing")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    localStorage.setItem("tlt_selection_Bad", "{not json");
    expect(loadSelection("Bad")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    localStorage.setItem("tlt_selection_Partial", JSON.stringify({ stageId: "1" }));
    expect(loadSelection("Partial")).toBeNull();
  });

  it("returns null for a legacy numeric roomId selection (forces re-detection)", () => {
    localStorage.setItem(
      "tlt_selection_Legacy",
      JSON.stringify({ roomId: 1, groupActivityId: 101, savedDate: "2026-07-01" }),
    );
    expect(loadSelection("Legacy")).toBeNull();
  });
});
