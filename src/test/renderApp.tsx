import { afterAll, beforeAll, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "../App";
import { AuthProvider, type AuthUser } from "../auth/AuthContext";
import { ThemeProvider } from "../lib/theme";
import { createQueryClient } from "../lib/queryClient";
import type { Wcif } from "../lib/wca";
import { backend, signInAs } from "./fakeBackend";

/** Fake only `Date` for the file, so Testing Library's timers keep running. */
export function pinClock(iso: string): void {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  });
  afterAll(() => vi.useRealTimers());
}

export const alice: AuthUser = { wcaUserId: 1001, name: "Alice Anderson" };

let location = "";
function LocationProbe() {
  const { pathname, search } = useLocation();
  location = pathname + search;
  return null;
}

/** The router's current path + query, for asserting navigation. */
export const currentPath = () => location;

/**
 * Render the whole app at `path`, signed in as `user` (null = signed out),
 * with `wcifs` served by the fake WCA endpoint.
 */
export function renderApp(
  path: string,
  { user = alice, wcifs = [] }: { user?: AuthUser | null; wcifs?: Wcif[] } = {},
) {
  signInAs(user);
  for (const w of wcifs) backend.wcifs.set(w.id, w);
  const queryClient = createQueryClient({ retry: false });
  return {
    queryClient,
    ...render(
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={[path]}>
              <App />
              <LocationProbe />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    ),
  };
}
