# Team Lead Tracker

Mobile-first web app for stage leads at major WCA championships to keep track of their team. Log in
with your WCA account and, for the stage you're responsible for, see each group's staff
(judges/scramblers/runners) with a **present / absent toggle and a notes field**. Check-off state is
shared live across all leads of the stage, and a dashboard surfaces everyone not doing their
assignment so the team can (kindly) follow up.

It builds on the assignment data that [Competition Groups](https://www.competitiongroups.com) only
displays, adding identity, shared tracking, and accountability.

## Stack

React + Vite + TypeScript · Tailwind CSS · React Router · TanStack Query · Firebase (Auth /
Firestore / Storage / Cloud Functions / Hosting). Assignment data is read live from the WCA public
WCIF; only tracking state (statuses, notes, delegate-uploaded photos) is stored.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Firebase + WCA OAuth values
npm run dev                  # http://localhost:5173
```

For the auth flow, Cloud Functions and security rules locally, set `VITE_USE_EMULATORS=true` in
`.env.local` and run:

```bash
npm run emulators            # Auth, Functions, Firestore, Storage + emulator UI
```

### Prerequisites

- **WCA OAuth application**: register one at
  https://www.worldcubeassociation.org/oauth/applications (confidential client).
  - Client id and redirect URI go in `.env.local` (`VITE_WCA_*`).
  - The functions also need the client id: put `WCA_CLIENT_ID=...` in `functions/.env`.
  - The **client secret never goes in the client bundle**. It is a Functions secret: run
    `firebase functions:secrets:set WCA_CLIENT_SECRET` for production, or put
    `WCA_CLIENT_SECRET=...` in `functions/.secret.local` for the emulator.
- **Firebase project**: set its id in `.firebaserc` and the `VITE_FIREBASE_*` values in `.env.local`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check (app + functions tests) + production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:int` | Integration tests (Vitest, against the Auth/Firestore/Storage emulators) |
| `npm run coverage` | All Vitest suites with coverage |
| `npm run emulators` | Firebase emulator suite |
| `npm run test:e2e` | E2E journeys (Playwright, against the emulators) |

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the dev workflow and
[docs/architecture.md](./docs/architecture.md) for how it fits together.
