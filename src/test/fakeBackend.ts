import { vi } from "vitest";
import type { CheckRecord, CheckStatus } from "../lib/checks";
import type { AuthUser } from "../auth/AuthContext";
import type { Wcif } from "../lib/wca";

/**
 * In-memory stand-ins for Firebase Auth, the checks collection and the WCA WCIF
 * endpoint, shared by route-level tests through renderApp's module mocks.
 */
type Listener<T> = (value: T) => void;

export interface FakeFirebaseUser {
  uid: string;
  getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

const authListeners = new Set<Listener<FakeFirebaseUser | null>>();
const checkListeners = new Set<() => void>();

export const backend = {
  currentUser: null as FakeFirebaseUser | null,
  checks: new Map<string, Map<string, CheckRecord>>(),
  wcifs: new Map<string, Wcif>(),
};

export function firebaseUser(claims: Record<string, unknown>): FakeFirebaseUser {
  return {
    uid: `wca:${String(claims["wcaUserId"])}`,
    getIdTokenResult: async () => ({ claims }),
    getIdToken: vi.fn(async () => "id-token"),
  };
}

export function setFirebaseUser(user: FakeFirebaseUser | null): void {
  backend.currentUser = user;
  authListeners.forEach((l) => l(user));
}

export const signInAs = (user: AuthUser | null) =>
  setFirebaseUser(user && firebaseUser({ wcaUserId: user.wcaUserId, name: user.name }));

export const firebaseAuth = {
  onAuthStateChanged: (_auth: unknown, cb: Listener<FakeFirebaseUser | null>) => {
    authListeners.add(cb);
    queueMicrotask(() => authListeners.has(cb) && cb(backend.currentUser));
    return () => authListeners.delete(cb);
  },
  signOut: vi.fn(async () => setFirebaseUser(null)),
  /** Test tokens are JSON-encoded claims. */
  signInWithCustomToken: vi.fn(async (_auth: unknown, token: string) =>
    setFirebaseUser(firebaseUser(JSON.parse(token) as Record<string, unknown>)),
  ),
};

function compChecks(competitionId: string): Map<string, CheckRecord> {
  let map = backend.checks.get(competitionId);
  if (!map) backend.checks.set(competitionId, (map = new Map()));
  return map;
}

export const checksApi = {
  subscribeToChecks: vi.fn((competitionId: string, onChange: Listener<Map<string, CheckRecord>>) => {
    const notify = () => onChange(new Map(compChecks(competitionId)));
    checkListeners.add(notify);
    notify();
    return () => checkListeners.delete(notify);
  }),
  writeStatus: vi.fn(
    async (
      competitionId: string,
      activityId: number,
      registrantId: number,
      status: CheckStatus | null,
      user: AuthUser,
      note?: string,
    ) => {
      const map = compChecks(competitionId);
      const id = `${activityId}_${registrantId}`;
      if (status === null) map.delete(id);
      else
        map.set(id, {
          ...map.get(id),
          status,
          ...(note !== undefined ? { note } : {}),
          updatedByName: user.name,
          updatedByWcaId: user.wcaUserId,
        } as CheckRecord);
      checkListeners.forEach((l) => l());
    },
  ),
  writeNote: vi.fn(
    async (competitionId: string, activityId: number, registrantId: number, note: string, user: AuthUser) => {
      const map = compChecks(competitionId);
      const id = `${activityId}_${registrantId}`;
      map.set(id, { ...map.get(id), note, updatedByName: user.name, updatedByWcaId: user.wcaUserId });
      checkListeners.forEach((l) => l());
    },
  ),
};

/** Serves WCIFs from `backend.wcifs` at the WCA public endpoint; anything else 404s. */
export const wcaFetch = vi.fn(async (url: string) => {
  const id = /\/competitions\/([^/]+)\/wcif\/public$/.exec(url)?.[1];
  const wcif = id && backend.wcifs.get(decodeURIComponent(id));
  return wcif ? Response.json(wcif) : new Response("", { status: 404 });
});

export function resetBackend(): void {
  backend.currentUser = null;
  backend.checks.clear();
  backend.wcifs.clear();
  authListeners.clear();
  checkListeners.clear();
}
