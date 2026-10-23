import { vi } from "vitest";
import type { CheckRecord, CheckStatus } from "../lib/checks";
import type { AuthUser } from "../auth/AuthContext";
import type { Wcif } from "../lib/wca";

// Type-only app imports: the mocked modules load this file, so a runtime import would deadlock.

type Listener<T> = (value: T) => void;

export interface FakeFirebaseUser {
  uid: string;
  getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

/** Stands in for the Firebase `Auth` instance. */
export const fakeAuth = { currentUser: null as FakeFirebaseUser | null };

/** In-memory server data for route tests. */
export const backend = {
  checks: new Map<string, Map<string, CheckRecord>>(),
  wcifs: new Map<string, Wcif>(),
};

const authListeners = new Set<Listener<FakeFirebaseUser | null>>();
const checkListeners = new Map<string, Set<() => void>>();

export function firebaseUser(claims: Record<string, unknown>): FakeFirebaseUser {
  return {
    uid: `wca:${String(claims["wcaUserId"])}`,
    getIdTokenResult: async () => ({ claims }),
    getIdToken: vi.fn(async () => "id-token"),
  };
}

export function setFirebaseUser(user: FakeFirebaseUser | null): void {
  fakeAuth.currentUser = user;
  authListeners.forEach((l) => l(user));
}

export const signInAs = (user: AuthUser | null) =>
  setFirebaseUser(user && firebaseUser({ wcaUserId: user.wcaUserId, name: user.name }));

export const firebaseAuth = {
  onAuthStateChanged: (_auth: unknown, cb: Listener<FakeFirebaseUser | null>) => {
    authListeners.add(cb);
    queueMicrotask(() => authListeners.has(cb) && cb(fakeAuth.currentUser));
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

function compListeners(competitionId: string): Set<() => void> {
  let set = checkListeners.get(competitionId);
  if (!set) checkListeners.set(competitionId, (set = new Set()));
  return set;
}

/** `status: null` removes the field, like `deleteField()`. */
type CheckPatch = Pick<CheckRecord, "updatedByName" | "updatedByWcaId"> &
  Partial<Omit<CheckRecord, "status">> & { status?: CheckStatus | null };

/** Merge-write like `setDoc(..., { merge: true })`; a null patch deletes. */
function upsert(
  competitionId: string,
  activityId: number,
  registrantId: number,
  patch: CheckPatch | null,
): void {
  const map = compChecks(competitionId);
  const id = `${activityId}_${registrantId}`; // checkDocId
  if (patch) {
    const { status, ...rest } = { ...map.get(id), ...patch };
    map.set(id, status ? { status, ...rest } : rest);
  } else map.delete(id);
  compListeners(competitionId).forEach((l) => l());
}

export const checksApi = {
  subscribeToChecks: vi.fn((competitionId: string, onChange: Listener<Map<string, CheckRecord>>) => {
    const notify = () => onChange(new Map(compChecks(competitionId)));
    compListeners(competitionId).add(notify);
    notify();
    return () => compListeners(competitionId).delete(notify);
  }),
  writeStatus: vi.fn(
    async (
      competitionId: string,
      activityId: number,
      registrantId: number,
      status: CheckStatus | null,
      user: AuthUser,
      note?: string,
    ) =>
      upsert(
        competitionId,
        activityId,
        registrantId,
        status === null && !note
          ? null
          : {
              status,
              ...(note !== undefined ? { note } : {}),
              updatedByName: user.name,
              updatedByWcaId: user.wcaUserId,
            },
      ),
  ),
  writeNote: vi.fn(
    async (competitionId: string, activityId: number, registrantId: number, note: string, user: AuthUser) =>
      upsert(competitionId, activityId, registrantId, {
        note,
        updatedByName: user.name,
        updatedByWcaId: user.wcaUserId,
      }),
  ),
};

/** Serves WCIFs from `backend.wcifs` at the WCA public endpoint; anything else 404s. */
export const wcaFetch = vi.fn(async (url: string) => {
  const id = /\/competitions\/([^/]+)\/wcif\/public$/.exec(url)?.[1];
  const wcif = id && backend.wcifs.get(decodeURIComponent(id));
  return wcif ? Response.json(wcif) : new Response("", { status: 404 });
});

export function resetBackend(): void {
  fakeAuth.currentUser = null;
  backend.checks.clear();
  backend.wcifs.clear();
  authListeners.clear();
  checkListeners.clear();
}
