---
name: slides
description: >-
  Author a premium slide deck in Bolt Slides. Slides live in repo-root
  deck.json; the studio rail lets the user reorder, duplicate, delete,
  edit speaker notes, Present, and download PDF/JSON. Use this whenever
  the user asks for a deck, a pitch, slides, or a presentation in this
  project.
---

# Slides — prompt decks into a presentable app

This repo is a complete slide **studio**. Author content into it.

- `/` — in the Bolt preview iframe (and local Vite): studio (thumbnail
  rail with reorder / duplicate / delete, speaker notes, Present,
  Download as PDF or JSON). Present replaces the studio in this view.
  The published site at `/` is the audience deck (notes stripped). **P**
  on the dock opens the presenter console in a new tab.
- `/present?presenter=1` — presenter console (notes visible and
  read-only, highlight and note text size). Annotations stay on this
  machine.

**Your job is CONTENT.** A deck is `deck.json`. Write that file (and
`src/styles/tokens.css` when theming). Layout `props` follow the catalog
below.

## Hard rules

1. **Write `deck.json` and `src/styles/tokens.css`.** Those are the
   authoring files. Colors, fonts, sizes, spacing in a deck request mean
   deck `accent` / `font` or `tokens.css` `:root` values. If they want a
   studio or engine change, say so and wait.
2. **Author from the user's REAL input.** Topic, brand, facts, numbers.
   Never invent a placeholder company for a real subject. Brand given →
   derive theme colors/fonts from it (fetch the site or use its known
   palette) and say what you used.
3. **One solid accent.** `--accent` is a hex, never a gradient. Use it
   sparingly.
4. **`layout` is an exact catalog token.** camelCase keys from the
   catalog (`bigNumber`, `statGrid`), not kebab-case (`big-number`) and
   not a `type` field. `canvas` is not a layout.

## Step 0 · bootstrap (mandatory, first)

Read `deck.json`. If `boltSlidesId` is missing or null, set it to a new
uuid (`crypto.randomUUID()` or equivalent) and write the file. Keep
`boltSlidesVersion` at `1`. Then patch content.

## Workflow

1. Theme only if needed: `:root` values in `src/styles/tokens.css`.
2. Read `deck.json` so you keep studio-side reorder / duplicate / delete.
3. Patch when they already have slides; replace `slides` only for a new
   deck. Keep `boltSlidesId` once it exists.

`props` and the other slide fields follow **Deck JSON** below.
`position` is 0-based. Defaults: `background` `{"type":"none"}`,
`animation` `cascade`, `status` `none`, `transition` `null`, `nav`
`null`, `notes` `""`.

4. Ask the user to look at the studio to see the result: rail to
   reorder / duplicate / delete, Present, Download as PDF or JSON.

Read first. Replacing all of `props` drops keys you omit; change one
field by patching that key. Empty `notes` erases what was there. Replace
the `slides` array only when replacing the whole deck.

## Deck JSON

Repo-root `deck.json`:

```jsonc
{
  "boltSlidesVersion": 1,
  "boltSlidesId": "…",           // uuid; mint on first write if missing
  "deck": {
    "title": "Acme — Series A",
    "transition": "fade",        // deck default: fade | slide | rise | zoom | none
    "font": "inter",             // inter | space | sora | manrope | dm | outfit | playfair | fraunces
    "accent": "#1688FC"          // optional — deck-wide accent (solid hex); omit for the tokens.css default
  },
  "slides": [
    {
      "id": "s1",                // stable string; new slides get a new id
      "position": 0,
      "layout": "cover",         // exact catalog token (camelCase:
                                 // bigNumber, not big-number)
      "props": { ... },          // layout-specific (see catalog); every layout
                                 // also accepts "scale": "lg" | "xl" (+15/+30%
                                 // text size — for sparse slides like pricing)
      "animation": "cascade",    // cascade | rise | fade | zoom | none
      "transition": "zoom",      // optional per-slide override (or null to inherit)
      "background": { "type": "gradient", "from": "#141e30", "to": "#243b55", "angle": 160 },
      "nav": null,
      "notes": "Open with the hook.",   // speaker notes (presenter console)
      "status": "draft"          // optional review state: none (default) |
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
  gradient wash), `flip?`. The presenter slide.
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
- After writing, tell the user to look at the studio: right-click thumbnails
  to duplicate/delete, drag to reorder, edit speaker notes, Present /
  Download as on the bottom bar.

## Theming (`tokens.css` `:root`)

Prefer the deck-level `accent` and `font` (Deck JSON above) over editing
tokens. For deeper theming: all color/type/radius/motion live in
`src/styles/tokens.css`. Change VALUES, never names. `--accent` =
`--primary` = one solid hex. `--bg-grad-1`, `--bg-grad-2`, and `--glow`
must stay `color-mix` of `--accent` so atmosphere follows the deck accent.
Dark default; for a light deck set `--bg` /
`--fg` in tokens.css. Fonts: set the deck-level `font` pairing (Google Fonts,
loaded automatically; `playfair`/`fraunces` for editorial serifs, `space`/
`sora`/`outfit` for technical, `manrope`/`dm` for friendly).
