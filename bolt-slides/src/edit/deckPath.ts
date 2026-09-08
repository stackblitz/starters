export const DECK_PATH_ATTR = 'data-deck-path';
export const DECK_SLIDE_ATTR = 'data-deck-slide';

export function deckPathProps(
  slideId: string | null | undefined,
  path: string
) {
  if (!slideId) return {};

  return {
    [DECK_PATH_ATTR]: path,
    [DECK_SLIDE_ATTR]: slideId,
  };
}

export function readDeckField(el: Element | null): {
  slideId: string;
  path: string;
} | null {
  if (!el) return null;

  const path = el.getAttribute(DECK_PATH_ATTR);
  const slideId = el.getAttribute(DECK_SLIDE_ATTR);

  if (!path || !slideId) return null;

  return { slideId, path };
}

export function closestDeckField(node: Node | null): HTMLElement | null {
  const start = node instanceof Element ? node : node?.parentElement;

  return start?.closest(`[${DECK_PATH_ATTR}][${DECK_SLIDE_ATTR}]`) ?? null;
}
