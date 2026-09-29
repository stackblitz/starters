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

A slide is a responsive web layout, not a fixed canvas. The same
component renders at phone width, in the thumbnail rail and grid, on a
laptop, on a projector, and at 1280×720 in the PDF export. It must hold
up at all of them.

**The stage.** Your component fills a box called the stage. From phone
width up to **1600×900 the stage is the window and the slide reflows**.
Beyond that the shell **scales the whole slide up** by the smaller of the
width and height ratios, so the stage you lay out in is never narrower
than 1600 or shorter than 900 — it only ever gets wider (a 2400×900 window
is a 2400×900 stage; a 2900×1300 window is a 2013×900 stage at 1.44×).
Design for 390→1600 wide at 900 tall, and let extra width be room, not
size. Measure against the stage, not the window:

- **Stage units, not viewport units.** Use `cqw` / `cqh` (the stage is
  the container named `slide`) wherever you would write `vw` / `vh`:
  `font-size: clamp(28px, 5cqw, 72px)`, `gap: 3cqh`. Viewport units
  measure the window and are wrong in thumbnails, in the PDF and on
  scaled stages.
- **Phones reflow, they don't shrink.** Below ~700px of stage width the
  slide is a different layout, like a responsive website — one column,
  the hero first, secondary material dropped or shortened, charts and
  images given their own full-width row — never the desktop composition
  scaled down. Proportional `cqw` sizing alone produces a tiny desktop
  slide; that is the failure. Restack with `@container slide
  (max-width: 700px) { … }` in a `<style>` block, or in JSX with
  `const { narrow } = useStage()` from `@/slide/stage` (also gives
  `width`/`height` of the stage in your CSS pixels) to reorder, hide or
  swap elements. Container queries and `useStage()` react to the stage;
  media queries react to the window and are wrong here.
  The canonical case — text beside a chart or image on a wide stage — is
  a single column on a phone, with the visual on its own full-width row
  at a fixed height and the type at reading size:

  ```tsx
  const { narrow } = useStage();
  <section
    style={{
      display: 'grid',
      gridTemplateColumns: narrow ? '1fr' : 'minmax(20rem, 45%) 1fr',
      gridTemplateRows: narrow ? 'auto 40cqh' : '1fr',
      gap: narrow ? '4cqh' : '4cqw',
      alignItems: 'center',
      height: '100%',
      padding: 'clamp(24px, 6cqw, 96px)',
    }}
  >
    <div>…kicker, headline, body…</div>
    <Chart style={{ width: '100%', height: narrow ? '100%' : '55cqh' }} />
  </section>
  ```

  Side by side at 390px wide — a 160px text column next to a 160px chart
  with 6px axis labels — is the failure.
- **Type has a floor, not just a ratio.** The first value of every
  `clamp()` is the phone size, and it is a real reading size: body
  16–18px, headlines 28–36px, figures 40px+. `cqw` shapes the middle;
  it never takes text below the floor.
- **Fluid sizing.** `clamp()`, `%`, `cqw`/`cqh`, `rem`, `min()`/`max()`.
  No fixed pixel widths or heights on content. Media may be the only
  fixed-ratio box (`aspect-ratio` + `max-height`, `object-fit: cover`).
- **Grids wrap.** `repeat(auto-fit, minmax(min(240px, 100%), 1fr))`,
  `flex-wrap`, or the `.cols` utility. A hardcoded column count needs a
  narrow-stage fallback (`@container slide (max-width: 900px)`).
- **Nothing out of view — ever.** A paged slide cannot scroll; anything
  past the stage edge is simply not shown, and the audience never knows
  it existed. In dev the shell measures every live slide and logs
  `[bolt-slides] Slide "…" has content out of view …` as a console
  **error**. Treat it like a failed build: fix the slide before you're
  done. Tactics, in order: cut copy; split into two slides; use the
  width (two balanced columns instead of one long one); shrink media
  before text. Never fix it with `overflow: hidden`, `nowrap` or text
  below the legibility floor. Budget the slide for its shortest stage:
  1600×900 *and* a phone in portrait; footers, sources and page numbers
  count against the budget.
- **Text gets room.** A cramped text column is the most common failure.
  Body copy runs 45–75ch wide, headlines up to ~20–28ch; a text column
  next to an image or panel takes at least ~40% of the stage at 1600
  (`minmax(min(20rem, 100%), 1fr)` or `clamp(20rem, 45%, 40rem)`),
  and a lone text block sits on a wide measure, not a sliver. Narrow
  text is a deliberate choice on one slide, never the default.
- **Fill the stage at 1600×900.** Larger screens magnify that layout,
  so what looks sparse there looks sparse everywhere. Size type, spacing
  and media so the composition uses the stage (headlines in the 5–8cqw
  range, media that takes real area), and distribute or center content
  across the height. A headline pinned top-left, a row of small tiles far
  below and a void between them is the failure. Not too wide either: a
  single text column stays ≤ ~75ch.
- **Height is the scarce axis.** Tie vertical sizes to `cqh` or fixed
  values, not `cqw`: a stage can be much wider than 16:9 but never
  shorter than 900 at reference, so width-driven heights are what push
  content out of view when a window gets wider. That includes anything
  whose height follows its width — an SVG with only `width: 100%`, an
  `aspect-ratio` box, an image without `max-height`. Give each a height
  in `cqh` or a `max-height`, and give a column that stacks a chart or
  image over text a fixed split (`grid-template-rows: 55cqh auto`).
- **Check narrow and wide.** Before you finish, look at ~390px wide and at
  ~1600px. At 390 the slide must read like a phone page (one column,
  readable type, nothing out of view), not a miniature of the wide one.
  The rail and grid render the real component, so they show breakage too.

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

### Not this — the generic-AI look

These read as template output. Don't use them unless the brief asks:

- A card with a colored **left (or top) border** as its accent.
- A **row of identical cards**, each with a mono `01 / 02 / 03` index, a
  bold title and a grey paragraph — the same for feature grids of
  icon + title + paragraph.
- Everything boxed: rounded white cards with soft shadows on every
  element, cards inside cards, a card around a single sentence.
- Decorative **status pills / tag chips**, gradient text, one rainbow
  color per list item.
- Small type and small tiles floating in a large empty stage.

Instead: hierarchy from type scale and space; rules, columns and
alignment instead of boxes; one strong element per slide (a figure, an
image, a chart, a sentence); asymmetry; real imagery; contrast in scale
between the thing that matters and everything else.

### Data, charts and figures — presentation scale, not dashboard scale

- **The number is the hero.** A KPI slide leads with the figure at
  headline size (8–14cqw) and one line of meaning; supporting numbers are
  a clear second tier, not a row of chips.
- **Charts are drawn for the room.** Inline SVG with a `viewBox`, sized
  by **height** (`height: 45cqh; width: 100%`, and `preserveAspectRatio=
  "none"` or `xMidYMid meet`) so a wider stage cannot make the chart
  taller and push what's below it out of view. Strokes, ticks and labels
  sized to read from the back (labels ≥ 1.1cqw); labels stay inside the
  `viewBox` (pad the last point, or anchor end labels with
  `text-anchor="end"`). A chart takes real area (half the stage or more)
  — never a widget inside a card inside the slide.
- **Labels never live inside data-sized shapes.** Funnel steps, bars and
  bubbles shrink with their values; text does not. Put labels and values
  beside or above the shape on a fixed grid, and never let a word wrap
  mid-word or a label outgrow its box.
- **No dashboard furniture.** No card borders around a single chart, no
  legend chips, no "widget title" captions in 11px. Title, chart, one
  takeaway.

### Alignment — it's a stage

- **Vertically centered by default.** The composition sits in the middle
  of the stage (or is distributed across its full height); top-anchor
  only when the slide is genuinely full (a dense table, a full-bleed
  image with a caption). A headline at the top with the bottom half empty
  is wrong on every screen size.
- **One grid.** Kicker, headline, body and blocks share left edges (or a
  common center); one gutter value per deck; nothing floats between the
  edges. Two columns align at the top *and* balance in height.
- **Left-anchored text needs a counterweight** — an image, a figure, a
  chart on the other side. A text-only slide is centered, or set on a
  deliberate wide measure with the space used on purpose.
- **Kicker above headline, never beside it.** Small label, then the
  headline, sharing a left edge (or both centered).

### Legibility floor — check every slide before you're done

At 1600×900 no text is smaller than 16px (~1cqw), and at 390 wide none is
smaller than 12px. Nothing wraps mid-word, nothing is clipped, nothing is
out of view (no `[bolt-slides] … out of view` console errors), no label
is larger than the shape it sits in, and the composition occupies at
least ~60% of the stage height. If a slide fails any of these, fix the
slide — don't shrink the text.

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

- The component fills the stage (100% × 100%; a CSS container named
  `slide`, so `cqw`/`cqh` and `@container slide (…)` measure it). Any root
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
  (draw-in on view), `useStage()` from `@/slide/stage` (`{ width,
  height, narrow }` of the stage the component is laid out in).
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
