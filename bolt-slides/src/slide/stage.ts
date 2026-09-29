/* Reference stage. Up to 1600×900 a slide reflows responsively; on bigger
   stages the whole slide is scaled up, so a 2900px screen shows the
   reference composition larger instead of stretched thin. The scale is the
   smaller of the two ratios, so the inner stage is never narrower than
   1600 or shorter than 900 — widening a window can only give the slide
   more room, never take height away. */
export const STAGE_REF_WIDTH = 1600;
export const STAGE_REF_HEIGHT = 900;

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
