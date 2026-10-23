import { renderApp } from "../test/renderApp";
import { describe, expect, it } from "vitest";
import { act, screen } from "@testing-library/react";
import { firebaseUser, setFirebaseUser } from "../test/fakeBackend";

const alice = { wcaUserId: 1001, name: "Alice Anderson" };
const loginButton = () => screen.findByRole("button", { name: "Log in with WCA" });

describe("auth state", () => {
  it("treats a token without a numeric WCA id as signed out", async () => {
    renderApp("/", { user: { wcaUserId: Number.NaN, name: "Ghost" } });
    expect(await loginButton()).toBeInTheDocument();
  });

  it("shows signed out when the ID token can't be read, and recovers once back online", async () => {
    renderApp("/", { user: null });
    let online = false;
    const user = firebaseUser(alice);
    setFirebaseUser({
      ...user,
      getIdTokenResult: () =>
        online ? user.getIdTokenResult() : Promise.reject(new Error("auth/network-request-failed")),
    });
    expect(await loginButton()).toBeInTheDocument();

    online = true;
    act(() => void window.dispatchEvent(new Event("online")));
    expect(await screen.findByText("Signed in as Alice Anderson")).toBeInTheDocument();
  });

  it("ignores a slow token read for a user who has since signed out", async () => {
    renderApp("/", { user: null });
    let release = () => {};
    const user = firebaseUser(alice);
    setFirebaseUser({
      ...user,
      getIdTokenResult: () => new Promise((r) => (release = () => r(user.getIdTokenResult()))),
    });
    act(() => setFirebaseUser(null));
    expect(await loginButton()).toBeInTheDocument();

    await act(async () => release());
    expect(screen.queryByText("Signed in as Alice Anderson")).toBeNull();
    expect(screen.getByRole("button", { name: "Log in with WCA" })).toBeInTheDocument();
  });
});
