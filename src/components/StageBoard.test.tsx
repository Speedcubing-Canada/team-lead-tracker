import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { StageBoard } from "./StageBoard";
import { sampleWcif } from "../test/fixtures/wcif";

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
});
