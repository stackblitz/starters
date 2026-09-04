import { create } from 'zustand';
import type { AppState, DeckFile, DeckMeta, SlideData } from './types';
import seedJson from '../../deck.json';

const seed = seedJson as DeckFile;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setPath(obj: any, path: string, value: unknown): any {
  const clone = structuredClone(obj);
  const keys = path.split('.');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = clone;

  for (let i = 0; i < keys.length - 1; i++) {
    const key: string | number = Array.isArray(cursor)
      ? Number(keys[i])
      : keys[i];
    if (cursor[key] == null) cursor[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};

    cursor = cursor[key];
  }

  const last = keys[keys.length - 1];

  cursor[Array.isArray(cursor) ? Number(last) : last] = value;

  return clone;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getPath = (obj: any, path: string): any =>
  path
    .split('.')
    .reduce(
      (node, key) =>
        node == null
          ? undefined
          : node[Array.isArray(node) ? (Number(key) as never) : key],
      obj
    );

const bus =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('bolt-slides-deck')
    : null;

function newSlideId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

function coerceSlide(raw: SlideData): SlideData {
  const slide = raw as SlideData & { type?: string };
  const rest = { ...slide };
  delete rest.type;
  return {
    ...rest,
    layout: String(slide.layout || slide.type || '').trim(),
    background: slide.background ?? { type: 'color', color: 'var(--bg)' },
  };
}

function parseDeckFile(raw: unknown): DeckFile {
  if (!raw || typeof raw !== 'object') throw new Error('invalid-deck');

  const file = raw as DeckFile;

  if (
    !file.deck ||
    typeof file.deck !== 'object' ||
    !Array.isArray(file.slides)
  ) {
    throw new Error('invalid-deck');
  }

  return { ...file, slides: file.slides.map(coerceSlide) };
}

function toFile(state: {
  boltSlidesVersion: number;
  boltSlidesId: string | null;
  deck: DeckMeta;
  slides: SlideData[];
}): DeckFile {
  const file: DeckFile = {
    boltSlidesVersion: state.boltSlidesVersion || 1,
    deck: state.deck,
    slides: state.slides.map((slide, i) => ({ ...slide, position: i })),
  };

  if (state.boltSlidesId) file.boltSlidesId = state.boltSlidesId;

  return file;
}

let persistDirty = false;
let persisting = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(ms: number) {
  if (persistTimer) clearTimeout(persistTimer);

  if (ms <= 0) {
    persistTimer = null;
    void persist();
    return;
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persist();
  }, ms);
}

interface Store extends AppState {
  loaded: boolean;
  bootError: string | null;
  boltSlidesVersion: number;
  boltSlidesId: string | null;
  current: number;
  activeList: string | null;
  setActiveList(value: string | null): void;
  load(): void;
  applyFile(raw: unknown): void;
  setCurrent(index: number): void;
  patchSlide(id: string, patch: Partial<SlideData>): void;
  setProp(id: string, path: string, value: unknown): void;
  duplicateSlide(id: string): void;
  deleteSlide(id: string): void;
  reorder(ids: string[]): void;
}

function applyEnvelope(
  set: (partial: Partial<Store> | ((state: Store) => Partial<Store>)) => void,
  getState: () => Store,
  raw: unknown
) {
  const file = parseDeckFile(raw);
  const slides = [...file.slides].sort(
    (left, right) => left.position - right.position
  );
  const prevId = getState().slides[getState().current]?.id;
  const byId = prevId ? slides.findIndex((slide) => slide.id === prevId) : -1;
  const current =
    byId >= 0
      ? byId
      : Math.max(
          0,
          Math.min(getState().current, Math.max(0, slides.length - 1))
        );

  set({
    boltSlidesVersion: file.boltSlidesVersion ?? 1,
    boltSlidesId: file.boltSlidesId ?? null,
    deck: file.deck,
    slides,
    current,
    loaded: true,
    bootError: null,
  });
}

export const useStore = create<Store>((set, getState) => ({
  loaded: false,
  bootError: null,
  boltSlidesVersion: 1,
  boltSlidesId: null,
  deck: { title: '', transition: 'fade' },
  slides: [],
  current: 0,
  activeList: null,
  setActiveList(value) {
    set({ activeList: value });
  },
  load() {
    try {
      applyEnvelope(set, getState, seed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      set({
        bootError:
          message === 'invalid-deck'
            ? 'deck.json is missing a deck or slides array.'
            : 'Could not load deck.json.',
      });
    }
  },
  applyFile(raw) {
    try {
      applyEnvelope(set, getState, raw);
    } catch {
      /* keep the last good state */
    }
  },
  setCurrent(index) {
    const next = Math.max(0, Math.min(getState().slides.length - 1, index));

    set({ current: next });
  },
  patchSlide(id, patch) {
    set((state) => ({
      slides: state.slides.map((slide) =>
        slide.id === id ? { ...slide, ...patch } : slide
      ),
    }));

    bus?.postMessage({ type: 'patch', id, patch });

    const keys = Object.keys(patch);
    const notesOnly = keys.length > 0 && keys.every((key) => key === 'notes');

    schedulePersist(notesOnly ? 400 : 0);
  },
  setProp(id, path, value) {
    const slide = getState().slides.find((row) => row.id === id);

    if (!slide) return;

    const props = setPath(slide.props, path, value);

    set((state) => ({
      slides: state.slides.map((row) =>
        row.id === id ? { ...row, props } : row
      ),
    }));

    void persist();
  },
  duplicateSlide(id) {
    const slides = getState().slides;
    const idx = slides.findIndex((slide) => slide.id === id);

    if (idx < 0) return;

    const copy: SlideData = {
      ...structuredClone(slides[idx]),
      id: newSlideId(),
    };
    const next = [
      ...slides.slice(0, idx + 1),
      copy,
      ...slides.slice(idx + 1),
    ].map((slide, i) => ({ ...slide, position: i }));

    set({ slides: next, current: idx + 1 });

    void persist();
  },
  deleteSlide(id) {
    const current = getState().current;
    const next = getState()
      .slides.filter((slide) => slide.id !== id)
      .map((slide, i) => ({ ...slide, position: i }));

    set({
      slides: next,
      current: Math.min(current, Math.max(0, next.length - 1)),
    });

    void persist();
  },
  reorder(ids) {
    const currentId = getState().slides[getState().current]?.id;

    set((state) => ({
      slides: ids
        .map((id, i) => {
          const slide = state.slides.find((row) => row.id === id);
          return slide ? { ...slide, position: i } : null;
        })
        .filter((slide): slide is SlideData => !!slide),
      current: Math.max(0, ids.indexOf(currentId ?? '')),
    }));

    void persist();
  },
}));

async function persist() {
  if (!import.meta.env.DEV) return;

  persistDirty = true;

  if (persisting) return;

  persisting = true;

  while (persistDirty) {
    persistDirty = false;

    try {
      const file = toFile(useStore.getState());
      const res = await fetch('/__deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      });

      if (!res.ok) throw new Error(`POST /__deck → ${res.status}`);

      const saved = parseDeckFile(await res.json());
      const id = saved.boltSlidesId ?? null;

      if (id && id !== useStore.getState().boltSlidesId) {
        useStore.setState({ boltSlidesId: id });
      }

      bus?.postMessage({
        type: 'deck-file',
        file: toFile(useStore.getState()),
      });
    } catch (err) {
      console.error(err);
    }
  }

  persisting = false;
}

bus?.addEventListener('message', (event) => {
  const message = event.data as {
    type?: string;
    file?: unknown;
    id?: string;
    patch?: Partial<SlideData>;
  } | null;

  if (message?.type === 'deck-file' && message.file) {
    useStore.getState().applyFile(message.file);
    return;
  }

  if (message?.type !== 'patch' || !message.id || !message.patch) return;

  useStore.setState((state) => ({
    slides: state.slides.map((slide) =>
      slide.id === message.id ? { ...slide, ...message.patch } : slide
    ),
  }));
});

if (import.meta.hot) {
  import.meta.hot.on('deck-file-changed', (file: unknown) => {
    useStore.getState().applyFile(file);
  });
}

export function serializeDeck(): DeckFile {
  return toFile(useStore.getState());
}
