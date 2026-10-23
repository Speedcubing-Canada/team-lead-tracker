/**
 * Who may use a competition's tracker. Imported by `src/test` too, so keep it free of
 * imports that only resolve inside functions/.
 */

export interface AccessWcif {
  persons: {
    wcaUserId: number;
    roles: string[];
    assignments: { assignmentCode: string }[];
  }[];
}

const PRIVILEGED_ROLES = new Set(["delegate", "trainee-delegate", "organizer"]);

export function canAccessCompetition(wcif: AccessWcif, wcaUserId: number): boolean {
  const person = wcif.persons.find((p) => p.wcaUserId === wcaUserId);
  if (!person) return false;
  if (person.roles.some((role) => PRIVILEGED_ROLES.has(role))) return true;
  return person.assignments.some((a) => a.assignmentCode.startsWith("staff"));
}

/**
 * Privileged = delegate/organizer (roles only, no staff fallback). Gates who
 * may upload person photos. Recorded on the membership doc because security
 * rules can't read WCIF roles.
 */
export function isPrivileged(wcif: AccessWcif, wcaUserId: number): boolean {
  const person = wcif.persons.find((p) => p.wcaUserId === wcaUserId);
  if (!person) return false;
  return person.roles.some((role) => PRIVILEGED_ROLES.has(role));
}

type CompClaims = Record<string, true>;

export type AccessClaims = Record<string, unknown> & {
  comps: CompClaims;
  privilegedComps: CompClaims;
};

/** Firebase rejects custom claims over 1000 bytes, so only the newest comps are kept. */
export const MAX_CLAIMED_COMPS = 8;

/**
 * Storage rules read `comps` (members) and `privilegedComps` (delegates/organizers)
 * from the token. Re-granting a comp moves it to the newest slot.
 */
export function mergeAccessClaims(
  existing: Record<string, unknown>,
  competitionId: string,
  privileged: boolean,
): AccessClaims {
  const { [competitionId]: _, ...others } = (existing["comps"] ?? {}) as CompClaims;
  const ids = [...Object.keys(others), competitionId].slice(-MAX_CLAIMED_COMPS);
  const oldPrivileged = (existing["privilegedComps"] ?? {}) as CompClaims;
  const keepsPrivilege = (id: string) => (id === competitionId ? privileged : oldPrivileged[id]);
  return {
    ...existing,
    comps: Object.fromEntries(ids.map((id) => [id, true])),
    privilegedComps: Object.fromEntries(ids.filter(keepsPrivilege).map((id) => [id, true])),
  };
}
