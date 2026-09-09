export const DECK_PATH_ATTR = 'data-deck-path';
export const DECK_SLIDE_ATTR = 'data-deck-slide';
export const DECK_PIPE_ATTR = 'data-deck-pipe';
export const DECK_KIND_ATTR = 'data-deck-kind';

export type DeckFieldKind = 'code';

export interface DeckPathOptions {
  pipeIndex?: number;
  kind?: DeckFieldKind;
}

export interface DeckField {
  slideId: string;
  path: string;
  pipeIndex?: number;
  kind?: DeckFieldKind;
}

export function splitPipe(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim());
  }

  return String(value ?? '')
    .split('|')
    .map((part) => part.trim());
}

export function splicePipe(
  value: unknown,
  index: number,
  next: string
): string {
  const parts = splitPipe(value);

  while (parts.length <= index) parts.push('');

  parts[index] = next;

  return parts.join(' | ');
}

export function pipeSegment(value: unknown, index: number): string {
  return splitPipe(value)[index] ?? '';
}

export function deckPathProps(
  slideId: string | null | undefined,
  path: string,
  options: DeckPathOptions = {}
) {
  if (!slideId) return {};

  return {
    [DECK_PATH_ATTR]: path,
    [DECK_SLIDE_ATTR]: slideId,
    ...(options.pipeIndex != null
      ? { [DECK_PIPE_ATTR]: String(options.pipeIndex) }
      : {}),
    ...(options.kind ? { [DECK_KIND_ATTR]: options.kind } : {}),
  };
}

export function readDeckField(el: Element | null): DeckField | null {
  if (!el) return null;

  const path = el.getAttribute(DECK_PATH_ATTR);
  const slideId = el.getAttribute(DECK_SLIDE_ATTR);

  if (!path || !slideId) return null;

  const pipeRaw = el.getAttribute(DECK_PIPE_ATTR);
  const pipeIndex =
    pipeRaw == null || pipeRaw === '' ? undefined : Number(pipeRaw);
  const kind = el.getAttribute(DECK_KIND_ATTR);

  return {
    slideId,
    path,
    ...(pipeIndex != null && Number.isFinite(pipeIndex) ? { pipeIndex } : {}),
    ...(kind === 'code' ? { kind: 'code' as const } : {}),
  };
}

export function closestDeckField(node: Node | null): HTMLElement | null {
  const start = node instanceof Element ? node : node?.parentElement;

  return start?.closest(`[${DECK_PATH_ATTR}][${DECK_SLIDE_ATTR}]`) ?? null;
}
