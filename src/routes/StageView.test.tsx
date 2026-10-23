import { alice, currentPath, renderApp } from "../test/renderApp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { backend, checksApi } from "../test/fakeBackend";
import { sampleWcif } from "../test/fixtures/wcif";

const COMP = "SampleComp2026";

// Before the comp, so every stage opens on its first group.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());

const row = (name: string) => screen.getByText(name).closest("li")!;
const heading = () => screen.findByRole("heading", { level: 2 });

describe("stage view", () => {
  it("opens on the lead's own stage", async () => {
    renderApp(`/c/${COMP}`, { wcifs: [sampleWcif] });
    expect(await heading()).toHaveTextContent("3x3x3 Cube, Round 1 · Group 1");
    expect(screen.getByLabelText("Stage")).toHaveValue("1");
  });

  it("shows why a competition can't load", async () => {
    renderApp("/c/Nope2099");
    expect(await screen.findByText('Failed to load competition "Nope2099" (404)')).toBeInTheDocument();
  });

  it("sends signed-out visitors to the login screen", async () => {
    renderApp(`/c/${COMP}`, { user: null, wcifs: [sampleWcif] });
    expect(await screen.findByRole("button", { name: "Log in with WCA" })).toBeInTheDocument();
    expect(currentPath()).toBe("/");
  });

  it("saves a mark as the signed-in lead and shows it", async () => {
    renderApp(`/c/${COMP}`, { wcifs: [sampleWcif] });
    await heading();

    fireEvent.click(within(row("Bob Brown")).getByLabelText("Present"));

    expect(checksApi.writeStatus).toHaveBeenCalledWith(COMP, 101, 2, "present", alice, undefined);
    await waitFor(() =>
      expect(within(row("Bob Brown")).getByLabelText("Present")).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("shows another lead's mark live", async () => {
    renderApp(`/c/${COMP}`, { wcifs: [sampleWcif] });
    await heading();

    await checksApi.writeStatus(COMP, 101, 1, "absent", { wcaUserId: 9, name: "Other Lead" });

    await waitFor(() =>
      expect(within(row("Alice Anderson")).getByLabelText("Absent")).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("keeps the selected group across a trip to the dashboard", async () => {
    renderApp(`/c/${COMP}`, { wcifs: [sampleWcif] });
    await heading();
    fireEvent.click(screen.getByLabelText("Next group"));

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    expect(await screen.findByRole("button", { name: /My team/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Stage" }));

    expect(await heading()).toHaveTextContent("3x3x3 Cube, Round 1 · Group 2");
  });

  it("keeps the board up when a background refresh of the WCIF fails", async () => {
    const { queryClient } = renderApp(`/c/${COMP}`, { wcifs: [sampleWcif] });
    await heading();

    backend.wcifs.clear();
    await queryClient.refetchQueries();
    await waitFor(() => expect(queryClient.getQueryState(["wcif", COMP])?.status).toBe("error"));

    expect(await heading()).toHaveTextContent("3x3x3 Cube, Round 1 · Group 1");
  });

  it("tells the lead when a mark fails to save", async () => {
    checksApi.writeStatus.mockRejectedValueOnce(
      Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" }),
    );
    renderApp(`/c/${COMP}`, { wcifs: [sampleWcif] });
    await heading();

    fireEvent.click(within(row("Bob Brown")).getByLabelText("Present"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Not saved");

    fireEvent.click(within(row("Bob Brown")).getByLabelText("Present"));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
