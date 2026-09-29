# Bolt Slides

A Pitch-style slide studio for [Bolt](https://bolt.new): prompt a deck,
refine it in the studio, present in a new tab, and download PDF or JSON.

Each slide is a React component in `src/slides/`, listed in `deck.json`.
There is no layout catalog: the agent designs every slide for the deck at
hand. The one rule is that every slide is responsive — it renders at phone
width, in the thumbnail rail, on a projector and at 1280×720 in the PDF.

The prompt skill (`.bolt/skills/slides/SKILL.md`) covers bootstrap (mint
`boltSlidesId` on first write), the slide component contract, the
`deck.json` shape and the responsiveness rule.

## Quick start

```bash
npm install
npm run dev        # studio at http://localhost:5173 — Present opens a new tab
npm run lint       # ESLint (same kit as bolt-vite-react-ts)
npm run typecheck
```

Prompt a deck with the `slides` skill, or write `src/slides/*.tsx` and
`deck.json` directly. In the studio, drag to reorder, use a thumbnail’s
••• menu (or right-click) to duplicate or delete, edit speaker notes, then
Present or Download as PDF / JSON.

## What's inside

- `/` — In Bolt this is the studio: canvas, side panel (S), grid (G),
  and a floating dock (pager, notes, Download, Speaker view, Present).
  Present opens `/?present=1` in a new tab; the studio stays put.
  Fullscreen is F in that tab. The published origin is the audience
  deck. **P** opens speaker view in a second tab.
- `/?presenter=1` — Speaker view: current slide, up next, notes
  (read-only), timer, note text size. `/present` is the same route.

Collaborate by sharing the Bolt project.

## Authoring

- `src/slides/<name>.tsx` — a slide: default-export a component typed
  `SlideComponent` (from `@/slide/registry`). It receives the deck.json
  entry as `slide`; `slide.props` is free-form data it may read.
  `@/deck/Slide`, `@/deck/Reveal`, `@/deck/Build` and
  `@/deck/useInView` are optional helpers.
- `deck.json` — the ordered slides. `layout` is the component filename
  (without `.tsx`); `background`, `animation`, `transition`, `nav`,
  `notes` and `status` are read by the studio, presenter and export.
- `src/styles/tokens.css` — the theme (`:root` values).

## Architecture

```
deck.json               canonical deck (envelope + slide entries)
src/slides/             the deck's slide components (authored per deck)
src/slide/              SlideView + the src/slides registry (import.meta.glob)
src/data/               types, zustand store, deck.json persistence
src/deck/               presentation engine + chrome (dock, rail, grid, presenter)
src/studio/             studio chrome
src/present/            audience / speaker routes
src/export/             PDF export
src/copy/               rich text + in-place text edit persist
src/styles/tokens.css   theme: edit :root values only
```

## Theming

Everything the shell paints derives from the `:root` tokens in
`src/styles/tokens.css`. `--accent` must stay a color value (the
atmosphere mixes from it).
