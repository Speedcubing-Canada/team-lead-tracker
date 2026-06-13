# Team Lead Tracker

Mobile-first web app for stage leads at major WCA championships to keep track of their team. Log in
with your WCA account and, for the stage you're responsible for, see each group's staff
(judges/scramblers/runners) with a **present / absent toggle and a notes field**. Check-off state is
shared live across all leads of the stage, and a dashboard surfaces everyone not doing their
assignment so the team can (kindly) follow up.

It builds on the assignment data that [Competitor-Groups](https://www.competitiongroups.com) only
displays — adding identity, shared tracking, and accountability.

## Stack

React + Vite + TypeScript · Tailwind CSS · React Router · TanStack Query · Firebase (Auth /
Firestore / Cloud Functions / Hosting). Assignment data is read live from the WCA public WCIF; only
check-off state is persisted.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Firebase + WCA OAuth values
npm run dev                  # http://localhost:5173
```

For the auth flow and Firestore rules locally:

```bash
npm run emulators            # Auth, Functions, Firestore + emulator UI
```

### Prerequisites

- **WCA OAuth application** — register at
  https://www.worldcubeassociation.org/oauth/applications (confidential client). Put the client id /
  redirect URI in `.env.local`; the **client secret goes into Firebase Functions config**, never the
  client bundle.
- **Firebase project** — set its id in `.firebaserc` and the `VITE_FIREBASE_*` values in `.env.local`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check + production build |
| `npm test` | Unit tests (Vitest) |
| `npm run emulators` | Firebase emulator suite |

See [CLAUDE.md](./CLAUDE.md) for architecture details.
