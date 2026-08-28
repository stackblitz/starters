/* Shared layout id so the editor frame morphs into the present stage. */
export const STAGE_LAYOUT_ID = 'slides-live-stage';

export const STAGE_LAYOUT_TRANSITION = {
  type: 'tween' as const,
  duration: 0.4,
  ease: [0.32, 0.72, 0, 1] as const,
};
