---
name: slides
description: >-
  Author a premium slide deck in Bolt Slides. Slides live in repo-root
  deck.json; the studio lets the user reorder, duplicate, delete,
  edit speaker notes, Present, and download PDF/JSON. Use this whenever
  the user asks for a deck, a pitch, slides, or a presentation in this
  project.
---

# Slides — prompt decks into a presentable app

This repo is a complete slide **studio**. Author content into it.

- `/` — in the Bolt preview iframe (and local Vite): studio. Side panel
  (S) and grid (G) reorder / duplicate / delete; the dock holds notes,
  Download (PDF or JSON), Present, and Presenter. Present opens a new
  tab (`/?present=1`); the studio stays put. Grid selection is the
  start slide. The published site at `/` is the audience deck (notes
  stripped). **P** opens the presenter console in a new tab.
- `/?presenter=1` — presenter console (on-screen now, up next, notes
  read-only, timer, note text size). `/present` is the same route.

**Your job is CONTENT.** A deck is `deck.json`. Write that file (and
`src/styles/tokens.css` when theming). Layout `props` follow
`src/data/layoutProps.ts`.

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
4. **`layout` is an exact `LayoutName`.** Pick a camelCase key from
   `LAYOUT_NAMES` in `src/data/layoutProps.ts` (`cover`, `bigNumber`,
   `statGrid`, …) and put it on the `layout` field.
5. **Homonym keys follow that layout's `*Props` type.** Chart
   `kind: "line"` `points` is a pipe string of numbers
   (`"12 | 18 | 26"`). Insight takeaways `points` are
   `{label, body}[]`. Insight line series is `points_line`. Contrast
   bullets are `string[]` on `left.points` / `right.points`. Logos
   `items` is one pipe string (`"Acme | Globex"`); every other
   layout's `items` is an object array.

## Step 0 · bootstrap (mandatory, first)

Read `deck.json`. If `boltSlidesId` is missing or null, set it to a new
uuid (`crypto.randomUUID()` or equivalent) and write the file. Keep
`boltSlidesVersion` at `1`. Then patch content.

## Workflow

1. Theme only if needed: `:root` values in `src/styles/tokens.css`.
2. Read `deck.json` so you keep studio-side reorder / duplicate / delete.
3. Patch when they already have slides; replace `slides` only for a new
   deck. Keep `boltSlidesId` once it exists.

`props` follow **Layout props** below; other slide fields follow **Deck JSON**.
`position` is 0-based. Always set `background` on every slide (never omit).
Default: `background` `{"type":"color","color":"var(--bg)"}`,
`animation` `cascade`, `status` `none`, `transition` `null`, `nav`
`null`, `notes` `""`.

4. Ask the user to look at the studio to see the result: side panel
   or grid to reorder / duplicate / delete, notes, Present, Download.

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
      "layout": "cover",         // LayoutName from src/data/layoutProps.ts
      "props": { ... },          // that layout's *Props type in the same file
                                 // every layout also accepts "scale": "lg" | "xl"
      "animation": "cascade",    // cascade | rise | fade | zoom | none
      "transition": "zoom",      // optional per-slide override (or null to inherit)
      "background": { "type": "color", "color": "var(--bg)" },
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

**Backgrounds** — always set on every slide (studio, thumbs, and present share
the same opaque surface; never leave the field off):
`{"type":"color","color":"var(--bg)"}` (default — theme surface; follows
`tokens.css`),
`{"type":"color","color":"#0b1020"}`,
`{"type":"gradient","from":"#…","to":"#…","angle":160}`,
`{"type":"image","url":"https://…","dim":0.45}` (dim 0–0.85 keeps text legible),
`{"type":"none"}` (legacy alias for the theme surface — prefer `color` +
`var(--bg)` in new decks). Most slides use `var(--bg)`; save gradient / image
for moments (a section break, a photo cover). Photos:
`https://images.unsplash.com/...?w=1600&q=80`.

**Animation** is per-slide and user-changeable later — pick deliberately:
`cascade` (default — the layout's designed staggers) for almost everything;
`fade` for quotes/statements you want to land quietly; `rise` or `zoom` as an
occasional emphasis beat; `none` only for dense reference slides.
**Transitions**: set ONE deck default (usually `fade`); override per-slide
sparingly (`zoom` into section dividers works well).

**Numbers animate themselves**: any figure-like string (`"$3T"`, `"48%"`,
`"1,200+"`) counts up on reveal automatically. Just write the string.

## Layout props

Open `src/data/layoutProps.ts`. `layout` is a `LayoutName`. `props` is the
type of the same name (`cover` → `CoverProps`, `insight` → `InsightProps`).
Use that type. Homonym keys (`points`, `items`, `values`) are hard
rule 5 — each layout's type is the shape.

Pick by purpose:

- **Rhythm** — `cover` (opener / closing CTA), `section` (chapter divider),
  `statement` (one thought), `bigNumber` (drama beat), `manifesto`
  (editorial breather; empty lower half is the layout), `quote`.
- **Structure** — `agenda`, `steps`, `pillars` (focus areas, not a process),
  `timeline`, `contrast` (before / after), `comparison`, `table` (real data;
  ≤5 cols, ≤7 rows), `tabs`, `accordion` (interactive FAQ), `qa` (flat FAQ),
  `pricing` (highlight exactly one tier), `team`, `logos`.
- **Visual** — `bento` (feature grid), `statGrid`, `figures` (editorial
  numbers), `poster`, `story`, `speaker`, `persona`, `chart`, `insight`
  (chart + takeaways), `chat`, `code`.

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
- After writing, tell the user to look at the studio: drag to reorder,
  ••• or right-click a thumbnail to duplicate/delete, grid (G) to pick a
  slide then Present, notes and Download on the dock.

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
