# Bolt slides skill

A Bolt skill that builds a premium, **responsive React presentation deck** — classic
paged slides you present one at a time, with a Slidev-style floating dock + thumbnail
rail, click-builds, annotation, and presenter mode — but each slide is a
responsive web layout (no fixed canvas, no clipping) built from a rich component
library.

## The skill

This repo **is** the running app. The authoring guide lives at
[`.bolt/skills/slides/SKILL.md`](./.bolt/skills/slides/SKILL.md); the app itself sits
at the repo root — a complete Vite + React deck: the paged engine + chrome
(`src/deck/`), fourteen slide layouts (`src/components/`: Cover, BigNumber,
Contrast, Chat, Globe, Bento, Split, StatGrid, Section, Quote, Pricing, Steps,
Agenda, Team) plus a dozen building blocks (Table, Comparison, Tabs, Accordion, Timeline,
CodeWindow, BrowserFrame, SpotlightCard, charts, CountUp, TiltCard, Marquee, …),
and the token-driven theme (`src/styles/`). The engine is left as-is; only the
`:root` token block and the slides in `src/App.tsx` are authored per deck.

## Add it in Bolt

1. In Bolt's **Add skill from GitHub**, paste this repo's URL —
   `https://github.com/inkko44/bolt-slides-skill`.
2. The `slides` skill auto-discovers at `.bolt/skills/slides.md`.
3. Tell Bolt to use the `slides` skill and build a deck about your topic/brand.

## Run it locally

```bash
npm install
npm run dev
```

`npm run dev` opens the deck at `/`. Re-theme everything by editing one `:root` block
in `src/styles/tokens.css`.
