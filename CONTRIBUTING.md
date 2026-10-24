# Contributing

Setup (prerequisites, `.env.local`) is in the [README](README.md). Read
[docs/architecture.md](docs/architecture.md) before changing data flow or auth, and
[docs/design-guidelines.md](docs/design-guidelines.md) before adding or changing UI.

## Commands

- `npm run dev`: Vite dev server (http://localhost:5173).
- `npm run build`: `tsc -b` (type-check) then `vite build`. Use this as the type-check gate.
- `npm test` / `npm run test:watch`: Vitest. Run a single file: `npx vitest run src/lib/wcif.test.ts`.
  Filter by name: `npx vitest run -t "derives stage"`.
- `npm run emulators`: Firebase emulator suite (Auth :9099, Functions :5001, Firestore :8080, UI).
- `npm run test:e2e`: Playwright journeys (`e2e/`) on a phone viewport, against the emulators
  (project `demo-e2e`, `firebase.e2e.json`) and a fake WCA server (`e2e/fakeWca.ts`, :9300).
  Stop `npm run emulators` first (same ports). For one spec: `npm run e2e:emulators` in one
  terminal, `npx playwright test e2e/marking.spec.ts` in another.
- Functions build separately: `npm --prefix functions run build`.

## Conventions

- The WCIF selector + stage-derivation logic in `src/lib/wcif.ts` is **pure and TDD'd first**
  against fixture WCIF JSON. Keep WCA/Firebase I/O out of it so it stays testable without network.
- Firebase init is **lazy** (`src/lib/firebase.ts`) so the login screen renders and tests run without
  live credentials. Don't import the SDK at module top-level in a way that forces init.
- Client env vars must be `VITE_`-prefixed (see `.env.example`). The Firebase web config is safe to
  expose; security is enforced by `firestore.rules`, not by hiding keys. The **WCA client secret is
  not** a `VITE_` var and must never reach the browser.
- Mobile-first: design for one-handed phone use (large tap targets, min ~48px; primary
  destinations in the bottom bar; respect `env(safe-area-inset-*)`).
- UI in short (details in [docs/design-guidelines.md](docs/design-guidelines.md)): Montserrat is
  the app font (default `--font-sans`, don't set `font-family` per component); use the four-step
  weight scale (400/500/600/700, 700 for the app title only); icons come from **Lucide**
  (`lucide-react`), never emoji or one-off SVGs; use the shared `Tooltip` and `Skeleton`
  components; every color needs a `dark:` variant.

## Pull requests

Open PRs against `main`; CI runs the unit, integration and e2e suites. Every merge to `main`
deploys hosting, Firestore/Storage rules and functions to production, so `main` must always be
releasable.
