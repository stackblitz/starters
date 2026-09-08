import { getPath, useStore } from '../data/store';
import {
  DECK_PATH_ATTR,
  DECK_SLIDE_ATTR,
  closestDeckField,
  readDeckField,
} from './deckPath';
import { serializeRichRoot } from './richDom';

const DEBOUNCE_MS = 120;

type Dirty = { slideId: string; path: string; fallback: HTMLElement };

function fieldKey(slideId: string, path: string) {
  return `${slideId}\0${path}`;
}

function attrValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function liveField(slideId: string, path: string): HTMLElement | null {
  const nodes = document.querySelectorAll(
    `[${DECK_SLIDE_ATTR}="${attrValue(
      slideId
    )}"][${DECK_PATH_ATTR}="${attrValue(path)}"]`
  );

  for (const node of nodes) {
    if (!(node instanceof HTMLElement) || !node.isConnected) continue;

    /* Prefer the on-stage copy over rail thumbs. */
    if (node.closest('.ed-frame-inner, .deck-live-stage, .slide-stage')) {
      return node;
    }
  }

  return (nodes[0] as HTMLElement | null) ?? null;
}

function remember(
  dirty: Map<string, Dirty>,
  touched: Set<string>,
  slideId: string,
  path: string,
  fallback: HTMLElement
) {
  const key = fieldKey(slideId, path);

  dirty.set(key, { slideId, path, fallback });
  touched.add(key);
}

function collectFromNode(
  dirty: Map<string, Dirty>,
  touched: Set<string>,
  node: Node | null
) {
  const host = closestDeckField(node);
  const field = readDeckField(host);

  if (host && field) {
    remember(dirty, touched, field.slideId, field.path, host);
  }
}

function collectRemovedStamp(
  dirty: Map<string, Dirty>,
  touched: Set<string>,
  removed: Node,
  parent: Node
) {
  if (!(removed instanceof HTMLElement) || !(parent instanceof HTMLElement)) {
    return;
  }

  const field = readDeckField(removed);

  if (!field || !parent.isConnected) return;

  remember(dirty, touched, field.slideId, field.path, parent);
}

function commit(entry: Dirty) {
  const el = liveField(entry.slideId, entry.path) ?? entry.fallback;

  if (!el.isConnected) return;

  const slide = useStore
    .getState()
    .slides.find((row) => row.id === entry.slideId);

  if (!slide) return;

  const next = serializeRichRoot(el);
  const prev = String(getPath(slide.props, entry.path) ?? '');

  if (next === prev) return;

  useStore.getState().setProp(entry.slideId, entry.path, next);
}

/**
 * Visual edits patch the preview DOM. This watches stamped fields and writes
 * `deck.json` through the existing persist path. Style-only patches are
 * ignored until those map onto tokens or slide backgrounds.
 */
export function startVisualEditDeckSync(): () => void {
  const dirty = new Map<string, Dirty>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const flush = (key: string) => {
    timers.delete(key);

    const entry = dirty.get(key);

    if (!entry) return;

    dirty.delete(key);
    commit(entry);
  };

  const schedule = (key: string) => {
    const prev = timers.get(key);

    if (prev) clearTimeout(prev);

    timers.set(
      key,
      setTimeout(() => flush(key), DEBOUNCE_MS)
    );
  };

  const observer = new MutationObserver((records) => {
    const touched = new Set<string>();

    for (const record of records) {
      collectFromNode(dirty, touched, record.target);

      for (const added of record.addedNodes) {
        collectFromNode(dirty, touched, added);
      }

      for (const removed of record.removedNodes) {
        collectRemovedStamp(dirty, touched, removed, record.target);
      }
    }

    for (const key of touched) schedule(key);
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    characterDataOldValue: false,
  });

  return () => {
    observer.disconnect();

    for (const timer of timers.values()) clearTimeout(timer);

    timers.clear();
    dirty.clear();
  };
}
