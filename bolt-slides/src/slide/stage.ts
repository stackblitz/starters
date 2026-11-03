import { createContext, useContext } from 'react';

/* Reference stage. Up to 1600×900 a slide reflows responsively; on bigger
   stages the whole slide is scaled up, so a 2900px screen shows the
   reference composition larger instead of stretched thin. The scale is the
   smaller of the two ratios, so the inner stage is never narrower than
   1600 or shorter than 900 — widening a window can only give the slide
   more room, never take height away. */
export const STAGE_REF_WIDTH = 1600;
export const STAGE_REF_HEIGHT = 900;

/* Stage tiers. Below NARROW a slide is a phone: one column, never a
   shrunken desktop. Below COMPACT it is a tablet or a half-screen window:
   two columns only when each gets real room. Portrait stages (taller than
   wide — an iPad held upright, a phone) stack side-by-side layouts. */
export const NARROW_STAGE_WIDTH = 700;
export const COMPACT_STAGE_WIDTH = 1100;

/** The stage a slide component is laid out in, in its own CSS pixels. */
export interface StageSize {
  width: number;
  height: number;
  /** >1 only on stages larger than 1600×900 (the slide is magnified). */
  upscale: number;
  /** width < 700 — a phone; one column. */
  narrow: boolean;
  /** width < 1100 — a tablet or small window; be frugal with columns. */
  compact: boolean;
  /** height > width — stack anything side by side. */
  portrait: boolean;
}

export function describeStage(
  width: number,
  height: number,
  upscale: number
): StageSize {
  return {
    width,
    height,
    upscale,
    narrow: width < NARROW_STAGE_WIDTH,
    compact: width < COMPACT_STAGE_WIDTH,
    portrait: height > width,
  };
}

export const DEFAULT_STAGE: StageSize = describeStage(
  STAGE_REF_WIDTH,
  STAGE_REF_HEIGHT,
  1
);

export const StageCtx = createContext<StageSize>(DEFAULT_STAGE);

/** Read the stage size from inside a slide component (see SKILL.md). */
export const useStage = () => useContext(StageCtx);

export function stageUpscale(width: number, height: number): number {
  return Math.max(
    1,
    Math.min(width / STAGE_REF_WIDTH, height / STAGE_REF_HEIGHT)
  );
}

/* Shell fallback text (error / missing component) — deliberately plain. */
export const FALLBACK = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 'clamp(14px, 1.6vw, 18px)',
  lineHeight: 1.5,
} as const;
