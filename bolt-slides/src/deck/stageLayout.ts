export const STAGE_LAYOUT_ID = 'slides-live-stage';
export const STAGE_LAYOUT_TRANSITION = {
  type: 'spring' as const,
  bounce: 0,
  visualDuration: 0.4,
};

export const RAIL_WIDTH = 248;
export const CANVAS_PAD_X = 24;
export const CANVAS_PAD_TOP = 24;
export const CANVAS_PAD_BOTTOM = 72;

export type StageFit = { vw: number; vh: number; scale: number };

let storedFit: StageFit | null = null;

export function rememberFit(fit: StageFit) {
  storedFit = fit;
}

export function railCanvasPadding(open: boolean) {
  if (!open) return CANVAS_PAD_X;

  return Math.min(RAIL_WIDTH, window.innerWidth * 0.84) + CANVAS_PAD_X;
}

export function fitScaleForBox(
  clientWidth: number,
  clientHeight: number,
  padLeft: number
): StageFit {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const contentW = Math.max(1, clientWidth - padLeft - CANVAS_PAD_X);
  const contentH = Math.max(
    1,
    clientHeight - CANVAS_PAD_TOP - CANVAS_PAD_BOTTOM
  );
  const scale = Math.min(contentW / vw, contentH / vh);

  return { vw, vh, scale: Math.max(0.05, scale) };
}

export function readStoredFit(railOpen: boolean): StageFit {
  if (storedFit) return storedFit;

  if (typeof window === 'undefined') {
    return { vw: 1280, vh: 720, scale: 0.5 };
  }

  return fitScaleForBox(
    window.innerWidth,
    window.innerHeight,
    railCanvasPadding(railOpen)
  );
}
