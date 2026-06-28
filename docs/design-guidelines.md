# Design guidelines

The UI is **mobile-first**: it's used one-handed on a phone by a stage lead at a noisy
competition. Optimize for quick scanning and large, confident tap targets. These guidelines keep
the look coherent — follow them when adding or changing UI.

## Typography

- **Font:** Montserrat, everywhere (headings and body). It's self-hosted via
  `@fontsource/montserrat` (weights 400/500/600/700 imported in `src/main.tsx`) so it works
  offline at a venue. It's wired as the default sans through the Tailwind v4 `--font-sans` token in
  `src/index.css` — so just use normal Tailwind text classes; **don't** set `font-family` per
  component.
- **Weight hierarchy** — use only these four steps, for these roles:

  | Class | Weight | Use for |
  |-------|--------|---------|
  | `font-normal` | 400 | body text, descriptions, list-item bodies |
  | `font-medium` | 500 | secondary labels, nav tabs, chart labels, tags/badges, captions with emphasis |
  | `font-semibold` | 600 | section/card headings, button labels, stat numbers, station/status badges |
  | `font-bold` | 700 | **reserved** for the top-level app title (the logged-out Login `h1`) only |

  Don't reach for `font-light`/`font-extrabold`, and don't use `font-bold` for ordinary headings or
  numbers — that's what blurred the hierarchy before. Keep `tabular-nums` on aligned figures.

## Icons

- Use **[Lucide](https://lucide.dev)** (`lucide-react`) for every icon. No emoji, no one-off inline
  SVGs, no Unicode glyphs (`✓ ✕ ◀ ▶ …`) — they render inconsistently across platforms and break the
  visual system.
- Standard sizes: **`size={20}`** for primary controls and nav, **`size={16–18}`** for inline/affordance
  icons, **`size={14}`** for hint markers.
- Icons are decorative when a text/`aria-label` already names the control — add `aria-hidden`. When an
  icon is the only label, give it `role="img"` + an `aria-label`.
- Spinners: `Loader2` with `className="motion-safe:animate-spin"`.

## Tooltips

- Use the shared **`Tooltip`** (`src/components/Tooltip.tsx`). It's touch-aware: it reveals on
  hover/focus (desktop) and on long-press (mobile).
- For controls whose **tap performs an action** (present/absent, theme, nav), pass
  `longPress={false}` so holding doesn't fight the tap — hover/focus still works on desktop, and the
  control keeps its `aria-label`.
- For **static, informational** text (e.g. a metric explanation, a chart's `hint`), allow long-press
  (the default) and give the trigger a `cursor-help` + dotted underline, or an `Info` icon.
- Tooltips supplement; they never replace an accessible name. Every interactive control still needs
  its own `aria-label`/visible text.

## Loading states

- Prefer **skeletons over spinners** for full-screen/route loads — they show the shape of what's
  coming. Use the composed skeletons in `src/components/Skeleton.tsx` (`StageBoardSkeleton`,
  `DashboardSkeleton`, `CompListSkeleton`, `ReimbursementSkeleton`), or compose new ones from the
  base `Skeleton` block so they mirror the real layout.
- Use a small `Loader2` spinner only for brief, indeterminate moments (auth check) or inline button
  pending states ("Working…", "Opening…").
- Skeleton shimmer and spinners are gated on `motion-safe:` so reduced-motion users get a calm,
  static placeholder.

## Color & surfaces

- Slate is the neutral base; **indigo-600** is the primary accent (actions, active nav). Status:
  green = present, red = absent; severity badges use emerald → amber → rose.
- Every surface, border, and text color needs its **`dark:` variant** — the app supports a manual
  light/dark override (`.dark` class). Don't add a color without its dark counterpart.

## Mobile-first baseline

- Tap targets ≥ ~44px (`min-h-11`/`h-11` and up). Primary destinations live in the bottom tab bar.
- Respect `env(safe-area-inset-*)`. Keep visible keyboard focus and honor `prefers-reduced-motion`.
