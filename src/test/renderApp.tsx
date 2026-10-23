import { afterEach, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "../App";
import { AuthProvider, type AuthUser } from "../auth/AuthContext";
import { ThemeProvider } from "../lib/theme";
import { createQueryClient } from "../lib/queryClient";
import type { Wcif } from "../lib/wca";
import { backend, resetBackend, signInAs, wcaFetch } from "./fakeBackend";

// Import this before anything that loads the mocked modules.
vi.mock("firebase/auth", async () => (await import("./fakeBackend")).firebaseAuth);
vi.mock("../lib/firebase", async () => {
  const { backend } = await import("./fakeBackend");
  return { auth: () => backend };
});
vi.mock("../lib/checks", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import("./fakeBackend")).checksApi,
}));
vi.mock("../lib/photos", () => ({
  subscribePeoplePhotos: () => () => {},
  fetchPrivileged: async () => false,
  uploadPersonPhoto: vi.fn(),
  removePersonPhoto: vi.fn(),
  photoDownloadUrl: vi.fn(),
}));
vi.mock("../lib/recentComps", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  hasCheckData: vi.fn(async () => false),
}));
vi.mock("../lib/authApi", () => ({ authWithWca: vi.fn(), grantCompetitionAccess: vi.fn() }));

// Load the lazy route chunks up front so a cold transform can't eat a test's timeout.
await Promise.all([
  import("../routes/Login"),
  import("../routes/AuthCallback"),
  import("../routes/StageView"),
  import("../routes/ShameDashboard"),
  import("../routes/ReimbursementExport"),
]);

export const alice: AuthUser = { wcaUserId: 1001, name: "Alice Anderson" };

beforeEach(() => {
  vi.stubGlobal("fetch", wcaFetch);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
  );
});

afterEach(() => {
  resetBackend();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

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
