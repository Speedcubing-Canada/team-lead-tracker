import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { StageBoard } from "./StageBoard";
import { checkDocId, type CheckRecord } from "../lib/checks";
import { sampleWcif } from "../test/fixtures/wcif";

// Pin the clock to before the fixture's comp day so the "current group"
// auto-detection is deterministic (no group "today" → the first group), instead
// of depending on when the suite happens to run. Only Date is faked, so React
// Testing Library's timers keep working.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());

function row(name: string): HTMLElement {
  return screen.getByText(name).closest("li")!;
}

describe("StageBoard", () => {
  it("defaults to the lead's derived stage and groups staff by duty in order", () => {
    // Alice (1001) staff-judges on the Red Stage.
    render(<StageBoard wcif={sampleWcif} wcaUserId={1001} />);

    expect(screen.getByLabelText("Stage")).toHaveValue("1");
    // Clean derived label, not the raw WCIF name.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "3x3x3 Cube, Round 1 · Group 1",
    );

    // Staff are grouped under duty headers, judges before scramblers.
    expect(screen.getAllByTestId("duty-header").map((h) => h.textContent)).toEqual([
      "Judge · 1",
      "Scrambler · 1",
    ]);
    expect(screen.getByText("Alice Anderson")).toBeInTheDocument();
    expect(screen.getByText("Bob Brown")).toBeInTheDocument();
  });

  it("falls back to the first stage when there is no user", () => {
    render(<StageBoard wcif={sampleWcif} />);
    expect(screen.getByLabelText("Stage")).toHaveValue("1");
  });

  it("navigates to the next group with the ▶ button", () => {
    render(<StageBoard wcif={sampleWcif} wcaUserId={1001} />);

    expect(screen.getByLabelText("Previous group")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Next group"));

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "3x3x3 Cube, Round 1 · Group 2",
    );
    // Group 2 (activity 102) has Bob as a runner.
    expect(screen.getByTestId("duty-header")).toHaveTextContent("Runner · 1");
    expect(screen.getByText("Bob Brown")).toBeInTheDocument();
  });

  it("jumps to a group via the picker", () => {
    render(<StageBoard wcif={sampleWcif} wcaUserId={1001} />);
    // Red stage groups, in order: index 0=333 g1, 1=333 g2, 2=222 g1 (next day).
    fireEvent.change(screen.getByLabelText("Group"), { target: { value: "2" } });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "2x2x2 Cube, Round 1 · Group 1",
    );
  });

  it("reflects an existing check and toggles status through the handler", () => {
    const onStatus = vi.fn();
    const checks = new Map<string, CheckRecord>([
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

    const alice = row("Alice Anderson");
    expect(within(alice).getByLabelText("Present")).toHaveAttribute("aria-pressed", "true");

    // Marking without an in-progress note passes no note (4th arg undefined), so
    // any existing note is left untouched.
    fireEvent.click(within(row("Bob Brown")).getByLabelText("Absent"));
    expect(onStatus).toHaveBeenCalledWith(101, 2, "absent", undefined);

    fireEvent.click(within(alice).getByLabelText("Present"));
    expect(onStatus).toHaveBeenCalledWith(101, 1, null, undefined);
  });

  it("hides the note input until the note button is tapped", () => {
    render(<StageBoard wcif={sampleWcif} wcaUserId={1001} />);

    expect(screen.queryByPlaceholderText(/Add a note/)).not.toBeInTheDocument();

    fireEvent.click(within(row("Bob Brown")).getByLabelText("Add note"));
    expect(within(row("Bob Brown")).getByPlaceholderText(/Add a note/)).toBeInTheDocument();
  });
});

describe("StageBoard selection persistence", () => {
  afterEach(() => localStorage.clear());

  it("restores the selected group across a remount (the Dashboard ↔ Stage reset bug)", () => {
    const { unmount } = render(
      <StageBoard wcif={sampleWcif} wcaUserId={1001} competitionId="Comp1" />,
    );
    fireEvent.click(screen.getByLabelText("Next group"));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "3x3x3 Cube, Round 1 · Group 2",
    );
    unmount();

    // Remounting (as React Router does when returning to the Stage tab) restores it.
    render(<StageBoard wcif={sampleWcif} wcaUserId={1001} competitionId="Comp1" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "3x3x3 Cube, Round 1 · Group 2",
    );
  });

  it("does not persist across a remount without a competitionId", () => {
    const { unmount } = render(<StageBoard wcif={sampleWcif} wcaUserId={1001} />);
    fireEvent.click(screen.getByLabelText("Next group"));
    unmount();

    render(<StageBoard wcif={sampleWcif} wcaUserId={1001} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "3x3x3 Cube, Round 1 · Group 1",
    );
  });
});
