---
name: slides
description: >-
  Author a slide deck in Bolt Slides. Each slide is a React component you
  write in src/slides/, listed in repo-root deck.json; the studio handles
  reorder, duplicate, delete, speaker notes, Present, speaker view and
  PDF / JSON download. Use this whenever the user asks for a deck, a
  pitch, slides, or a presentation in this project.
---

# Slides — write the slides, the studio does the rest

This repo is a complete slide **studio**. You author the slides into it.

- `/` — in the Bolt preview iframe (and local Vite): the studio. Side panel
  (S) and grid (G) reorder / duplicate / delete and pick the start slide;
  the dock holds speaker notes, Download (PDF or JSON), Speaker view (P)
  and Present. Present opens a new tab (`/?present=1`); the studio stays
  put. The published site at `/` is the audience deck (notes stripped).
- `/?presenter=1` — speaker view: current slide, up next, notes, timer.

**Your job is the slides.** Three files matter:

1. `src/slides/<name>.tsx` — one React component per slide (default
   export). Free-form: any markup, inline styles, a `<style>` block, SVG,
   motion. No new npm dependencies.
2. `deck.json` — the ordered list of slides. Each entry's `layout` is the
   component's filename without `.tsx`.
3. `src/styles/tokens.css` — the theme (optional; see Theming).

Everything else is the shell — `src/deck`, `src/studio`, `src/present`,
`src/export`, `src/copy`, `src/data`, `src/slide`, `src/styles/base.css`,
`src/styles/chrome*.css`, `vite.config.ts`. Leave it alone. If the user
asks for a studio or engine change, say so and wait.

## The one design rule: every slide is responsive

A slide is a full-viewport web layout, not a fixed canvas. The same
component renders at phone width, in the thumbnail rail and grid, on a
laptop, on a projector, and at 1280×720 in the PDF export. It must look
right at all of them.

- **Fluid sizing.** `clamp()`, `%`, `vw`/`vh`, `rem`, `min()`/`max()`.
  No fixed pixel widths or heights on content. Media may be the only
  fixed-ratio box (`aspect-ratio` + `max-height`, `object-fit: cover`).
- **Grids wrap.** `repeat(auto-fit, minmax(min(240px, 100%), 1fr))`,
  `flex-wrap`, or the `.cols` utility. A hardcoded column count needs a
  narrow-viewport fallback (`@media (max-width: 900px)`).
- **Nothing overflows or scrolls.** A paged slide cannot scroll; what
  doesn't fit is cut off. Size each slide's content to one screen at every
  viewport, and let long text wrap (`max-width` in `ch`, no `nowrap`).
- **Check narrow and wide.** Before you finish, look at ~390px wide and
  at ≥1440px. The rail and grid render the real component, so they show
  breakage too.

Content, structure, hierarchy, color, type, imagery and motion are yours to
design for *this* deck and *this* brand. Nothing in the shell constrains
them.

## Slide component contract

```tsx
// src/slides/problem.tsx
import Slide from '@/deck/Slide';
import Reveal from '@/deck/Reveal';
import Build from '@/deck/Build';
import type { SlideComponent } from '@/slide/registry';

const Problem: SlideComponent = ({ slide }) => (
  <Slide>
    <Reveal>
      <div className="kicker">The problem</div>
      <h2 className="headline">Forty dashboards, zero answers.</h2>
    </Reveal>
    <Build at={1}>
      <p className="lead">Analysts spend the week answering the same question.</p>
    </Build>
  </Slide>
);

export default Problem;
```

- The component is rendered inside a box that fills the slide (100% ×
  100% of the stage). `<Slide>` from `@/deck/Slide` is an optional root
  that applies the theme gutters, `center` (centered stack) and `full`
  (edge-to-edge, no padding). Any root element that fills the box works.
- `slide` is the deck.json entry. `slide.props` is free-form JSON you may
  put data in (copy, numbers, image URLs) when you want it outside the
  component — for example to reuse one component across two slides.
  Ignore it when you don't need it.
- Engine helpers, all optional: `Reveal` (entrance when the slide shows),
  `Build at={n}` (hidden until the n-th click on that slide; advancing
  reveals builds, then moves on), `useInView` from `@/deck/useInView`
  (draw-in on view), the theme tokens (`var(--bg)`, `--fg`, `--fg-muted`,
  `--accent`, `--surface`, `--hair`, `--radius`, `--font-head`,
  `--font-body`, `--gutter`), and the fluid type atoms in `base.css`
  (`.display .headline .lead .subhead .kicker .foot .figure .accent-text`)
  plus `.cols` (equal columns that wrap).
- In-place text editing in the studio works for text rendered with
  `<T path="title" />` from `@/copy/DeckText`, which reads
  `slide.props.title` (rich markers: `==accent==`, `**bold**`,
  `_italic_`). Optional.
- Motion (`motion/react`) is already a dependency. Respect
  `prefers-reduced-motion` for anything that loops.

Duplicate in the studio creates a second deck.json entry pointing at the
same component. When the copy should differ, give it its own component
(or drive both from `slide.props`). Deleting an entry does not delete the
file; unused files in `src/slides/` are harmless — remove the seed
`welcome.tsx` when the real deck replaces it.

## deck.json

```jsonc
{
  "boltSlidesVersion": 1,
  "boltSlidesId": "…",           // uuid; mint on first write if missing
  "deck": {
    "title": "Acme — Series A",
    "transition": "fade",        // deck default: fade | slide | rise | zoom | none
    "font": "inter",             // optional: inter | space | sora | manrope | dm | outfit | playfair | fraunces
    "accent": "#1688FC"          // optional deck-wide accent (a solid color)
  },
  "slides": [
    {
      "id": "s1",                // stable string; new slides get a new id
      "position": 0,             // 0-based order
      "layout": "cover",         // src/slides/cover.tsx
      "props": {},               // free-form data for the component (may be empty)
      "animation": "cascade",    // cascade | rise | fade | zoom | none
      "transition": null,        // optional per-slide override of deck.transition
      "background": { "type": "color", "color": "var(--bg)" },
      "nav": null,               // optional short label for the rail / presenter
      "notes": "Open with the hook.",   // speaker notes (presenter console)
      "status": "none"           // none | draft | in-progress | review | approved
    }
  ]
}
```

- **Always set `background`** on every slide. `{"type":"color","color":"var(--bg)"}`
  is the theme surface; `{"type":"color","color":"#0b1020"}`,
  `{"type":"gradient","from":"#…","to":"#…","angle":160}` and
  `{"type":"image","url":"https://…","dim":0.45}` (a dark scrim; engine
  floors `dim` at 0.4) are the alternatives. The background is painted
  under your component; the component decides what goes on top.
- `animation`: `cascade` lets the component's own `Reveal` / `Build`
  choreography run; `rise` / `fade` / `zoom` replace it with one entrance
  for the whole slide; `none` shows it instantly.
- Every slide also accepts `"props": { "scale": "lg" | "xl" }` to enlarge
  the whole slide 15 % / 30 %.

### Bootstrap (mandatory, first)

Read `deck.json`. If `boltSlidesId` is missing or null, set it to a new
uuid (`crypto.randomUUID()` or equivalent) and write the file. Keep
`boltSlidesVersion` at `1`.

### Editing an existing deck

Read `deck.json` first so you keep the user's studio-side reorder /
duplicate / delete / notes. Patch entries in place; replace the `slides`
array only when replacing the whole deck. Empty `notes` erases what was
there.

## Workflow

1. Ground the deck in the user's real input — topic, brand, facts,
   numbers. Never invent a placeholder company for a real subject. Brand
   given → derive colors / fonts from it and say what you used.
2. Bootstrap `boltSlidesId` (above).
3. Theme if needed (`deck.accent` / `deck.font`, or `tokens.css`).
4. Write one component per slide into `src/slides/`, then the matching
   `deck.json` entries, with speaker `notes` where they help.
5. `npm run typecheck` and `npm run build` must pass. Then tell the user
   to look at the studio: drag to reorder, ••• or right-click a thumbnail
   to duplicate / delete, grid (G) to pick a slide, notes and Download on
   the dock, Present for the audience view.

## Theming (`src/styles/tokens.css`)

Prefer the deck-level `accent` and `font` over editing tokens. For deeper
theming, every `:root` value in `tokens.css` is yours to change — colors,
surfaces, radius, shadows, fonts, motion, gutters. Change values, not
variable names: the shell reads them (dock, thumbnails, atmosphere).
`--accent` must be a color value (the atmosphere derives washes from it
with `color-mix`). Dark is the default; for a light deck set `--bg` /
`--fg` and `html { color-scheme: light }` in `base.css`. Deck-level
`font` loads Google Fonts pairings automatically; for any other font, add
its `@import` to `base.css` and set `--font-head` / `--font-body`.
