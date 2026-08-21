# Bolt Slides — starter

A Pitch-style slide studio for [Bolt](https://bolt.new): a deck **editor**, a
premium **presentation engine**, and a bundled **skill** so Bolt's AI can prompt
entire decks into existence — which you then refine by hand.

The deck lives in the project's Postgres database, reached through one Edge
Function. There is no local copy and no file to keep in sync: the editor, the
presenter console and the deck you publish are all looking at the same rows.

## Quick start

The project needs a database before it has anywhere to keep a deck. In Bolt, ask
for one and the rest is done for you — the schema is applied and the `deck`
function deployed. Until then the app says so instead of pretending to be empty.

```bash
npm install
npm run dev        # editor at http://localhost:5173 · present at /present
```

Working outside Bolt? Point `.env` at a Supabase project (see `.env.example`),
apply `supabase/schema.sql`, deploy `supabase/functions/deck`, and copy the
deck's `owner_key` into `.env` as `DECK_OWNER_KEY`.

## What's inside

| Route      | What it is                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`        | Editor — thumbnail rail (always open; drag to reorder, right-click to duplicate/delete/insert), click any text on the slide to edit it, inspector for layout props · background (color/gradient/image) · animation · transition, per-slide status, speaker notes |
| `/present` | Presentation — floating dock, side panel (S) and grid overview (G), click-builds, presenter view with notes + timer (P), annotation mode (D — pen, highlighter, laser, shapes, eraser, undo/redo), fullscreen (F)     |

- **Share** makes one link per mode: the presentation (read only, never the
  speaker notes), the presenter console (read, plus writing notes), or the
  editor (full access). Any link can carry a password. Links point at the
  published deck, since the address the editor runs on opens for nobody else.
- **Export PDF** renders every slide at 1280×720 and downloads a PDF.
- Drop a 1200×630 `public/og.png` in to give a shared link a preview card; the
  OpenGraph tags in `index.html` are already wired to it.

## Who can do what

The rules are enforced in the `deck` function, because that is the only place
they can be: the anon key ships inside every published deck, so anyone the deck
is shared with can call the API with whatever headers they like.

- **The tables have row level security enabled and no policies at all.** That is
  the model, not an omission — the anon key reaches nothing directly. Adding a
  policy for `anon` would hand the audience the speaker notes and a way to
  rewrite the deck.
- **Editing is proved by the deck's `owner_key`**, which `vite.config.ts` hands
  to the app only while the dev server is serving it. `vite build` never defines
  it, so a published deck is keyless by construction: whoever opens it cannot
  edit it. Sharing the editor is what an `edit` link is for.
- **Passwords** are PBKDF2-SHA256 (210,000 iterations, per-link salt), and
  attempts are capped per address so guessing a short password stays hopeless.
- **Speaker notes** are never sent to the audience view. Not hidden in the UI —
  not sent.

## Decks as data

A slide is a row: `layout` + JSON `props` + background/animation/transition +
status/notes. 31 premium layouts (cover, section, statement, manifesto, big
number, quote, agenda, steps, pillars, timeline, contrast, comparison, table,
tabs, accordion, q&a, pricing, team, logos, poster, story, speaker, persona,
bento, stat grid, figures, chart, insight, chat, code) render those rows through
`src/layouts/` — so the AI can author decks and the editor can edit them without
either touching React code.

The whole deck moves as one JSON document, in and out:

```sql
select export_deck();                        -- the deck as portable JSON
select import_deck($json$ { … } $json$);     -- replace it, reporting what landed
```

Importing keeps slide identity — by `id` where the incoming deck names one,
otherwise by position — so re-importing an edited deck is a change rather than a
replacement. An open editor notices within a few seconds, because it polls the
deck's version rather than waiting to be reloaded.

## The skill

`.bolt/skills/slides/SKILL.md` teaches Bolt's AI to author decks as JSON —
including which animation, transition, background and status to set per slide —
and to import them with `import_deck`. Ask Bolt for "a 12-slide seed pitch for …"
and refine what lands in the editor.

## Publishing

Publish the project and the deck comes with it, live: the published site reads
the same database, so an edit made in the editor shows up on it. That is also
what makes a share link worth sending — it opens the deck as it is, not a copy
of it as it was.

The first load of the published site records its own address (browsers set
`Origin`, and page scripts cannot forge it), which is the base every share link
is built on. A custom domain works without being configured anywhere; you can
also set it by hand in the Share dialog.

## Architecture

```
supabase/schema.sql       ← the deck: tables, import_deck/export_deck, RLS with no policies
supabase/functions/deck/  ← the only way in: routing (routes.ts) + the rules (access.ts)
src/data/                 ← types, the backend client, and the zustand store (optimistic writes)
src/layouts/              ← the layout registry: props schema + renderer per layout
src/components/           ← the premium section components (locked design system)
src/deck/                 ← the presentation engine (dock, rail, builds, presenter)
src/slide/SlideView.tsx   ← one slide row → pixels (backgrounds, animation modes)
src/edit/                 ← the editor (rail, canvas, inspector, notes)
src/export/               ← PDF rendering (off-screen iframes)
src/styles/tokens.css     ← the theme: edit :root values only; accent is ONE solid color
```

[docs/architecture.md](docs/architecture.md) is the long version: the route
contract, the permission rules, and why they sit where they do.

## Theming

Everything visual derives from the `:root` tokens in `src/styles/tokens.css` —
change the values (never the names) to re-brand the deck AND the editor chrome in
one place. `--accent` must stay a solid color.
