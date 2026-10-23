import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Login from "./Login";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { wcaUserId: 1, name: "Lead" }, loading: false, signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../lib/authApi", () => ({
  grantCompetitionAccess: vi.fn(async () => {
    throw Object.assign(new Error("No competition"), { code: "functions/not-found" });
  }),
}));

describe("Login manual entry", () => {
  it("shows a not-found box under the field and clears it on typing", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("Enter a competition ID manually"));
    const input = screen.getByLabelText("Competition ID");
    fireEvent.change(input, { target: { value: "FakeComp2099" } });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Competition not found");
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(input, { target: { value: "FakeComp209" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
