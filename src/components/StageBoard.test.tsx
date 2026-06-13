import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { StageBoard } from "./StageBoard";
import { checkDocId, type CheckRecord } from "../lib/checks";
import { sampleWcif } from "../test/fixtures/wcif";

function rowWithin(container: HTMLElement, name: string): HTMLElement {
  return within(container).getByText(name).closest("li")!;
}

describe("StageBoard", () => {
  it("defaults to the lead's derived stage and lists its groups + staff", () => {
    // Alice (1001) staff-judges on the Red Stage.
    render(<StageBoard wcif={sampleWcif} wcaUserId={1001} />);

    expect(screen.getByLabelText("Stage")).toHaveValue("1");

    const g1 = screen.getByText("3x3x3 Cube, Round 1, Group 1").closest("li")!;
    expect(within(g1).getByText("Alice Anderson")).toBeInTheDocument();
    expect(within(g1).getByText(/Judge/)).toBeInTheDocument();
    expect(within(g1).getByText("Bob Brown")).toBeInTheDocument();
  });

  it("falls back to the first stage when there is no user", () => {
    render(<StageBoard wcif={sampleWcif} />);
    expect(screen.getByLabelText("Stage")).toHaveValue("1");
  });

  it("reflects an existing check and toggles status through the handler", () => {
    const onStatus = vi.fn();
    const checks = new Map<string, CheckRecord>([
      // Alice (registrantId 1) marked present in group 101.
      [checkDocId(101, 1), { status: "present", note: "", updatedByName: "L", updatedByWcaId: 9 }],
    ]);
    render(
      <StageBoard
        wcif={sampleWcif}
        wcaUserId={1001}
        checks={checks}
        handlers={{ onStatus, onNote: vi.fn() }}
      />,
    );

    const g1 = screen.getByText("3x3x3 Cube, Round 1, Group 1").closest("li")!;

    // Alice's Present button is active.
    const alice = rowWithin(g1, "Alice Anderson");
    expect(within(alice).getByLabelText("Present")).toHaveAttribute("aria-pressed", "true");

    // Tapping Bob's Absent (in group 1) sets absent for him.
    fireEvent.click(within(rowWithin(g1, "Bob Brown")).getByLabelText("Absent"));
    expect(onStatus).toHaveBeenCalledWith(101, 2, "absent");

    // Tapping Alice's already-active Present clears it (null).
    fireEvent.click(within(alice).getByLabelText("Present"));
    expect(onStatus).toHaveBeenCalledWith(101, 1, null);
  });
});
