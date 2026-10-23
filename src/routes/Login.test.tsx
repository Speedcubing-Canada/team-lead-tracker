import { renderApp } from "../test/renderApp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { backend, wcaFetch } from "../test/fakeBackend";
import { sampleWcif } from "../test/fixtures/wcif";
import { grantCompetitionAccess } from "../lib/authApi";
import { hasCheckData } from "../lib/recentComps";
import { storeMyCompetitions } from "../lib/myCompetitions";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());

const comp = (id: string, startDate: string, endDate: string, ongoing = false) => ({
  id,
  name: `${id} Open`,
  startDate,
  endDate,
  ongoing,
});
const live = comp("Live2026", "2026-07-09", "2026-07-11", true);
const soon = comp("Soon2026", "2026-08-01", "2026-08-02");
const tracked = comp("Tracked2026", "2026-07-01", "2026-07-02");
const untracked = comp("Untracked2026", "2026-07-03", "2026-07-04");

const granted = (wcif = sampleWcif) =>
  vi.mocked(grantCompetitionAccess).mockResolvedValue({
    ok: true,
    competitionName: wcif.name,
    privileged: false,
    wcif,
  });
const denied = (code: string, message = "denied") =>
  vi.mocked(grantCompetitionAccess).mockRejectedValue(Object.assign(new Error(message), { code }));

describe("login screen", () => {
  it("offers WCA login when signed out, storing a fresh OAuth state on tap", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // jsdom can't navigate to WCA
    renderApp("/", { user: null });
    fireEvent.click(await screen.findByRole("button", { name: "Log in with WCA" }));
    expect(sessionStorage.getItem("wca_oauth_state")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("lists live and upcoming comps, and recently ended ones that have check data", async () => {
    storeMyCompetitions([live, soon, tracked, untracked]);
    vi.mocked(hasCheckData).mockImplementation(async (id) => id === tracked.id);
    renderApp("/");

    expect(await screen.findByText("Signed in as Alice Anderson")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Live2026 Open.*Live/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Soon2026 Open/ })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Tracked2026 Open.*Export/ })).toBeInTheDocument();
    expect(screen.queryByText("Untracked2026 Open")).toBeNull();
  });

  it("opens a comp on its board using the WCIF from the access check, with refreshed claims", async () => {
    storeMyCompetitions([live]);
    granted({ ...sampleWcif, id: live.id });
    renderApp("/");

    fireEvent.click(await screen.findByRole("button", { name: /Live2026 Open/ }));

    expect(await screen.findByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(grantCompetitionAccess).toHaveBeenCalledWith(live.id);
    expect(backend.currentUser!.getIdToken).toHaveBeenCalledWith(true);
    expect(wcaFetch).not.toHaveBeenCalled();
  });

  it("opens a recently ended comp on its reimbursement export", async () => {
    storeMyCompetitions([tracked]);
    vi.mocked(hasCheckData).mockResolvedValue(true);
    granted({ ...sampleWcif, id: tracked.id });
    renderApp("/");

    fireEvent.click(await screen.findByRole("button", { name: /Tracked2026 Open/ }));
    expect(await screen.findByText("Reimbursement export")).toBeInTheDocument();
  });

  it("explains a denied comp in the list", async () => {
    storeMyCompetitions([live]);
    denied("functions/permission-denied", "Only staff of Live2026 can use the tracker.");
    renderApp("/");

    fireEvent.click(await screen.findByRole("button", { name: /Live2026 Open/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No access");
    expect(alert).toHaveTextContent("Only staff of Live2026 can use the tracker.");
    expect(screen.getByRole("button", { name: /Live2026 Open/ })).toBeEnabled();
  });

  it("falls back to a generic message for unexpected errors", async () => {
    storeMyCompetitions([live]);
    denied("functions/internal", "internal");
    renderApp("/");

    fireEvent.click(await screen.findByRole("button", { name: /Live2026 Open/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't open this competition");
  });

  it("shows a not-found box under the manual field and clears it on typing", async () => {
    denied("functions/not-found");
    renderApp("/");

    fireEvent.click(await screen.findByText("Enter a competition ID manually"));
    const input = screen.getByLabelText("Competition ID");
    fireEvent.change(input, { target: { value: "FakeComp2099" } });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Competition not found");
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(input, { target: { value: "FakeComp209" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("opens a manually entered comp, ignoring surrounding spaces", async () => {
    granted();
    renderApp("/");

    fireEvent.click(await screen.findByText("Enter a competition ID manually"));
    fireEvent.change(screen.getByLabelText("Competition ID"), { target: { value: "  SampleComp2026 " } });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => expect(grantCompetitionAccess).toHaveBeenCalledWith("SampleComp2026"));
    expect(await screen.findByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("signs out to the login button and forgets the comp list", async () => {
    storeMyCompetitions([live]);
    renderApp("/");

    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("button", { name: "Log in with WCA" })).toBeInTheDocument();
    expect(localStorage.getItem("wca_my_competitions")).toBeNull();
  });

  it("shows progress on a live comp while access is checked", async () => {
    storeMyCompetitions([live]);
    vi.mocked(grantCompetitionAccess).mockReturnValue(new Promise(() => {}));
    renderApp("/");

    fireEvent.click(await screen.findByRole("button", { name: /Live2026 Open/ }));
    expect(await screen.findByText("Checking…")).toBeInTheDocument();
  });
});
