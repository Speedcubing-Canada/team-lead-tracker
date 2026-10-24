# Architecture

Mobile-first web app for **stage leads at WCA championships** to track whether their assigned staff
(judges, scramblers, runners) are actually doing their group assignments. It layers identity,
shared check-off state, and a "shame" dashboard on top of the assignment data that
[Competition Groups](https://www.competitiongroups.com) only displays. Multiple leads of the same
stage share the same live check-off state.

## Two data sources, deliberately kept separate

1. **WCA public WCIF** (`{VITE_WCA_ORIGIN}/api/v0/competitions/{id}/wcif/public`, unauthenticated)
   is the source of truth for *who is assigned where*. It is fetched read-only and never copied into
   our database; we only reference WCA ids. Key shape: `persons[]` (with `wcaUserId`, `roles`,
   `assignments[]`), and `schedule.venues[].rooms[].activities[].childActivities[]` where a
   **Room = a stage**, a top-level activity = a round, and a **childActivity = a group**. Assignment
   codes: `competitor`, `staff-judge`, `staff-scrambler`, `staff-runner`, `staff-dataentry`,
   `staff-announcer`.
2. **Firestore** stores *only tracking state*, synced live across leads: `checks` (present/absent
   + notes), `members` (who may see the comp), and `people` (metadata for delegate-uploaded photos,
   whose bytes live in **Storage** under `competitions/{compId}/people/`). See the data model in
   `firestore.rules` and `storage.rules`.

The client fetches the WCIF through the same-origin `/api/wcif/:id` proxy (the `wcif` function,
which caches and compresses it) and falls back to WCA directly when the proxy is unreachable, as in
dev.

A lead's **stage is derived** from their own `assignments[]` (the room containing those activities),
with a manual stage picker as fallback (delegates often have no group-level assignments). Leads can
switch to any stage of the comp.

## Auth & access gating (why there's a Cloud Function)

WCA login is OAuth, but Firestore can only enforce "verified delegates/organizers/staff only" if
the user's Firebase identity carries verified claims. Two callable functions in `functions/src/`
handle that:

1. `authWithWca` exchanges the WCA OAuth code (confidential client; the **secret is a Functions
   secret, never in the client bundle**), calls WCA `/api/v0/me`, and mints a Firebase custom token
   carrying `wcaUserId` and `name`. It also returns the user's competitions, since it holds the WCA
   token only then. The client calls `signInWithCustomToken`.
2. `grantCompetitionAccess` runs when a lead opens a competition. It confirms the user holds a
   delegate, organizer or staff role in that comp's WCIF, sets per-comp custom claims (Storage rules
   gate photos on these), writes `competitions/{compId}` and its `members/{uid}` doc, and returns the
   slimmed WCIF so the client can seed its cache.

Firestore rules grant access only when a membership doc exists under
`competitions/{compId}/members/{uid}`; photo metadata additionally needs `privileged` (delegate or
organizer). Clients can never grant themselves access: membership and claims are written by the
Admin SDK, which bypasses rules.

## Frontend layout

- `src/lib/`: non-UI logic, unit-tested. Main modules:
  - `wca.ts` (OAuth URLs, WCIF fetch, types), `wcif.ts` (pure selectors: stages, groups, staff,
    stage derivation), `events.ts`, `duties.ts` (labels and badges).
  - `firebase.ts` (lazy init from env), `checks.ts` + `useChecks.ts` (Firestore read/write +
    realtime subscriptions), `photos.ts` + `image.ts` (photo upload and resize).
  - `selection.ts` (persisted stage/group pick), `absentees.ts` (dashboard rates and ranking),
    `reimbursement.ts` + `exportReport.ts` (post-comp report).
- `src/routes/`: `Login`, `AuthCallback`, `StageView` (landing), `ShameDashboard`,
  `ReimbursementExport`. `src/components/AppShell.tsx` is the mobile shell (scroll area + fixed
  bottom tab bar).
- Routing: `/` = login; `/auth/callback` = OAuth return; `/c/:competitionId` = shell with index
  (stage), `shame` and `reimbursement` child routes.
- **TanStack Query** caches the one WCIF fetch; derive everything else from it with selectors rather
  than refetching.
