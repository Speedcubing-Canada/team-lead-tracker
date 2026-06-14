/**
 * Server-side copy of the access rule. Mirrors `canAccessCompetition` in
 * `src/lib/wcif.ts` (kept in sync deliberately — the Cloud Functions package is
 * bundled independently and cannot import from the web app's source tree).
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
