# Bolt Slides — starter

A Pitch-style slide studio for [Bolt](https://bolt.new): a deck **editor**, a
premium **presentation engine**, and a bundled **skill** so Bolt's AI can
prompt entire decks into existence — which you then refine by hand.

Everything persists to **one portable JSON file** (`data/deck.json`) with no database and no dependencies — the development stand-in for a hosted backend.

## Quick start

```bash
npm install
npm run dev        # editor at http://localhost:5173 · present at /present
```

The first run creates an empty deck from `data/deck.seed.json` — add slides in
the editor, or prompt one into existence with the `slides` skill.

## What's inside

| Route | What it is |
|---|---|
| `/` | Editor — thumbnail rail (always open; drag to reorder, right-click to duplicate/delete/insert), click any text on the slide to edit it, inspector for layout props · background (color/gradient/image) · animation · transition, comments, per-slide status, speaker notes |
| `/present` | Presentation — floating dock, side panel (S) and grid overview (G), click-builds, presenter view with notes + timer (P), annotation mode (D — pen, highlighter, laser, shapes, eraser, undo/redo), fullscreen (F) |

- **Share** (top bar) makes one link per mode: the presentation (read only, no
  speaker notes), the presenter console (read, plus notes), or the editor (full
  access). Any link can carry a password. You keep full access from this
  machine; everyone else needs a link.

  What that layer is and is not: passwords are scrypt hashes (N=2^16, ~90ms a
  guess) with a per-share salt, unlock attempts are capped at 8 per address per
  10 minutes, links are 96-bit random tokens, and writes are rejected unless
  they come from this origin. It is a decent lock on a door, not an identity
  system: there are no accounts, anything that can reach the server on loopback
  is the owner, and over plain HTTP a link and its password travel in the clear
  — put a tunnel with TLS in front before sharing anything that matters.
- **Export PDF** (top bar) renders every slide at 1280×720 and downloads a PDF.
- **OG image** (top bar) renders slide 1 to `public/og.png`, wired to the
  OpenGraph tags in `index.html` — share a deployed deck and slide 1 is the
  preview card.
- **People are lightweight profiles** (name + color, no passwords) — you're
  asked who you are the first time you comment, never before.

## Decks as data

A slide is a row: `layout` + JSON `props` + background/animation/transition +
status/notes. 31 premium layouts (cover, section, statement, manifesto, big
number, quote, agenda, steps, pillars, timeline, contrast, comparison, table, tabs,
accordion, q&a, pricing, team, logos, poster, story, speaker, persona, bento, stat grid, figures, chart, insight, chat, code) render those rows through `src/layouts/` — so the AI can author decks
and the editor can edit them without either touching React code.

```bash
node scripts/deck.mjs export deck.draft.json   # deck → JSON
node scripts/deck.mjs import deck.draft.json   # JSON → deck (data/deck.json)
node scripts/deck.mjs apply                    # import the draft if it changed
node scripts/deck.mjs status                   # slide list: layout · status · owner
node scripts/deck.mjs reset                    # re-seed from data/deck.seed.json
```

Two files, one name: `deck.draft.json` is the portable deck you hand to the CLI,
`data/deck.json` is the live database it writes. The second is generated and
gitignored — edit the deck in the app or re-import, never by hand.

Importing while the editor is open is fine: the dev server watches
`data/deck.json` and tells the app to re-fetch, so an import from the skill (or
from your own terminal) shows up without a page reload. Saves the editor makes
itself are excluded, so a re-fetch never lands on top of what you are typing.

A `deck.draft.json` left unimported is applied on its own — by `predev` if it is
there before the server boots, by the watcher if it appears after. The deck
records which draft content it already reflects, so a draft applies once and a
restart never re-applies it. Editing in the app does not change the draft, so
your work is what survives; a draft with new content in it is what replaces the
deck.

Round trips are lossless: `export` carries slide ids and `import` keeps them, so
exporting a deck, editing the JSON and importing it back leaves the slides —
and the comments attached to them — intact. Slides written without an `id` are
new, and a comment whose slide is gone goes with it.

## The skill

`.bolt/skills/slides/SKILL.md` teaches Bolt's AI to author decks as JSON —
including which animation, transition, background and status to set per slide
— and to import them with the CLI. Ask Bolt for "a 12-slide seed pitch for …"
and refine what lands in the editor.

## Publishing

Publish and the deck presents — read-only.

The API lives in the Vite dev server, so a published build has no backend to
talk to. `npm run build` therefore bakes the current deck into the bundle as
`deck-snapshot.json`, and the app falls back to it when no API answers. A
published link gets every layout, animation, transition, present mode and
presenter view. It cannot write: no editing, no comments, and `/` redirects
to `/present`.

Two things worth knowing:

- **The snapshot is taken at build time** — re-publish to push later edits.
- **Speaker notes are baked in and public.** Anyone with the link can open
  presenter view and read them. Per-slide status, comments, profiles and share
  links are stripped from the snapshot and never leave your machine.

Editing a published deck — plus comments, share links and passwords, which all
need a server to enforce — means moving storage to a real backend:
**[docs/cloud-setup.md](docs/cloud-setup.md)** has the route contract, the
table layout, the permission rules, the owner question (the bare published URL
is a credential — decide that deliberately) and a publish checklist.

`npm run preview` deliberately serves the build *without* the API, so it shows
you what visitors get.

## Architecture

```
data/deck.json          ← the single source of truth (gitignored; seed JSON is committed)
server/db.mjs           ← JSON file persistence + cross-process reload
server/api.mjs          ← REST API, mounted on the Vite dev server (vite.config.ts)
server/snapshot.mjs     ← bakes the deck into the build so published decks render
server/draft.mjs        ← applies an unimported deck.draft.json (predev + watcher)
scripts/deck.mjs        ← import/export/apply/reset/status CLI
src/data/               ← types + zustand store (optimistic writes)
src/layouts/            ← the layout registry: props schema + renderer per layout
src/components/         ← the premium section components (locked design system)
src/deck/               ← the presentation engine (dock, rail, builds, presenter)
src/slide/SlideView.tsx ← one slide row → pixels (backgrounds, animation modes)
src/edit/               ← the editor (rail, canvas, inspector, comments, notes)
src/export/             ← PDF + OG rendering (off-screen iframes)
src/styles/tokens.css   ← the theme: edit :root values only; accent is ONE solid color
```

## Theming

Everything visual derives from the `:root` tokens in `src/styles/tokens.css`
— change the values (never the names) to re-brand the deck AND the editor
chrome in one place. `--accent` must stay a solid color.
