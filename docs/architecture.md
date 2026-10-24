# Architecture

Mobile-first web app for **stage leads at WCA championships** to track whether their assigned staff
(judges, scramblers, runners) are actually doing their group assignments. It layers identity,
shared check-off state, and a "shame" dashboard on top of the assignment data that
[Competitor-Groups](https://www.competitiongroups.com) only displays. Multiple leads of the same
stage share the same live check-off state.

## Two data sources, deliberately kept separate

1. **WCA public WCIF** (`{VITE_WCA_ORIGIN}/api/v0/competitions/{id}/wcif/public`, unauthenticated)
   is the source of truth for *who is assigned where*. It is fetched read-only and never copied into
   our database; we only reference WCA ids. Key shape: `persons[]` (with `wcaUserId`, `roles`,
   `assignments[]`), and `schedule.venues[].rooms[].activities[].childActivities[]` where a
   **Room = a stage**, a top-level activity = a round, and a **childActivity = a group**. Assignment
   codes: `competitor`, `staff-judge`, `staff-scrambler`, `staff-runner`, `staff-dataentry`,
   `staff-announcer`.
2. **Firestore** stores *only the check-off state* (present/absent + notes), synced live across
   leads. See the data model in `firestore.rules`.

A lead's **stage is derived** from their own `assignments[]` (the room containing those activities),
with a manual stage picker as fallback (delegates often have no group-level assignments). Leads can
switch to any stage of the comp.

## Auth & access gating (why there's a Cloud Function)

WCA login is OAuth, but Firestore can only enforce "verified delegates/organizers only" if the
user's Firebase identity carries a verified claim. So the single backend piece,
`authWithWca` in `functions/src/`, exchanges the WCA OAuth code (confidential client; **secret lives
in Functions config, never the client bundle**), calls WCA `/api/v0/me`, confirms the user holds a
`delegate`/`organizer`/staff role in that comp's WCIF, writes the membership doc, and mints a
Firebase custom token. The client then calls `signInWithCustomToken`. Firestore rules grant access
only when a membership doc exists under `competitions/{compId}/members/{uid}`. Clients can never
grant themselves access: membership is written by the Admin SDK, which bypasses rules.

## Frontend layout

- `src/lib/`: non-UI logic, unit-tested. `wca.ts` (OAuth URLs, WCIF fetch, types), `wcif.ts`
  (pure selectors: stages, groups, staff, stage derivation), `firebase.ts` (lazy init from env),
  `checks.ts` (Firestore read/write + realtime subscriptions).
- `src/routes/`: `Login`, `StageView` (landing), `ShameDashboard`. `src/components/AppShell.tsx`
  is the mobile shell (scroll area + fixed bottom tab bar).
- Routing: `/` = login; `/c/:competitionId` = shell with index (stage) and `shame` child routes.
- **TanStack Query** caches the one WCIF fetch; derive everything else from it with selectors rather
  than refetching.
