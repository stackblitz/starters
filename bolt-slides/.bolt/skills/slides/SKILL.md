---
name: slides
description: >-
  Author a premium slide deck INTO the Bolt Slides editor — a Pitch-style
  slide builder (this repo) where slides live as rows in a database.
  You author the deck as JSON (layouts, copy, backgrounds, animation and
  transition choices, statuses, speaker notes) and import it through the
  deck API; the user then edits any of it in place, comments, presents
  full-screen, exports PDF and an OpenGraph image. Use
  this whenever the user asks for a deck, a pitch, slides, or a
  presentation in this project.
---

# Slides — prompt decks into an editable, presentable app

This repo is a complete slide **studio**, already built and running:

- `/` — the editor: persistent thumbnail rail (drag to reorder, right-click to
  duplicate/delete), click-to-edit text on the slide itself, an inspector for
  every layout prop, background and scale, plus comments and speaker notes.
- `/present` — the premium presentation engine: floating dock, side panel (S)
  and grid overview (G), click-builds, presenter view (P), annotator (D),
  fullscreen (F).
- **The database is the only store.** Deck rows live in Postgres and are
  read/written through the deck API. Never write, read, copy, or back up a
  deck to `data/deck.json` (or any other file on disk). JSON is only the
  interchange format you POST to the API.

**Your job is to author CONTENT, not code.** A deck is data: you write JSON
and import it through the API. You never write JSX slides.

## Hard rules

1. **Don't touch the app — you only generate slides.** The editor UI, the
   presentation engine, the layouts, the server are the finished product:
   never rewrite, "improve", restyle, or regenerate any of it. Off-limits, no
   exceptions: `src/edit/`, `src/deck/`, `src/present/`, `src/slide/`,
   `src/layouts/`, `src/components/`, `src/styles/base.css`,
   `src/styles/editor.css`, `server/`, `scripts/`, `index.html`, `vite.config.ts`.
   That includes every piece of app chrome — the editor's top bar, thumbnail
   sidebar, inspector and modals, and present mode's dock, side panel, grid
   overview, presenter view and annotator. A deck request that mentions colors,
   fonts, sizes or spacing is about the DECK (deck `accent` + `font`, or
   `tokens.css`), never about the UI. The ONLY things you touch:
   `src/styles/tokens.css` (`:root` values, to theme the deck) and the deck
   API (import / export / slide mutations). If the user genuinely wants an
   app change, say so and let them ask for it outside this skill.
2. **Author from the user's REAL input.** Their topic, brand, facts, numbers.
   Never reskin the seed deck; never invent a placeholder company for a real
   subject. Brand given → derive theme colors/fonts from it (fetch the site or
   use its known palette) and say what you used.
3. **The accent is ONE SOLID color.** `--accent` must be a solid hex — never a
   gradient. Keep restraint: one accent, used sparingly.
4. **Database only.** Do not create, read, or mention `data/deck.json`. Do not
   use `scripts/deck.mjs` or any file-based CLI to store or back up a deck.
   If the API is down, say so — do not fall back to a JSON file.

## Workflow

```bash
npm install && npm run dev        # 1 · the studio runs at :5173
# 2 · theme: edit ONLY the :root values in src/styles/tokens.css
# 3 · author the deck: write a JSON payload (format below)
# 4 · import it (replaces the deck in the database)
curl -sS -X POST "${DECK_API:-http://localhost:5173/api}/import" \
  -H "Content-Type: application/json" \
  --data-binary @deck.json
# 5 · verify
curl -sS "${DECK_API:-http://localhost:5173/api}/state" | head
```

`$DECK_API` is the deck API origin (no trailing slash). Default to
`http://localhost:5173/api` while the studio is running locally; on a
published project use the edge-function origin instead (see
`docs/cloud-setup.md`).

To read the current deck back before editing so you keep the user's changes:

```bash
curl -sS "${DECK_API:-http://localhost:5173/api}/export" -o deck.json
```

**Never test against the user's live deck.** A slide PUT replaces `props`
wholesale and an empty `notes` erases what was there. Duplicate a slide and
work on the copy, or export first so you can put it back.

## Deck JSON

```jsonc
{
  "title": "Acme — Series A",
  "transition": "fade",            // deck default: fade | slide | rise | zoom | none
  "font": "inter",                 // inter | space | sora | manrope | dm | outfit | playfair | fraunces
  "accent": "#1688FC",             // optional — deck-wide accent (solid hex); omit for the tokens.css default
  "slides": [
    {
      "layout": "cover",           // one of the layouts below
      "props": { ... },            // layout-specific (see catalog); every layout
                                   // also accepts "scale": "lg" | "xl" (+15/+30%
                                   // text size — for sparse slides like pricing)
      "animation": "cascade",      // cascade | rise | fade | zoom | none
      "transition": "zoom",        // optional per-slide override
      "background": { "type": "gradient", "from": "#141e30", "to": "#243b55", "angle": 160 },
      "notes": "Open with the hook.",   // speaker notes (presenter view)
      "status": "draft"            // optional review state: none (default) |
                                   // draft | in-progress | review | approved
    }
  ]
}
```

**Rich text** in any text prop: `==accent==` renders in the accent color,
`**bold**` bold, `_italic_` italic, `{c:#ff6b6b}text{/c}` a specific text
color (`{c:accent}` works too), `{s:1.4}text{/s}` font size as an em
multiplier (0.4–4 — stays responsive), `\n` line break. A whole field can
override its alignment with a `{a:l}` / `{a:c}` / `{a:r}` prefix (rarely
needed — layouts already align deliberately). Markers nest across types. Discipline: `==` on the one or two words that carry each headline;
custom colors and sizes are for rare, deliberate moments — the theme does the
typography.

**Backgrounds**: `{"type":"none"}` (default — the themed atmosphere),
`{"type":"color","color":"#0b1020"}`,
`{"type":"gradient","from":"#…","to":"#…","angle":160}`,
`{"type":"image","url":"https://…","dim":0.45}` (dim 0–0.85 keeps text legible).
Most slides should stay `none`; save backgrounds for moments (a section break,
a photo cover). Photos: `https://images.unsplash.com/...?w=1600&q=80`.

**Animation** is per-slide and user-changeable later — pick deliberately:
`cascade` (default — the layout's designed staggers) for almost everything;
`fade` for quotes/statements you want to land quietly; `rise` or `zoom` as an
occasional emphasis beat; `none` only for dense reference slides.
**Transitions**: set ONE deck default (usually `fade`); override per-slide
sparingly (`zoom` into section dividers works well).

**Numbers animate themselves**: any figure-like string (`"$3T"`, `"48%"`,
`"1,200+"`) counts up on reveal automatically. Just write the string.

## Layout catalog (props per `layout`)

Statement-scale (use for rhythm — every deck needs breathing room):

- `cover` — `kicker`, `title`, `subtitle`, `image?` (full-bleed photo), `foot?`
  ("June 2026 · Dana Kim"). The opener; also great as a closing CTA.
- `section` — `n` (chapter number), `kicker`, `title`, `image?`. Divider with a
  huge ghost numeral.
- `statement` — `kicker?`, `title`, `body?`. One centered thought.
- `bigNumber` — `kicker?`, `value` ("$3T"), `caption`, `foot?` (source). The
  drama beat — use at least once.
- `manifesto` — `label` (small caps, top-left), `text` (a large multi-sentence
  statement, right column, top-aligned; the lower half stays empty on
  purpose). The editorial breather.
- `quote` — `text` (no quotation marks — the mark is provided), `name?`,
  `role?`, `img?` (avatar), `image?` (full-bleed bg).

Structured:

- `agenda` — `kicker?`, `title?`, `items: [{title, hint?}]` (hint = time/owner).
- `steps` — `kicker?`, `title?`, `items: [{title, body?}]` (3–4 steps).
- `pillars` — `title` (top-left), `items: [{title, body}]` (2–4): numbered
  focus-area columns anchored to the lower half, generous empty middle.
  `large: true` scales the columns up (best with 2–3 items). Steps without
  the process connotation.
- `timeline` — `kicker?`, `title?`, `items: [{time, title, body?}]`. Roadmaps.
- `contrast` — `kicker?`, `title?`, `left: {label, title, points: []}`,
  `right: {…}`. Before/after; right panel is the accent-lit "after".
- `comparison` — `kicker?`, `title?`, `cols: ["", "Us", "Them"]` (first entry is the label-column
  header, usually empty), `highlight: 0` (0-based value column),
  `rows: [{label, values: [true, false]}]` (booleans → ✓/✗ chips; strings
  pass through, e.g. "$29").
- `table` — `kicker?`, `title?`, `columns: ["Region", "ARR", "Growth"]`, `rows: [["NA", "$2.4M",
  "+38%"], …]` (each row = one string per column), `highlightCol?`, `caption?`,
  `filled?` (solid accent header row — the schedule/agenda look),
  `large?` (near full-width, bigger cells — pair with `filled` for the
  schedule slide), `labelLeft?` (small-caps label above the table).
  Real data only; ≤5 cols, ≤7 rows.
- `tabs` — `kicker?`, `title?`, `tabs: [{label, content}]`.
- `accordion` — `kicker?`, `title?`, `items: [{title, body}]`. FAQs/objections.
- `qa` — `title` (big, top-left), `items: [{q, a}]` (3–5): question left,
  answer right, striped rows with mono Q/A markers. `large: true` scales the
  rows up and runs near full width (3–4 items max there). The flat, scannable FAQ
  (accordion is the interactive one).
- `pricing` — `kicker?`, `title?`, `tiers: [{name, price, period?, blurb?,
  features: [], highlight?, badge?}]` (highlight exactly one).
- `team` — `kicker?`, `title?`, `people: [{name, role?, img?}]` (no img →
  initials avatar).
- `logos` — `kicker?`, `title?`, `items: "Acme | Northwind | Globex"`. Marquee.

Visual:

- `bento` — `kicker?`, `title?`, `tiles: [{k?, fig?, title?, body?, c, r,
  variant?, img?}]`. `c` of 12 columns (rows must sum to 12: 8+4, 4+4+4…),
  `variant`: one `accent` OR `glow` tile max. The feature-grid workhorse.
- `statGrid` — `kicker?`, `title?`, `stats: [{value, label, caption?}]` (3–4).
- `figures` — `title`, `body` (intro, top-left; leave empty for the
  big-title variant), `items: [{label, value, caption?}]` (2–4): small-caps
  labels mid-slide, GIANT figures anchored low, optional small-caps caption
  under each figure. `cards: true` puts each column on a material card;
  `cardBg: {type:'color'|'gradient', …}` overrides the card surface (pairs
  well with a gradient slide background). The editorial alternative
  to statGrid.
- `poster` — `title`, `body` (anchored bottom-left), `label` (small centered
  text over the visual), `image?` (right panel; empty → themed gradient wash),
  `inset?` (panel floats inset with rounded corners instead of full-bleed),
  `flip?`. The editorial splash slide.
- `story` — `kicker`, `title`, `body` (a fuller paragraph than most slides —
  this layout earns it), `pair` (default true: TWO portrait images side by
  side on the right; false: one larger image), `image?`, `image2?`, `flip?`.
  Empty images → gradient wash. The narrative beat.
- `speaker` — `label` (small caps, top-left), `name`, `role` (small caps,
  supports \n), `bio`, `image?` (portrait, bottom-anchored right; empty →
  gradient wash), `flip?`. The presenter/profile slide.
- `persona` — `title` (big multi-line "Meet X, role, company"), `body` (their
  story), `label` (small caps, anchored bottom), `image?` (tall portrait
  left, near full height; empty → gradient wash), `flip?`. The client /
  case-study intro.
- `chart` — `kicker?`, `title?`, `kind: bars|line|donut|donuts|grouped|lines`,
  `color?` (overrides the accent for this chart only).
  Data per kind: `bars: [{label, value}]` · `points: "12 | 18 | 26"` ·
  `donutValue` + `donutLabel` · `donuts: [{value, label}]` (row of 2–4) ·
  grouped: `categories: "Jan | Mar"` + `series: [{label, values: "10 | 20"}]`
  (2–3 series, y-axis + legend) · lines: `lines: [{label, points}]` (2–3
  small multiples, independent scales). `large?` scales the chart up and
  runs near full width; `values?: false` hides the data-point figures.
  `caption?`.
- `insight` — `title`, `subtitle`, `color?`, `kind: bars|line|donut` + chart data as
  above (`points_line` for the line; `values?: false` hides figures),
  `heading`, `points: [{label, body}]` (2–3 small-caps takeaways beside the
  chart). The chart-with-interpretation slide.
- `chat` — `kicker?`, `title?`, `name`, `messages: [{from: user|ai, text}]`.
  Messages reveal per click. AI-product decks.
- `code` — `kicker?`, `title?`, `filename`, `code`, `highlight: "2,3"`.
- `canvas` — freeform positioning: `items: [{type, x, y, w, h, …}]`,
  coordinates in PERCENT of the slide (x/w of width, y/h of height; array
  order = stacking order, later = on top; every item takes `rot?` degrees).
  Types: `text` `{text, font?: head|body}` (rich markers work — size with
  `{s:…}`; default = the deck's HEADING font; `head` adds title weight,
  `body` = the body font — use it for paragraph copy) · `image` `{url, radius?}` (empty url → themed gradient wash) ·
  `shape` `{shape: rect|rounded|circle|triangle|diamond|star, variant:
  fill|outline, fill?, stroke?, strokeW?, radius?}` (colors = any CSS color;
  empty → subtle accent glass) · `line` `{strokeW?, dash?, arrows:
  none|end|both, fill?}` (thin divider/arrow — give it a small h like 2.5) ·
  `chart` `{kind: bars|line|donut, bars/points/donutValue+donutLabel,
  fill?}` (fill recolors the chart) · `table` `{columns: [], rows: [[]],
  highlightCol?}` (themed data table) · `compare` `{cols: ["", "Us",
  "Them"], cmpRows: [{label, values: [true, false]}], highlight?}` (the
  ✓/✗ comparison matrix). The user edits everything visually (insert bar,
  snap-drag, rotate, per-element settings panel, Edit-data sheet). Reach
  for a structured layout FIRST — canvas is for the rare bespoke
  arrangement no layout covers, and it's on you to place things with real
  care (align edges, use the 50% center line, leave breathing room).

## Deck design discipline

- **10–16 slides.** Arc: hook → problem → shift → product proof → numbers →
  plan → team/ask. Alternate dense layouts with statement-scale beats.
- Titles ≤ 8 words, benefit-first. Bodies ≤ 2 sentences. If a slide needs a
  paragraph, it's two slides.
- Every deck: one `bigNumber`, one `contrast` or `comparison`, and section
  dividers every 4–6 slides. Never two dense grids back-to-back.
- The editorial set — `manifesto`, `poster`, `story`, `speaker`, `persona`,
  `figures`, `pillars`, large `qa` — is what makes a deck feel designed
  rather than generated: use two or three of them for texture, and let their
  empty space breathe (it's part of the layout, not waste).
- Write `notes` for the presenter on every content slide — one or two lines of
  what to SAY, not a repeat of the slide.
- After importing, tell the user: edit any text by clicking it, right-click
  thumbnails to duplicate/delete, `/present` to present, Export PDF and OG
  image live in the top bar.

## Theming (tokens.css `:root` only)

Prefer the deck-level `accent` (Deck JSON above — one solid hex, user-changeable
in the top bar) over editing tokens. For deeper theming: all color/type/radius/
motion live in `src/styles/tokens.css`. Change VALUES, never names.
`--accent` = `--primary` = one solid hex. Dark default; for a
light deck set `--bg`/`--fg` accordingly and `html { color-scheme: light }` in
base.css. Fonts: prefer the deck-level `font` pairing (see Deck JSON — Google Fonts,
loaded automatically; `playfair`/`fraunces` for editorial serifs, `space`/
`sora`/`outfit` for technical, `manrope`/`dm` for friendly). Only swap the
base.css `@import` for a brand font the pairings don't cover.
