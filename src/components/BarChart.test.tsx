import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BarChart } from "./BarChart";

describe("BarChart", () => {
  it("renders a titled row per datum with bars proportional to the max", () => {
    render(
      <BarChart
        title="Most forgotten"
        data={[
          { label: "Bob", count: 4 },
          { label: "Dave", count: 2 },
        ]}
      />,
    );

    expect(screen.getByText("Most forgotten")).toBeInTheDocument();

    const bob = screen.getByText("Bob").closest("li")!;
    expect(within(bob).getByText("4")).toBeInTheDocument();
    expect(within(bob).getByTestId("bar")).toHaveStyle({ width: "100%" });

    const dave = screen.getByText("Dave").closest("li")!;
    expect(within(dave).getByTestId("bar")).toHaveStyle({ width: "50%" });
  });

  it("renders an empty-state message when there is no data", () => {
    render(<BarChart title="Per group" data={[]} />);
    expect(screen.getByText("Per group")).toBeInTheDocument();
    expect(screen.getByText(/nothing/i)).toBeInTheDocument();
  });
});
