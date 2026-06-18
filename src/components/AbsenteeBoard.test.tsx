import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AbsenteeBoard } from "./AbsenteeBoard";
import type { AbsenteeSummary } from "../lib/absentees";
import type { WcifPerson } from "../lib/wca";

const person = (registrantId: number, name: string): WcifPerson => ({
  registrantId,
  name,
  wcaUserId: registrantId,
  wcaId: null,
  countryIso2: "CA",
  roles: [],
  assignments: [],
  avatar: null,
});

describe("AbsenteeBoard", () => {
  it("celebrates when no one is absent", () => {
    render(<AbsenteeBoard absentees={[]} />);
    expect(screen.getByText(/Everyone's on it/)).toBeInTheDocument();
  });

  it("renders the per-stage comparison chart, even with nobody absent", () => {
    render(
      <AbsenteeBoard
        absentees={[]}
        byStage={[{ label: "Red Stage", count: 1, total: 4, rate: 0.25, score: 0.1 }]}
      />,
    );
    expect(screen.getByText(/Everyone's on it/)).toBeInTheDocument();
    expect(screen.getByText("Absences per stage")).toBeInTheDocument();
    expect(screen.getByText("Red Stage")).toBeInTheDocument();
  });

  it("lists absentees with their missed groups and notes", () => {
    const absentees: AbsenteeSummary[] = [
      {
        person: person(2, "Bob Brown"),
        missed: [
          { groupName: "3x3x3 Cube, Round 1, Group 1", note: "late" },
          { groupName: "3x3x3 Cube, Round 1, Group 2", note: "" },
        ],
      },
    ];
    render(<AbsenteeBoard absentees={absentees} />);

    expect(screen.getByText("Bob Brown")).toBeInTheDocument();
    expect(screen.getByText("3x3x3 Cube, Round 1, Group 1")).toBeInTheDocument();
    expect(screen.getByText(/late/)).toBeInTheDocument();
    expect(screen.getByText(/2 groups/)).toBeInTheDocument();
  });
});
