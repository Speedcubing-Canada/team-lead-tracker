import { renderApp } from "../test/renderApp";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { authWithWca } from "../lib/authApi";
import { loadMyCompetitions } from "../lib/myCompetitions";

const STATE_KEY = "wca_oauth_state";
const comps = [{ id: "Live2026", name: "Live Open", startDate: "2026-07-09", endDate: "2099-07-11", ongoing: true }];
const token = (claims: Record<string, unknown>) => JSON.stringify(claims);

function callback(query: string) {
  renderApp(`/auth/callback?${query}`, { user: null });
}

describe("OAuth callback", () => {
  it("exchanges the code, signs in, and lands on the comp list", async () => {
    sessionStorage.setItem(STATE_KEY, "s1");
    vi.mocked(authWithWca).mockResolvedValue({
      token: token({ wcaUserId: 1001, name: "Alice Anderson" }),
      competitions: comps,
    });
    callback("code=c1&state=s1");

    expect(await screen.findByText("Signed in as Alice Anderson")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Live Open/ })).toBeInTheDocument();
    expect(authWithWca).toHaveBeenCalledWith("c1", `${window.location.origin}/auth/callback`);
    expect(loadMyCompetitions()).toEqual(comps);
  });

  it("reports a cancelled WCA login", async () => {
    callback("error=access_denied");
    expect(await screen.findByText("WCA login was cancelled (access_denied).")).toBeInTheDocument();
  });

  it("rejects a missing code", async () => {
    callback("state=s1");
    expect(await screen.findByText("Missing authorization code.")).toBeInTheDocument();
  });

  it("rejects a forged or replayed state without calling the server", async () => {
    sessionStorage.setItem(STATE_KEY, "s1");
    callback("code=c1&state=other");
    expect(await screen.findByText(/Login state mismatch/)).toBeInTheDocument();
    expect(authWithWca).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
  });

  it("shows the server's reason for a failed login", async () => {
    sessionStorage.setItem(STATE_KEY, "s1");
    vi.mocked(authWithWca).mockRejectedValue(new Error("WCA token exchange failed (401)"));
    callback("code=c1&state=s1");
    expect(await screen.findByText("WCA token exchange failed (401)")).toBeInTheDocument();
  });

  it("maps a bare 'internal' error to a reachability hint, with a way back", async () => {
    sessionStorage.setItem(STATE_KEY, "s1");
    vi.mocked(authWithWca).mockRejectedValue(new Error("internal"));
    callback("code=c1&state=s1");

    expect(await screen.findByText("Login failed. Is the server reachable?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to login" }));
    expect(await screen.findByRole("button", { name: "Log in with WCA" })).toBeInTheDocument();
  });
});
