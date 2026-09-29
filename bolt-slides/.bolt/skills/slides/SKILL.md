---
name: slides
description: >-
  Author a slide deck in Bolt Slides. Each slide is a React component you
  design and write in src/slides/, listed in repo-root deck.json; the studio
  handles reorder, duplicate, delete, speaker notes, Present, speaker view
  and PDF / JSON download. Use this whenever the user asks for a deck, a
  pitch, slides, or a presentation in this project.
---

# Slides — you design the slides, the studio does the rest

This repo is a complete slide **studio** with **no house style**. There is
no layout catalog, no theme, no type scale, no default palette or imagery.
Every visual decision in a deck is yours, made for this brief.

- `/` — in the Bolt preview iframe (and local Vite): the studio. Side panel
  (S) and grid (G) reorder / duplicate / delete and pick the start slide;
  the dock holds speaker notes, Download (PDF or JSON), Speaker view (P)
  and Present. Present opens a new tab (`/?present=1`); the studio stays
  put. The published site at `/` is the audience deck (notes stripped).
- `/?presenter=1` — speaker view: current slide, up next, notes, timer.

**What you write:**

1. `src/slides/<name>.tsx` — one React component per slide (default
   export). Free-form: any markup, inline styles or a `<style>` block, SVG,
   images, motion. No new npm dependencies.
2. `deck.json` — the ordered list of slides. Each entry's `layout` is the
   component's filename without `.tsx`.

Everything else is the shell — `src/deck`, `src/studio`, `src/present`,
`src/export`, `src/copy`, `src/data`, `src/slide`, `src/styles/`,
`vite.config.ts`. Leave it alone. If the user asks for a studio or engine
change, say so and wait.

## The one rule: every slide is responsive

A slide is a full-viewport web layout, not a fixed canvas. The same
component renders at phone width, in the thumbnail rail and grid, on a
laptop, on a projector, and at 1280×720 in the PDF export. It must hold
up at all of them.

- **Fluid sizing.** `clamp()`, `%`, `vw`/`vh`, `rem`, `min()`/`max()`.
  No fixed pixel widths or heights on content. Media may be the only
  fixed-ratio box (`aspect-ratio` + `max-height`, `object-fit: cover`).
- **Grids wrap.** `repeat(auto-fit, minmax(min(240px, 100%), 1fr))`,
  `flex-wrap`, or the `.cols` utility. A hardcoded column count needs a
  narrow-viewport fallback (`@media (max-width: 900px)`).
- **Nothing overflows or scrolls.** A paged slide cannot scroll; what
  doesn't fit is cut off. Size each slide's content to one screen at every
  viewport, and let long text wrap (`max-width` in `ch`, no `nowrap`).
- **Text gets room.** A cramped text column is the most common failure.
  Body copy runs 45–75ch wide, headlines up to ~20–28ch; a text column
  next to an image or panel takes at least ~40% of the slide on wide
  viewports (`minmax(min(20rem, 100%), 1fr)` or `clamp(20rem, 45%, 40rem)`),
  and a lone text block sits on a wide measure, not a sliver. Narrow
  text is a deliberate choice on one slide, never the default.
- **Check narrow and wide.** Before you finish, look at ~390px wide and
  at ≥1440px. The rail and grid render the real component, so they show
  breakage too.

## Design it — for this deck

Because the shell imposes nothing, a deck that ships as centered text on a
plain background with one accent color is your choice, and almost never
the right one. Build a visual identity for the subject and brand:

- **Palette and surfaces** — light or dark, brand colors, gradients,
  color blocks, photographic backgrounds. Set them per slide or in one
  shared module you import (e.g. `src/slides/theme.ts`).
- **Type** — pick fonts for the deck. Add a Google Fonts `<link>` to
  `index.html` (or `@import` in a `<style>` block) and use them; or set
  deck-level `font` in `deck.json` for one of the built-in pairings.
- **Imagery** — real photos (Unsplash `https://images.unsplash.com/…?w=1600&q=80`
  or the user's assets), generated images written to `public/`, product
  screenshots, illustration, inline SVG, diagrams, charts drawn in SVG,
  device or browser mocks. Full-bleed images under a scrim, split panels,
  image grids — whatever the story needs.
- **Composition** — asymmetry, overlap, edge-to-edge, big numbers,
  timelines, maps, whatever fits.
- **Motion, on by default.** Unless the user asks for a static deck, every
  slide animates in smoothly: staggered entrances with `Reveal` (or
  `motion/react` with an ease-out curve, ~0.5–0.8s, small offsets) and
  `Build` for the beats worth a click. Calm and consistent across the deck,
  never a circus; respect `prefers-reduced-motion` for anything that loops.

Ground it in the user's real input: topic, brand, facts, numbers, assets.
Never invent a placeholder company for a real subject. Brand given →
derive colors, fonts and imagery from it and say what you used.

## Slide component contract

```tsx
// src/slides/opening.tsx
import Reveal from '@/deck/Reveal';
import Build from '@/deck/Build';
import type { SlideComponent } from '@/slide/registry';

const Opening: SlideComponent = ({ slide }) => (
  <section style={{ width: '100%', height: '100%', /* your design */ }}>
    <Reveal>…entrance content…</Reveal>
    <Build at={1}>…revealed on the first click…</Build>
  </section>
);

export default Opening;
```

- The component fills the slide box (100% × 100% of the stage). Any root
  element works. `<Slide>` from `@/deck/Slide` is an optional root that
  pads with the `--gutter` tokens, centers with `center`, or goes
  edge-to-edge with `full` — use it or not.
- `slide` is the deck.json entry. `slide.props` is free-form JSON you may
  put data in (copy, numbers, image URLs) when you want it outside the
  component — for example to reuse one component across two slides.
  Ignore it when you don't need it.
- Engine helpers, all optional: `Reveal` (entrance when the slide shows),
  `Build at={n}` (hidden until the n-th click on that slide; advancing
  reveals builds, then moves on), `useInView` from `@/deck/useInView`
  (draw-in on view).
- In-place text editing in the studio works for text rendered with
  `<T path="title" />` from `@/copy/DeckText`, which reads
  `slide.props.title` (rich markers: `==accent==`, `**bold**`,
  `_italic_`). Optional.

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
    "title": "47 Maple Grove — Open house",
    "transition": "fade",        // deck default: fade | slide | rise | zoom | none
    "font": "playfair",          // optional built-in pairing: inter | space | sora | manrope | dm | outfit | playfair | fraunces
    "accent": "#B23A48"          // optional: the color `==accent==` text and `--accent` use
  },
  "slides": [
    {
      "id": "s1",                // stable string; new slides get a new id
      "position": 0,             // 0-based order
      "layout": "opening",       // src/slides/opening.tsx
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

- **Always set `background`** on every slide; it is painted under your
  component and is what thumbnails show before the component mounts.
  `{"type":"color","color":"var(--bg)"}` is the shell's fallback surface;
  `{"type":"color","color":"#0b1020"}`,
  `{"type":"gradient","from":"#…","to":"#…","angle":160}` and
  `{"type":"image","url":"https://…","dim":0.45}` (a dark scrim; engine
  floors `dim` at 0.4) are the alternatives. The component can also paint
  its own background over it.
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

## Shell tokens (`src/styles/tokens.css`)

The shell reads a handful of CSS variables: `--bg` (slide surface
fallback), `--fg` (text color the slide box inherits), `--accent` /
`--primary` (the `==accent==` marker; deck-level `accent` overrides them),
`--font-head` / `--font-body` (deck-level `font` overrides them), and
`--gutter` / `--gutter-y` (what `<Slide>` pads with). Their defaults are
neutral on purpose. Set them to the deck's design, or ignore them and
style each component directly. Change values, not names.

## Workflow

1. Ground the deck in the user's real input; decide its visual identity.
2. Bootstrap `boltSlidesId` (above).
3. Write one component per slide into `src/slides/`, then the matching
   `deck.json` entries, with speaker `notes` where they help.
4. `npm run typecheck` and `npm run build` must pass. Check narrow and
   wide. Then tell the user to look at the studio: drag to reorder, ••• or
   right-click a thumbnail to duplicate / delete, grid (G) to pick a
   slide, notes and Download on the dock, Present for the audience view.
