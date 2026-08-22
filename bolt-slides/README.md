# Bolt Slides

A Pitch-style slide studio for [Bolt](https://bolt.new): a deck **editor**, a
premium **presentation engine**, and a bundled **skill** so Bolt's AI can
prompt entire decks into existence — which you then refine by hand.

Decks are structured data stored in **Postgres** and read/written through the
`deck-api` edge function. The skill authors JSON and imports it via that API.
The visual editor talks to the same API, so agent imports and in-preview
edits share one store.

## Quick start

```bash
npm install
npm run dev        # editor at http://localhost:5173 — Present swaps this view
```

On first use in Bolt the agent must apply
`supabase/migrations/create_deck_tables.sql` and deploy
`supabase/functions/deck-api` (the instance is already provisioned; the
schema and function are not). After that, add slides in the editor or prompt
a deck with the `slides` skill.

## What's inside

- `/` — Editor: thumbnail rail, click-to-edit text, speaker notes. The
  bottom bar pages the deck and holds Export PDF, Present, and Share
  (one link per mode: presentation, presenter console, or editor; optional
  password). Present replaces the editor in place (Esc or the dock close
  control returns to editing). The presenter console (P) still opens a
  second window.
- `/present` — Same presentation engine, used by share links. Dedicated
  present/share URLs often fail in Bolt preview (WebContainer vs published
  origin); treat that as environmental.

## The skill

`.bolt/skills/slides/SKILL.md` teaches Bolt's AI to bootstrap the database,
author decks as JSON, and import them through the deck API.

## Architecture

```
src/data/               types + zustand store (optimistic writes via deck-api)
src/layouts/            layout registry
src/components/         section components (locked)
src/deck/               presentation engine
src/edit/               editor
src/styles/tokens.css   theme: edit :root values only
supabase/functions/deck-api    edge function — the only backend
supabase/migrations/           schema applied via apply_migration MCP
```

## Theming

Everything visual derives from the `:root` tokens in `src/styles/tokens.css`.
`--accent` must stay a solid color.
