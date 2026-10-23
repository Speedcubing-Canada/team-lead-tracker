import { renderApp } from "../test/renderApp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { checksApi } from "../test/fakeBackend";
import { sampleWcif } from "../test/fixtures/wcif";

const COMP = "SampleComp2026";
const other = { wcaUserId: 9, name: "Other Lead" };

// After both comp days.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());

const openDashboard = () => renderApp(`/c/${COMP}/shame`, { wcifs: [sampleWcif] });

describe("shame dashboard", () => {
  it("lists my stage's absentees with their notes", async () => {
    await checksApi.writeStatus(COMP, 101, 2, "absent", other, "lunch");
    await checksApi.writeStatus(COMP, 101, 1, "present", other);
    openDashboard();

    expect(await screen.findByRole("button", { name: "My team · Red Stage" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/1 person not doing their assignment/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bob Brown" })).toBeInTheDocument();
    expect(screen.getByText(/lunch/)).toBeInTheDocument();
  });

  it("scopes My team to my stage and All stages to the whole comp", async () => {
    await checksApi.writeStatus(COMP, 201, 4, "absent", other);
    openDashboard();

    expect(await screen.findByText("Everyone's on it")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All stages" }));
    expect(screen.getByRole("button", { name: "Dave Davis" })).toBeInTheDocument();
  });

  it("compares stages on the latest comp day by default, and any other day on request", async () => {
    openDashboard();
    fireEvent.click(await screen.findByRole("button", { name: "All stages" }));

    const day = screen.getByLabelText("Comparison day");
    expect(day).toHaveValue("2026-07-02");
    expect([...(day as HTMLSelectElement).options].map((o) => o.value)).toEqual([
      "2026-07-01",
      "2026-07-02",
    ]);
    fireEvent.change(day, { target: { value: "2026-07-01" } });
    expect(day).toHaveValue("2026-07-01");
  });

  it("says the comp failed to load instead of reporting no absentees", async () => {
    renderApp("/c/Nope2099/shame");
    expect(await screen.findByText(/Failed to load competition/)).toBeInTheDocument();
    expect(screen.queryByText("Everyone's on it")).toBeNull();
  });
});
