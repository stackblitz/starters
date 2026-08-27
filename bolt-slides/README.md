# Bolt Slides

A Pitch-style slide studio for [Bolt](https://bolt.new): prompt a deck into
`deck.json`, refine it in the studio rail, present full-screen, and
download PDF or JSON.

The prompt skill writes `deck.json` (and `src/styles/tokens.css` for
theme). The studio and the published audience deck both read that file.

## Quick start

```bash
npm install
npm run dev        # studio at http://localhost:5173 — Present swaps this view
```

Prompt a deck with the `slides` skill, or edit `deck.json` directly.
In the studio, drag the rail to reorder, right-click a thumbnail to
duplicate or delete, then Present or Download as PDF / JSON.

## What's inside

- `/` — In the Bolt, this is the studio:
  thumbnail rail, live canvas. The bottom bar pages the deck and holds
  Download as (PDF, JSON) and Present. Present replaces the studio in
  place (Esc or the dock close control returns). The published origin is
  the audience deck. **P** on the dock opens the presenter console in a
  second window.
- `/present?presenter=1` — Presenter console: notes, next-up, timer,
  highlight, note text size.

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
