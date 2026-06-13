import { describe, expect, it } from "vitest";
import { checkDocId, toggleStatus } from "./checks";

describe("checkDocId", () => {
  it("keys a check by group activity and registrant", () => {
    expect(checkDocId(101, 5)).toBe("101_5");
  });
});

describe("toggleStatus", () => {
  it("sets a status when none is set", () => {
    expect(toggleStatus(null, "present")).toBe("present");
    expect(toggleStatus(null, "absent")).toBe("absent");
  });

  it("switches between statuses", () => {
    expect(toggleStatus("present", "absent")).toBe("absent");
    expect(toggleStatus("absent", "present")).toBe("present");
  });

  it("clears the status when the active one is tapped again", () => {
    expect(toggleStatus("present", "present")).toBeNull();
    expect(toggleStatus("absent", "absent")).toBeNull();
  });
});
