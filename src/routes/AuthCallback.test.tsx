import { renderApp } from "../test/renderApp";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { authWithWca } from "../lib/authApi";
import { firebaseUser, setFirebaseUser } from "../test/fakeBackend";
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

  it("rejects a missing code or a state that doesn't match", async () => {
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

  it("shows the server's reason, or a reachability hint for an opaque failure", async () => {
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

describe("auth state", () => {
  it("treats a token without a numeric WCA id as signed out", async () => {
    renderApp("/", { user: { wcaUserId: Number.NaN, name: "Ghost" } });
    expect(await screen.findByRole("button", { name: "Log in with WCA" })).toBeInTheDocument();
  });

  it("stores a fresh OAuth state when starting login", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // jsdom can't navigate to WCA
    renderApp("/", { user: null });
    fireEvent.click(await screen.findByRole("button", { name: "Log in with WCA" }));
    expect(sessionStorage.getItem(STATE_KEY)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("falls back to signed out when the ID token can't be read", async () => {
    renderApp("/", { user: null });
    setFirebaseUser({
      ...firebaseUser({}),
      getIdTokenResult: () => Promise.reject(new Error("auth/network-request-failed")),
    });
    expect(await screen.findByRole("button", { name: "Log in with WCA" })).toBeInTheDocument();
  });
});
