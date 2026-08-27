/* App state — one zustand store shared by the studio, audience deck, and
   presenter console. Canonical store is repo-root deck.json. Studio
   mutations (reorder / duplicate / delete) are optimistic, then POST
   /__deck in Vite DEV. Agent writes land via a custom HMR event. */
import { create } from 'zustand';
import type {
  AppState,
  Background,
  DeckFile,
  DeckMeta,
  SlideData,
} from './types';
import seedJson from '../../deck.json';

const seed = seedJson as DeckFile;

/* set a deep value in a plain-JSON object via "items.0.title" paths */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setPath(obj: any, path: string, value: unknown): any {
  const clone = structuredClone(obj);
  const keys = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k: string | number = Array.isArray(cur) ? Number(keys[i]) : keys[i];
    if (cur[k] == null) cur[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    cur = cur[k];
  }
  const last = keys[keys.length - 1];
  cur[Array.isArray(cur) ? Number(last) : last] = value;
  return clone;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getPath = (obj: any, path: string): any =>
  path
    .split('.')
    .reduce(
      (o, k) =>
        o == null ? undefined : o[Array.isArray(o) ? (Number(k) as never) : k],
      obj
    );

const bus =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('bolt-slides-deck')
    : null;

function newSlideId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

function parseDeckFile(raw: unknown): DeckFile {
  if (!raw || typeof raw !== 'object') throw new Error('invalid-deck');
  const f = raw as DeckFile;
  if (!f.deck || typeof f.deck !== 'object' || !Array.isArray(f.slides)) {
    throw new Error('invalid-deck');
  }
  return f;
}

function toFile(s: {
  boltSlidesVersion: number;
  boltSlidesId: string | null;
  deck: DeckMeta;
  slides: SlideData[];
}): DeckFile {
  const file: DeckFile = {
    boltSlidesVersion: s.boltSlidesVersion || 1,
    deck: s.deck,
    slides: s.slides.map((sl, i) => ({ ...sl, position: i })),
  };
  if (s.boltSlidesId) file.boltSlidesId = s.boltSlidesId;
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
  /** "slideId|listPath" while a repeatable list is being edited (keeps its + visible) */
  activeList: string | null;
  setActiveList(v: string | null): void;
  /** studio Present — in-place swap, no URL change */
  presenting: boolean;
  setPresenting(v: boolean): void;

  load(): void;
  /** Replace deck/slides from disk or another window; keep current by id. */
  applyFile(raw: unknown): void;
  setCurrent(i: number): void;

  updateDeck(patch: Partial<DeckMeta>): void;
  patchSlide(id: string, patch: Partial<SlideData>): void;
  setProp(id: string, path: string, value: unknown): void;
  setBackground(id: string, bg: Background): void;
  duplicateSlide(id: string): void;
  deleteSlide(id: string): void;
  reorder(ids: string[]): void;

  /* freeform canvas (unregistered; kept for a future rework): selected
     item index on the current slide + a one-shot request to open the
     chart data drawer. Used only by FreeformEditor. */
  cnvSel: number | null;
  setCnvSel(i: number | null): void;
  cnvDataReq: boolean;
  reqCnvData(v: boolean): void;
}

function applyEnvelope(
  set: (partial: Partial<Store> | ((s: Store) => Partial<Store>)) => void,
  getState: () => Store,
  raw: unknown
) {
  const file = parseDeckFile(raw);
  const slides = [...file.slides].sort((a, b) => a.position - b.position);
  const prevId = getState().slides[getState().current]?.id;
  const byId = prevId ? slides.findIndex((s) => s.id === prevId) : -1;
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
  cnvSel: null,
  setCnvSel: (i) => set({ cnvSel: i }),
  cnvDataReq: false,
  reqCnvData: (v) => set({ cnvDataReq: v }),
  deck: { title: '', transition: 'fade' },
  slides: [],
  current: 0,
  activeList: null,
  setActiveList(v) {
    set({ activeList: v });
  },
  presenting: false,
  setPresenting(v) {
    set({ presenting: v });
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

  setCurrent(i) {
    const n = Math.max(0, Math.min(getState().slides.length - 1, i));
    set({ current: n });
  },

  updateDeck(patch) {
    set((s) => ({ deck: { ...s.deck, ...patch } }));
    void persist();
  },

  patchSlide(id, patch) {
    set((s) => ({
      slides: s.slides.map((sl) => (sl.id === id ? { ...sl, ...patch } : sl)),
    }));
    bus?.postMessage({ type: 'patch', id, patch });
    const keys = Object.keys(patch);
    const notesOnly = keys.length > 0 && keys.every((k) => k === 'notes');
    schedulePersist(notesOnly ? 400 : 0);
  },

  setProp(id, path, value) {
    const slide = getState().slides.find((s) => s.id === id);
    if (!slide) return;
    const props = setPath(slide.props, path, value);
    set((s) => ({
      slides: s.slides.map((sl) => (sl.id === id ? { ...sl, props } : sl)),
    }));
    void persist();
  },

  setBackground(id, background) {
    getState().patchSlide(id, { background });
  },

  duplicateSlide(id) {
    const slides = getState().slides;
    const idx = slides.findIndex((sl) => sl.id === id);
    if (idx < 0) return;
    const copy: SlideData = {
      ...structuredClone(slides[idx]),
      id: newSlideId(),
    };
    const next = [
      ...slides.slice(0, idx + 1),
      copy,
      ...slides.slice(idx + 1),
    ].map((sl, i) => ({ ...sl, position: i }));
    set({ slides: next, current: idx + 1 });
    void persist();
  },

  deleteSlide(id) {
    const cur = getState().current;
    const next = getState()
      .slides.filter((sl) => sl.id !== id)
      .map((sl, i) => ({ ...sl, position: i }));
    set({
      slides: next,
      current: Math.min(cur, Math.max(0, next.length - 1)),
    });
    void persist();
  },

  reorder(ids) {
    const cur = getState().slides[getState().current]?.id;
    set((s) => ({
      slides: ids
        .map((id, i) => {
          const sl = s.slides.find((row) => row.id === id);
          return sl ? { ...sl, position: i } : null;
        })
        .filter((sl): sl is SlideData => !!sl),
      current: Math.max(0, ids.indexOf(cur ?? '')),
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

bus?.addEventListener('message', (e) => {
  const m = e.data as {
    type?: string;
    file?: unknown;
    id?: string;
    patch?: Partial<SlideData>;
  } | null;
  if (m?.type === 'deck-file' && m.file) {
    useStore.getState().applyFile(m.file);
    return;
  }
  if (m?.type !== 'patch' || !m.id || !m.patch) return;
  useStore.setState((s) => ({
    slides: s.slides.map((sl) => (sl.id === m.id ? { ...sl, ...m.patch } : sl)),
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
