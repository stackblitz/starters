---
name: slides
description: >-
  Build a premium PRESENTED slide deck — classic one-slide-at-a-time slides you
  advance with a clicker — as a Vite + React app. It keeps the Slidev navigation UI
  (floating glass dock + thumbnail rail + click-builds + presenter) but slides are
  RESPONSIVE React (reflow to any screen, no fixed canvas) and fully interactive.
  Use this for a deck you'll PRESENT (talk over, projector, screen-share) when you
  want web interactivity and responsiveness without Slidev's constraints. The repo
  IS the running app (Vite + React) — you install it in place, theme the tokens, and
  AUTHOR an original deck from the user's real topic/brand.
---

# Slides — a premium, responsive, React presentation engine for Bolt

Classic **paged** slides (advance one at a time, present over them) — but rebuilt in
**Vite + React** so each slide is a **responsive web layout** instead of a fixed
1080×607 canvas that clips. It keeps the Slidev UI you liked (the floating dock +
thumbnail rail + click-builds + presenter) and adds real web interactivity.

Two halves — keep them separate:

- **The engine + UI are pre-built** — this repo is a complete, runnable app: the paged
  engine (`src/deck/`), the dock/rail chrome, the section components (`src/components/`),
  the shared CSS. **Leave the engine as-is. Never regenerate it.** This is the part you
  liked; it must look/behave identically.
- **The content is authored fresh, every time** — the slides (topic, structure, copy,
  visuals, theme) are designed from scratch for *this* request.

> **Theme surface.** All color, type, radius, depth, and motion live in the `:root`
> token vocabulary of `src/styles/tokens.css`. Theme a brand once, there.

## ⛔ Two hard rules

1. **Don't touch the engine** — leave `src/deck/` (the engine + chrome: `Deck`, `Slide`,
   `Build`, `Reveal`, `DeckContext`, `icons`, `Annotator`, `useInView`) untouched. Don't
   rewrite or paraphrase the engine or the chrome; author *around* it.
2. **Author the deck from the user's REAL input — do not reskin the starter.**
   `src/App.tsx` is a throwaway that only proves it runs. **Delete its slides and
   write a new deck.** Never reuse its order, copy, placeholders, or fake names.

---

## Step 0 — Ground the deck in the user's real input

Use the user's real topic, brand, document, facts. Never fabricate a placeholder
company, logo, or quote for a real subject. If a URL/brand is given, the theme comes
from that brand — fetch the page for real colors/font/logo, or use the brand's known
palette, or **STOP and ask**. Report which colors/fonts you used and where from.

---

## Step 1 — Run it in place (the repo is the app)

The repo root is already a complete Vite + React app — no scaffolding or copying. Its
layout:

```
package.json  vite.config.ts  tsconfig*.json  index.html   src/main.tsx
src/App.tsx                 ← THROWAWAY. delete its slides; author the real deck.
src/styles/   tokens.css (edit :root ONLY) · base.css   ← don't edit base.css
src/deck/   Deck Slide Build Reveal DeckContext useInView icons Annotator   ← engine + UI. LOCKED.
src/components/  CountUp TiltCard Marquee Bento Split StatGrid VisualDashboard Accordion
                Comparison Tabs Timeline CodeWindow BrowserFrame SpotlightCard Charts
```

`npm install && npm run dev` runs the deck at `/`. Verify the dock / thumbnail rail /
click-builds work, then delete the starter slides and author the real deck in
`App.tsx`.

---

## Step 2 — Theme it (edit only the `:root` block)

All color, type, radius, depth, motion live in `src/styles/tokens.css` `:root`.
**Change values, never variable names.** Nine ready-made theme families to pull from
(dark product, editorial luxury, Swiss, dark technical, warm minimal,
fintech, aurora glass, cinematic, paper editorial). One accent, used sparingly.
Dark vs light: set `html { color-scheme }` in base.css and pick `--bg`/`--fg`
accordingly. Set fonts in `--font-head`/`--font-body` and the `@import` at the top
of `base.css`. Derive from the brand when given.

---

## Step 3 — Author slides (each child of `<Deck>` is one slide)

Compose slides in `App.tsx`. The building blocks:

- **`<Slide>`** — one slide. `center` for cover/statement/quote/CTA; `full` for
  edge-to-edge; `nav="Label"`; `notes="…"` (editable in the presenter overlay).
- **`<Split>`** — text + edge-to-edge media (`flip` swaps). media = `<img>`, a color
  panel, a `<BrowserFrame>`, or `<TiltCard><VisualX/></TiltCard>`.
- **`<Bento>`** — asymmetric tile grid; tiles take `c`/`r` spans + `variant`.
- **`<StatGrid>`** — responsive proof cards; pass a `<CountUp>` as a stat `value`.
- **`<Comparison>`** — us-vs-them feature matrix; one column highlighted in the accent.
- **`<Tabs>`** — tabbed content with a sliding accent pill.
- **`<Accordion>`** — expand/collapse panels (FAQ, feature detail).
- **`<Timeline>`** — vertical roadmap that draws its connector + milestones in.
- **`<CodeWindow>`** — macOS code window with line numbers + line highlight.
- **`<BrowserFrame>`** — browser chrome around a screenshot / full-bleed app mock
  (fill it edge-to-edge — a real-looking app screen, not a floating card).
- **`<SpotlightCard>`** — card with a cursor-follow accent glow (Linear/Vercel hover).
- **Charts** — `<BarChart>` / `<LineChart>` / `<DonutChart>`, all draw-in on view.
- **Atoms** (CSS classes): `.display .headline .lead .subhead .kicker .figure
  .accent-text .rule`. All fluid (`clamp()`).

**Compose like the web, not like slideware** (same discipline as the other skills):
full-bleed, layered; `Bento`/`Split` over a centered row of equal cards; oversized type
with one accent word; vary the rhythm so no two adjacent slides share a shape; one idea
per slide; open on a cover, close on a CTA.

> **Centering rule:** left-aligned/asymmetric layouts need a **side visual** (a `Split`,
> an image, a `BrowserFrame`). A **text-only** section anchored left reads as off-center
> — center those: a centered heading over a centered content block (e.g.
> `marginInline:'auto'`). `Comparison`, `Tabs`, `Timeline`, `Accordion`, `StatGrid` look
> best centered unless paired with a side visual.

### Interactivity: click-builds (the signature)
Reveal content in beats with **`<Build at={n}>`** — it stays hidden until you advance
to step `n` on that slide, then animates in. Advancing (→ / space / Next) reveals the
next build, then moves to the next slide. Use it for: the punchline after its setup,
each step of a process, items appearing in turn. Use **`<Reveal>`** for an on-enter
entrance (no click needed) on headlines/grids.

**Auto-play mode.** The same `<Build>`s can instead reveal **automatically, staggered,
on slide load** — no clicking. Toggle it live with the dock's auto button or the `A`
key, or start the deck in auto mode with **`<Deck autoplay>`** (tune the gap with
`<Deck stagger={0.16}>`, seconds). Ideal for a self-running deck or mobile viewing;
click-mode stays the default.

```tsx
<Slide center nav="The shift" notes="Pause, then reveal each point.">
  <h2 className="headline" style={{ marginInline: 'auto' }}>Three things changed.</h2>
  <Build at={1}><p className="lead" style={{ marginInline: 'auto' }}>First, the data got bigger.</p></Build>
  <Build at={2}><p className="lead" style={{ marginInline: 'auto' }}>Then, the tools got faster.</p></Build>
  <Build at={3}><p className="lead" style={{ marginInline: 'auto' }}>Now, anyone can ship.</p></Build>
</Slide>
```

---

## Step 4 — Responsive, not fixed (no clipping)

Each slide is a **full-viewport responsive layout**, not a fixed canvas — it reflows
to the screen, so nothing scales-and-clips:

- **Fluid sizing.** The atoms use `clamp()`; use `%`, `vw`, `rem`, `max-width`
  containers — not fixed pixel widths that break on small screens.
- **One idea per slide**, sized to fill ~one screen with deliberate negative space.
- **Check a narrow viewport** — `Bento`/`Split` stack (built in); make sure headlines
  don't overflow and nothing needs scrolling. (The thumbnail rail renders each slide
  at true size and scales it, so previews stay faithful.)
- **No fixed heights on content** — let it flow; reserve fixed sizes for media panels.

---

## Step 5 — Visuals & imagery

Visuals must fit the topic (same rules as the other skills): data/SaaS → a `.vframe`
mock (`VisualDashboard` is an *example* — build topic-fit ones with real data);
brand/product/editorial/real-world → **generate images** into `public/`, one
consistent style, used as `Split` media or full-bleed slide backgrounds under a
gradient scrim (no text in images). A `Split` or full-bleed image beats a floating card.

---

## Step 6 — Motion (with restraint)

`Build` (click reveals), `Reveal` (on-enter entrance), `CountUp` (hero figures),
`VisualDashboard` / `Timeline` / the charts (draw themselves in on view via the
`useInView` hook), `TiltCard` + `SpotlightCard` (cursor interaction), `Marquee` (logo
strip), `Tabs` (sliding pill). The ambient background (drifting spotlights + grain +
vignette) and the slide-change transition are automatic. **One or two motion ideas per
slide**, never a circus. All honors `prefers-reduced-motion`.

---

## Extend the system — invent new slides, components & visuals

The kit is a **floor, not a ceiling.** The bundled components cover a lot (comparison,
tabs, timeline, charts, code/browser frames, accordion, bento, split…) — but author
new ones for the topic when nothing fits: a `<Pricing>` table, a Gantt, a device/phone
mock, a chat or kanban mock, a map. Only the token *names* and `src/deck/` (engine +
chrome) are off-limits to rewrite; **adding** components/visuals is encouraged. Every
new piece must: use `var(--…)` tokens only (no raw hex), compose like a web section, be
responsive (work on mobile), animate with `Reveal`/`Build`/`useInView` + honor
reduced-motion, use tabular figures, and add **no new dependencies** (plain React +
CSS + SVG).

---

## Step 7 — Structure & writing

Pick an arc that fits the deck type (pitch, launch, brand, teaching, report) —
structure follows content. Open on a cover, close on a CTA. ~8–16 slides sized to the
material. Headlines short, declarative, specific (sentence case); body 1–3 tight
sentences; 1–3 word kickers; one idea per slide. Use the user's real numbers; never
invent numbers for a real brand. Zero lorem, zero placeholder names. Add `notes` for
talking points where useful.

---

## Definition of done (self-check)

- [ ] The engine + chrome in `src/deck/` are **left untouched**; the
      dock + thumbnail rail appear, arrow keys advance AND step back through builds,
      auto-play / fullscreen / overview work, annotation (D) has full tools and
      persists per slide, presenter (P) opens a synced new tab, `H` hides the UI, and
      the URL hash tracks the slide.
- [ ] The deck is **authored, not reskinned** — topic, structure, copy, names are the
      user's, with no starter leftovers (no "Title"/"Northwind").
- [ ] If a brand/URL was given, `--primary`, fonts, and logo come from that brand.
- [ ] Only the `:root` block was edited for the theme; editing `--primary` recolors
      everything incl. the dock.
- [ ] Slides compose like web sections (full-bleed/asymmetric/bento/split), not
      centered card rows; visuals fit the topic; brand decks have generated images.
- [ ] **Responsive:** looks right narrow + wide — sections stack, nothing clips or
      needs scrolling. Builds reveal in the intended order.
- [ ] Motion is restrained; reduced-motion respected.
- [ ] `npm install && npm run dev` runs with no console errors; `npm run build` passes.
