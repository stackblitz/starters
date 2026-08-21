/* App state — one zustand store shared by the editor and present mode.

   Mutations are optimistic: state updates instantly and the deck function
   persists in the background (text edits debounced per slide). The deck in
   Postgres is the truth, so anything typed here is on its way there and nowhere
   else. */
import { create } from 'zustand';
import type {
  AppState,
  Background,
  DeckAccess,
  DeckMeta,
  SlideData,
} from './types';
import { DeckError, request, type Failure } from './backend';
import { shareToken, type ShareMode } from './share';

/* Why the deck is not on screen. 'no-database' and 'unreachable' are the app's
   own problem and get an explanation (NoDatabase.tsx); the other two are about
   this visitor and get the gate (Gate.tsx). */
export type Denial = 'share-required' | 'password-required' | null;
export type Problem = 'no-database' | 'unreachable' | null;

async function api<T = unknown>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  try {
    return await request<T>(path, method, body);
  } catch (e) {
    if (e instanceof DeckError) note(e.failure);
    throw e;
  }
}

/* One place where a failed call becomes something the person can read. Called
   from every request, including the background ones nobody asked for, so a deck
   that quietly stops saving says so instead of looking fine. */
function note(failure: Failure) {
  if (failure === 'no-database' || failure === 'unreachable') {
    useStore.setState({ problem: failure });
    return;
  }
  if (failure === 'share-required' || failure === 'password-required') {
    useStore.setState({ denied: failure, canEdit: false });
    return;
  }
  if (failure === 'read-only') useStore.setState({ canEdit: false });
}

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

/* Cross-window mirror: the editor tab and the presenter window run separate
   copies of this store over the same deck, so a slide patch made in one
   is echoed to the other (notes typed in the presenter console show up in the
   editor's Notes tab live, and vice versa). The receiver only updates state —
   the window that made the edit already persisted it. */
const bus =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('deck-store')
    : null;
bus?.addEventListener('message', (e) => {
  const m = e.data as {
    type?: string;
    id?: string;
    patch?: Partial<SlideData>;
  } | null;
  if (m?.type !== 'patch' || !m.id || !m.patch) return;
  useStore.setState((s) => ({
    slides: s.slides.map((sl) => (sl.id === m.id ? { ...sl, ...m.patch } : sl)),
  }));
});

const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
function debounceSave(id: string, fn: () => void, ms = 500) {
  clearTimeout(saveTimers[id]);
  saveTimers[id] = setTimeout(() => {
    delete saveTimers[id];
    fn();
  }, ms);
}
const savePending = () => Object.keys(saveTimers).length > 0;

interface Store extends AppState {
  loaded: boolean;
  /** set when the deck refuses us — drives the gate screens */
  denied: Denial;
  /** set when there is no deck to refuse us — drives the no-database screen */
  problem: Problem;
  /** false for share links that may not write (present / presenter) */
  canEdit: boolean;
  /** what kind of visitor this browser is */
  mode: ShareMode;
  current: number;
  /** the deck's version as of the last load, for noticing other people's edits */
  version: number;
  /** "slideId|listPath" while a repeatable list is being edited (keeps its + visible) */
  activeList: string | null;
  setActiveList(v: string | null): void;

  load(): Promise<void>;
  /** poll for edits made elsewhere — the agent, another window */
  watch(): () => void;
  setCurrent(i: number): void;

  updateDeck(patch: Partial<DeckMeta>): void;
  patchSlide(id: string, patch: Partial<SlideData>): void;
  setProp(id: string, path: string, value: unknown): void;
  setBackground(id: string, bg: Background): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addSlide(
    layout: string,
    props: any,
    position?: number,
    background?: Background
  ): Promise<void>;
  duplicateSlide(id: string): Promise<void>;
  deleteSlide(id: string): Promise<void>;
  reorder(ids: string[]): void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  importDeck(json: any): Promise<void>;
  /* freeform canvas: selected item index on the current slide (ephemeral,
     mirrors the canvas selection so the right panel can show its settings)
     + a one-shot request to open the chart data drawer */
  cnvSel: number | null;
  setCnvSel(i: number | null): void;
  cnvDataReq: boolean;
  reqCnvData(v: boolean): void;
}

interface StateResponse {
  deck: DeckMeta & { version: number };
  slides: SlideData[];
  access: DeckAccess;
}

export const useStore = create<Store>((set, getState) => ({
  loaded: false,
  cnvSel: null,
  setCnvSel: (i) => set({ cnvSel: i }),
  cnvDataReq: false,
  reqCnvData: (v) => set({ cnvDataReq: v }),
  deck: { title: '', transition: 'fade' },
  slides: [],
  current: 0,
  version: 0,
  activeList: null,
  setActiveList(v) {
    set({ activeList: v });
  },

  denied: null,
  problem: null,
  canEdit: true,
  mode: 'edit',

  async load() {
    const { deck, slides, access } = await api<StateResponse>('/state');
    set({
      deck,
      slides,
      version: deck.version ?? 0,
      loaded: true,
      denied: null,
      problem: null,
      /* What this visitor may do is the function's answer, not a guess from
         which headers happen to be in this tab. A revoked link and an expired
         owner key both arrive here as "present". */
      mode: access.mode,
      canEdit: access.canEdit,
    });
  },

  /* Someone else edits the deck: the agent authoring slides, the presenter
     window, a second tab. Postgres knows; this tab does not, until it asks.

     So it asks — cheaply (one integer), only while the tab is on screen, and
     never while there is unsent typing or a focused editor to interrupt.
     Reloading over someone mid-sentence would be a worse bug than being a few
     seconds stale. */
  watch() {
    const fresh = async () => {
      const state = getState();
      if (document.hidden || savePending()) return;
      /* Nothing loaded because nothing was there to load: no database yet, or a
         function not deployed yet. Both are things the agent may be finishing
         as we poll, so keep asking — the explanation screen should turn into
         the deck by itself. A gate is not retried: a wrong password does not
         become right by being asked again. */
      if (!state.loaded) {
        if (state.problem) await state.load().catch(() => {});
        return;
      }
      const editing = document.activeElement as HTMLElement | null;
      if (editing?.isContentEditable || editing?.closest('input, textarea'))
        return;
      try {
        const { version } = await request<{ version: number }>('/version');
        if (version !== getState().version) await getState().load();
      } catch {
        /* the request already reported itself; a poll is not worth a screen */
      }
    };
    const timer = setInterval(fresh, 4000);
    document.addEventListener('visibilitychange', fresh);
    window.addEventListener('focus', fresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', fresh);
      window.removeEventListener('focus', fresh);
    };
  },

  setCurrent(i) {
    const n = Math.max(0, Math.min(getState().slides.length - 1, i));
    set({ current: n });
  },

  updateDeck(patch) {
    set((s) => ({ deck: { ...s.deck, ...patch } }));
    /* Sends the whole deck rather than this patch: deck saves share one debounce
       slot, so a patch sent alone loses whichever change it interrupted — a
       title still being typed when the accent colour is picked. */
    debounceSave('deck', () => {
      const { title, transition, font, accent, visibility, publish_url } =
        getState().deck;
      api('/meta', 'PUT', {
        title,
        transition,
        font,
        accent,
        visibility,
        publish_url,
      }).catch(() => {});
    });
  },

  patchSlide(id, patch) {
    set((s) => ({
      slides: s.slides.map((sl) => (sl.id === id ? { ...sl, ...patch } : sl)),
    }));
    api('/slides/' + id, 'PUT', patch).catch(() => {});
    bus?.postMessage({ type: 'patch', id, patch });
  },

  setProp(id, path, value) {
    const slide = getState().slides.find((s) => s.id === id);
    if (!slide) return;
    const props = setPath(slide.props, path, value);
    set((s) => ({
      slides: s.slides.map((sl) => (sl.id === id ? { ...sl, props } : sl)),
    }));
    debounceSave(id, () =>
      api('/slides/' + id, 'PUT', {
        props: getState().slides.find((s) => s.id === id)?.props,
      }).catch(() => {})
    );
  },

  setBackground(id, background) {
    getState().patchSlide(id, { background });
  },

  async addSlide(layout, props, position, background) {
    const pos = position ?? getState().current + 1;
    const s = await api<StateResponse>('/slides', 'POST', {
      layout,
      props,
      position: pos,
      background,
    });
    set({
      deck: s.deck,
      slides: s.slides,
      version: s.deck.version,
      current: pos,
    });
  },

  async duplicateSlide(id) {
    const s = await api<StateResponse>(`/slides/${id}/duplicate`, 'POST');
    const idx = getState().slides.findIndex((sl) => sl.id === id);
    set({
      deck: s.deck,
      slides: s.slides,
      version: s.deck.version,
      current: idx + 1,
    });
  },

  async deleteSlide(id) {
    const cur = getState().current;
    const s = await api<StateResponse>('/slides/' + id, 'DELETE');
    set({
      deck: s.deck,
      slides: s.slides,
      version: s.deck.version,
      current: Math.min(cur, s.slides.length - 1),
    });
  },

  reorder(ids) {
    const cur = getState().slides[getState().current]?.id;
    set((s) => ({
      slides: ids
        .map((id, i) => ({
          ...s.slides.find((sl) => sl.id === id)!,
          position: i,
        }))
        .filter(Boolean),
      current: Math.max(0, ids.indexOf(cur ?? '')),
    }));
    api('/order', 'PUT', { ids }).catch(() => {});
  },

  async importDeck(json) {
    const s = await api<StateResponse>('/import', 'POST', json);
    set({
      deck: s.deck,
      slides: s.slides,
      version: s.deck.version,
      current: 0,
    });
  },
}));

/* A tab opened on a link is a visitor until told otherwise, which matters
   before the first response arrives: the editor must not flash its chrome at
   someone holding a read-only link. */
if (shareToken) useStore.setState({ canEdit: false, mode: 'present' });
