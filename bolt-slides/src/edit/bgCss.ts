import type { Background } from '../data/types';

/** CSS background value for a color/gradient/theme Background (no image) */
export function bgCss(bg: Background | undefined): string | undefined {
  if (!bg) return undefined;

  if (bg.type === 'none') return 'var(--bg)';

  if (bg.type === 'color') return bg.color;

  if (bg.type === 'gradient')
    return `linear-gradient(${bg.angle ?? 135}deg, ${bg.from}, ${bg.to})`;

  return undefined;
}
