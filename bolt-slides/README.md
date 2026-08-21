# Bolt Slides

A Pitch-style slide studio for [Bolt](https://bolt.new): a deck **editor**, a
premium **presentation engine**, and a bundled **skill** so Bolt's AI can
prompt entire decks into existence — which you then refine by hand.

Decks are structured data (layout + props + notes) stored in a **database**
and read/written through the deck API. The skill authors JSON and imports it
via that API — never via a file on disk.

## Quick start

```bash
npm install
npm run dev        # editor at http://localhost:5173 · present at /present
```

The first run starts from an empty deck — add slides in the editor, or prompt
one into existence with the `slides` skill.

## What's inside

- `/` — Editor: thumbnail rail (drag to reorder, right-click to
  duplicate/delete/insert), click any text on the slide to edit it, inspector
  for layout props · background · animation · transition, comments, per-slide
  status, speaker notes.
- `/present` — Presentation: floating dock, side panel (S) and grid overview
  (G), click-builds, presenter view with notes + timer (P), annotation mode
  (D), fullscreen (F).
- **Share** (top bar) makes one link per mode: presentation (read only, no
  speaker notes), presenter console (read, plus notes), or editor (full
  access). Any link can carry a password.
- **Export PDF** and **OG image** live in the top bar.

## The skill

`.bolt/skills/slides/SKILL.md` teaches Bolt's AI to author decks as JSON and
import them through the deck API. Ask Bolt for "a 12-slide seed pitch for …"
and refine what lands in the editor.

## Publishing

Shareable, durable decks need the cloud backend (Postgres + an edge function
that implements the same API contract). See
**[docs/cloud-setup.md](docs/cloud-setup.md)** for the route contract, table
layout, permission rules, and publish checklist.

## Architecture

```
src/data/               types + zustand store (optimistic writes via the API)
src/layouts/            layout registry: props schema + renderer per layout
src/components/         section components (locked design system)
src/deck/               presentation engine (dock, rail, builds, presenter)
src/slide/SlideView.tsx one slide row → pixels
src/edit/               editor (rail, canvas, inspector, comments, notes)
src/export/             PDF + OG rendering
src/styles/tokens.css   theme: edit :root values only; accent is ONE solid color
server/                 local API stand-in for the database (dev only)
```

## Theming

Everything visual derives from the `:root` tokens in `src/styles/tokens.css`
— change the values (never the names) to re-brand the deck AND the editor
chrome in one place. `--accent` must stay a solid color.
