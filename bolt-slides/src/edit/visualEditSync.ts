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

function resolveEl(entry: Dirty): HTMLElement | null {
  const el = liveField(entry.slideId, entry.path) ?? entry.fallback;

  return el.isConnected ? el : null;
}

function editingRoot(node: Node | null): HTMLElement | null {
  const start = node instanceof Element ? node : node?.parentElement;

  if (!start) return null;

  const root = start.closest('[contenteditable="true"]');

  return root instanceof HTMLElement ? root : null;
}

/** Inspector may make a parent (h1) editable, not the stamped span. */
function isActivelyEditing(el: HTMLElement): boolean {
  const active = document.activeElement;

  if (!(active instanceof HTMLElement)) return false;

  const root = editingRoot(active);

  if (!root) return false;

  return root === el || root.contains(el) || el.contains(root);
}

function overlaps(root: Node, el: HTMLElement) {
  return (
    root === el ||
    (root instanceof Node && (root.contains(el) || el.contains(root)))
  );
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
  const el = resolveEl(entry);

  if (!el) return;

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
 *
 * Do not write while the inspector is typing: `setProp` re-renders `T` and
 * the caret jumps. Flush on focusout instead.
 */
export function startVisualEditDeckSync(): () => void {
  const dirty = new Map<string, Dirty>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const flush = (key: string) => {
    const timer = timers.get(key);

    if (timer) clearTimeout(timer);

    timers.delete(key);

    const entry = dirty.get(key);

    if (!entry) return;

    const el = resolveEl(entry);

    if (el && isActivelyEditing(el)) return;

    dirty.delete(key);
    commit(entry);
  };

  const schedule = (key: string) => {
    const entry = dirty.get(key);
    const el = entry ? resolveEl(entry) : null;

    if (el && isActivelyEditing(el)) {
      const prev = timers.get(key);

      if (prev) clearTimeout(prev);

      timers.delete(key);

      return;
    }

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

  const onFocusOut = (event: FocusEvent) => {
    const target = event.target;

    if (!(target instanceof Node)) return;

    for (const key of [...dirty.keys()]) {
      const entry = dirty.get(key);

      if (!entry) continue;

      const el = resolveEl(entry);

      if (el && overlaps(target, el)) flush(key);
    }
  };

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    characterDataOldValue: false,
  });
  document.addEventListener('focusout', onFocusOut, true);

  return () => {
    observer.disconnect();
    document.removeEventListener('focusout', onFocusOut, true);

    for (const timer of timers.values()) clearTimeout(timer);

    timers.clear();
    dirty.clear();
  };
}
