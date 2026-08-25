# Bolt Slides

A Pitch-style slide studio for [Bolt](https://bolt.new): a deck **editor**, a
premium **presentation engine**, and a bundled **skill** so Bolt's AI can
prompt entire decks into existence — which you then refine by hand.

Decks are structured data stored in **Postgres**. Prompted decks write
`deck` / `slides` rows. The visual editor reads and writes through the
`deck-api` edge function (share links, speaker notes), so both share one
store.

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

- `/` — In the Bolt preview iframe this is the editor: thumbnail rail,
  click-to-edit text, speaker notes. The bottom bar pages the deck and
  holds Export PDF, Present, and Share (presenter console or editor;
  optional password). Share is disabled in Bolt preview until the
  project is published. Present replaces the editor in place (Esc or
  the dock close control returns to editing). The published origin is
  the audience deck (no notes, no editor). From local Vite, **P** opens
  a presenter console in a second window. On the published audience
  deck that control stays off; use a presenter-console share link. In
  an embedded preview that control stays disabled; use Share after
  publishing.
- `/present` — Presenter console and leftover presentation share links.

## The skill

`.bolt/skills/slides/SKILL.md` covers bootstrap (apply the shipped
migration, deploy `deck-api` as-is) and authoring `deck` / `slides` rows.
Do not rewrite the app or call `deck-api` to author.

## Architecture

```
src/data/               types + zustand store (optimistic writes via deck-api)
src/layouts/            layout registry
src/components/         section components (locked)
src/deck/               presentation engine
src/edit/               editor
src/styles/tokens.css   theme: edit :root values only
supabase/functions/deck-api    edge function — browser / share backend
supabase/migrations/           schema (apply; writing the file is not enough)
```

## Theming

Everything visual derives from the `:root` tokens in `src/styles/tokens.css`.
`--accent` must stay a solid color.
