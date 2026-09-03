# Bolt Slides

A Pitch-style slide studio for [Bolt](https://bolt.new): prompt a deck into
`deck.json`, refine it in the studio, present in a new tab, and
download PDF or JSON.

The prompt skill writes `deck.json` (and `src/styles/tokens.css` for
theme). The studio and the published audience deck both read that file.

## Quick start

```bash
npm install
npm run dev        # studio at http://localhost:5173 — Present opens a new tab
npm run lint       # ESLint (same kit as bolt-vite-react-ts)
npm run typecheck
```

Prompt a deck with the `slides` skill, or edit `deck.json` directly.
In the studio, drag to reorder, use a thumbnail’s ••• menu (or
right-click) to duplicate or delete, edit speaker notes, then Present
or Download as PDF / JSON.

## What's inside

- `/` — In Bolt this is the studio: canvas, side panel (S), grid (G),
  and a floating dock (pager, notes, Download, Present, Presenter).
  Present opens `/?present=1` in a new tab; the studio stays put.
  Fullscreen is F in that tab. The published origin is the audience
  deck. **P** opens the presenter console in a second tab.
- `/?presenter=1` — Presenter console: on-screen now, up next, notes
  (read-only), timer, note text size. `/present` is the same route.

Collaborate by sharing the Bolt project.

## The skill

`.bolt/skills/slides/SKILL.md` covers bootstrap (mint `boltSlidesId` on
first write) and authoring `deck.json` plus `src/styles/tokens.css`.

## Architecture

```
deck.json               canonical deck (envelope + slides)
src/data/               types + zustand store (Vite DEV persists via POST /__deck)
src/layouts/            layout registry
src/components/         section components
src/deck/               presentation engine
src/edit/               studio chrome
src/styles/tokens.css   theme: edit :root values only
```

## Theming

Everything visual derives from the `:root` tokens in `src/styles/tokens.css`.
`--accent` must stay a solid color.
