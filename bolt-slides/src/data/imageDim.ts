/** Default scrim when an image surface omits `dim`. */
export const IMAGE_DIM_DEFAULT = 0.45;

/** Minimum scrim so body text stays readable on a busy photo. */
export const IMAGE_DIM_FLOOR = 0.4;

export function effectiveImageDim(dim?: number): number {
  return Math.max(dim ?? IMAGE_DIM_DEFAULT, IMAGE_DIM_FLOOR);
}

export function slideHasImage(slide: {
  background?: { type?: string };
  props?: { image?: unknown };
}): boolean {
  return slide.background?.type === 'image' || Boolean(slide.props?.image);
}
