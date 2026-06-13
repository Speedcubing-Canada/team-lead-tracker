import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { BarChart } from "./BarChart";

describe("BarChart", () => {
  it("sizes each bar by its absence rate and shows count/total + percentage", async () => {
    render(
      <BarChart
        title="Most forgotten"
        data={[
          { label: "Bob", count: 4, total: 6, rate: 4 / 6 },
          { label: "Dave", count: 1, total: 2, rate: 0.5 },
        ]}
      />,
    );

    expect(screen.getByText("Most forgotten")).toBeInTheDocument();

    const bob = screen.getByText("Bob").closest("li")!;
    expect(within(bob).getByText("4/6")).toBeInTheDocument();
    expect(within(bob).getByText("67%")).toBeInTheDocument();
    // Bars grow from 0 to their rate on mount.
    await waitFor(() => expect(within(bob).getByTestId("bar")).toHaveStyle({ width: "67%" }));

    const dave = screen.getByText("Dave").closest("li")!;
    expect(within(dave).getByText("1/2")).toBeInTheDocument();
    expect(within(dave).getByText("50%")).toBeInTheDocument();
    await waitFor(() => expect(within(dave).getByTestId("bar")).toHaveStyle({ width: "50%" }));
  });

  it("renders an empty-state message when there is no data", () => {
    render(<BarChart title="Per group" data={[]} />);
    expect(screen.getByText("Per group")).toBeInTheDocument();
    expect(screen.getByText(/nothing/i)).toBeInTheDocument();
  });
});
