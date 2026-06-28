# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

Mobile-first web app for **stage leads at WCA championships** to track whether their assigned staff
(judges, scramblers, runners) are actually doing their group assignments. It layers identity,
shared check-off state, and a "shame" dashboard on top of the assignment data that
[Competitor-Groups](https://www.competitiongroups.com) only displays. Multiple leads of the same
stage share the same live check-off state.

## Commands

- `npm run dev` — Vite dev server (http://localhost:5173).
- `npm run build` — `tsc -b` (type-check) then `vite build`. Use this as the type-check gate.
- `npm test` / `npm run test:watch` — Vitest. Run a single file: `npx vitest run src/lib/wcif.test.ts`.
  Filter by name: `npx vitest run -t "derives stage"`.
- `npm run emulators` — Firebase emulator suite (Auth :9099, Functions :5001, Firestore :8080, UI).
- Functions build separately: `npm --prefix functions run build`.

## Architecture — the load-bearing idea

There are **two data sources, deliberately kept separate**:

1. **WCA public WCIF** (`{VITE_WCA_ORIGIN}/api/v0/competitions/{id}/wcif/public`, unauthenticated)
   is the source of truth for *who is assigned where*. It is fetched read-only and never copied into
   our database — we only reference WCA ids. Key shape: `persons[]` (with `wcaUserId`, `roles`,
   `assignments[]`), and `schedule.venues[].rooms[].activities[].childActivities[]` where a
   **Room = a stage**, a top-level activity = a round, and a **childActivity = a group**. Assignment
   codes: `competitor`, `staff-judge`, `staff-scrambler`, `staff-runner`, `staff-dataentry`,
   `staff-announcer`.
2. **Firestore** stores *only the check-off state* (present/absent + notes), synced live across
   leads. See the data model in `firestore.rules` and the plan.

A lead's **stage is derived** from their own `assignments[]` → the room containing those activities,
with a manual stage picker as fallback (delegates often have no group-level assignments). Leads can
switch to any stage of the comp.

### Auth & access gating (why there's a Cloud Function)

WCA login is OAuth, but Firestore can only enforce "verified delegates/organizers only" if the
user's Firebase identity carries a verified claim. So the single backend piece —
`functions/src/` `authWithWca` — exchanges the WCA OAuth code (confidential client; **secret lives
in Functions config, never the client bundle**), calls WCA `/api/v0/me`, confirms the user holds a
`delegate`/`organizer`/staff role in that comp's WCIF, writes the membership doc, and mints a
Firebase custom token. The client then `signInWithCustomToken`. Firestore rules grant access only
when a membership doc exists under `competitions/{compId}/members/{uid}` — clients can never grant
themselves access (membership is written by the Admin SDK, which bypasses rules).

### Frontend layout

- `src/lib/` — non-UI logic, unit-tested. `wca.ts` (OAuth URLs, WCIF fetch, types), `wcif.ts`
  (pure selectors: stages, groups, staff, stage derivation), `firebase.ts` (lazy init from env),
  `checks.ts` (Firestore read/write + realtime subscriptions).
- `src/routes/` — `Login`, `StageView` (landing), `ShameDashboard`. `src/components/AppShell.tsx`
  is the mobile shell (scroll area + fixed bottom tab bar).
- Routing: `/` = login; `/c/:competitionId` = shell with index (stage) and `shame` child routes.
- **TanStack Query** caches the one WCIF fetch; derive everything else from it with selectors rather
  than refetching.

## Conventions specific to this repo

- The WCIF selector + stage-derivation logic in `src/lib/wcif.ts` is **pure and TDD'd first**
  against fixture WCIF JSON. Keep WCA/Firebase I/O out of it so it stays testable without network.
- Firebase init is **lazy** (`src/lib/firebase.ts`) so the login screen renders and tests run without
  live credentials. Don't import the SDK at module top-level in a way that forces init.
- Client env vars must be `VITE_`-prefixed (see `.env.example`). The Firebase web config is safe to
  expose; security is enforced by `firestore.rules`, not by hiding keys. The **WCA client secret is
  not** a `VITE_` var and must never reach the browser.
- Mobile-first: design for one-handed phone use — large tap targets (min ~48px), primary
  destinations in the bottom bar, respect `env(safe-area-inset-*)`.
- **UI/visual conventions live in [`docs/design-guidelines.md`](docs/design-guidelines.md)** — read
  it before adding or changing UI. In short: Montserrat is the app font (default `--font-sans`, don't
  set `font-family` per component); use the four-step weight scale (400/500/600/700, 700 for the app
  title only); icons come from **Lucide** (`lucide-react`) — never emoji or one-off SVGs; use the
  shared `Tooltip` and `Skeleton` components; every color needs a `dark:` variant.

## Setup prerequisites (not committed)

- A WCA OAuth application (client id/secret, redirect URI) — see https://www.worldcubeassociation.org/oauth/applications.
- A Firebase project — set its id in `.firebaserc` and the `VITE_FIREBASE_*` values in `.env.local`.
