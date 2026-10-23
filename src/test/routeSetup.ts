import { afterEach, beforeEach, vi } from "vitest";
import { resetBackend, wcaFetch } from "./fakeBackend";

// Setup for the `routes` project: the whole app runs on in-memory fakes of Firebase and WCA.
vi.mock("firebase/auth", async () => (await import("./fakeBackend")).firebaseAuth);
vi.mock("../lib/firebase", async () => {
  const { fakeAuth } = await import("./fakeBackend");
  const unreachable = () => {
    throw new Error("route tests must not reach Firebase; mock the module that calls it");
  };
  return { auth: () => fakeAuth, db: unreachable, functions: unreachable, storage: unreachable };
});
vi.mock("../lib/checks", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import("./fakeBackend")).checksApi,
}));
vi.mock("../lib/photos", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  subscribePeoplePhotos: () => () => {},
  fetchPrivileged: async () => false,
  uploadPersonPhoto: vi.fn(),
  removePersonPhoto: vi.fn(),
}));
vi.mock("../lib/recentComps", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  hasCheckData: vi.fn(async () => false),
}));
vi.mock("../lib/authApi", () => ({ authWithWca: vi.fn(), grantCompetitionAccess: vi.fn() }));

// Load the lazy route chunks up front so a cold transform can't eat a test's timeout.
await Promise.all(
  Object.values(import.meta.glob(["../routes/*.tsx", "!../routes/*.test.tsx"])).map((load) => load()),
);

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
