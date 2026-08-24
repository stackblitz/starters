/* App state — one zustand store shared by the editor and present mode.
   Mutations are optimistic: state updates instantly, the API call persists to
   the database in the background (text edits are debounced per slide). */
import { create } from 'zustand';
import type { AppState, Background, DeckMeta, SlideData } from './types';
import { deckUrl, supabaseAuthHeaders } from './api';
import { shareHeaders, shareInfo, shareToken, type ShareMode } from './share';
import { ownerHeaders } from './owner';

/* Why a request was refused, when it was: the app shows a password gate for
   'password-required' and a "ask for a link" screen for 'share-required'. */
export type Denial = 'share-required' | 'password-required' | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const res = await fetch(deckUrl(path), {
    method,
    headers: {
      ...supabaseAuthHeaders(),
      ...shareHeaders(),
      ...ownerHeaders(),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      const why = await res.json().catch(() => ({}));
      if (why.error === 'share-required' || why.error === 'password-required') {
        useStore.setState({ denied: why.error, canEdit: false });
      }
    }
    throw new Error(`${method} ${path} → ${res.status}`);
  }
  return res.json();
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
let pendingRefresh = false;
let writeGen = 0;
let inFlight = 0;

function bumpWrite() {
  writeGen++;
}

function writesPending() {
  return Object.keys(saveTimers).length > 0 || inFlight > 0;
}

function flushPendingRefresh() {
  if (!pendingRefresh || writesPending()) return;
  pendingRefresh = false;
  void useStore.getState().refresh();
}

function trackPut<T>(p: Promise<T>): Promise<T> {
  inFlight++;
  return p.finally(() => {
    inFlight--;
    flushPendingRefresh();
  });
}

function debounceSave(id: string, fn: () => void | Promise<unknown>, ms = 500) {
  clearTimeout(saveTimers[id]);
  saveTimers[id] = setTimeout(() => {
    delete saveTimers[id];
    Promise.resolve(fn()).finally(flushPendingRefresh);
  }, ms);
}

interface Store extends AppState {
  loaded: boolean;
  /** set when VITE_SUPABASE_* is missing or the edge function is down */
  bootError: string | null;
  /** set when the API refuses us — drives the gate screens */
  denied: Denial;
  /** advisory: false for present/presenter share links. Mutators do not
   *  consult this — the API is the real gate. Do not trust it in UI. */
  canEdit: boolean;
  /** what kind of visitor this browser is */
  mode: ShareMode;
  current: number;
  /** "slideId|listPath" while a repeatable list is being edited (keeps its + visible) */
  activeList: string | null;
  setActiveList(v: string | null): void;
  /** editor Present — in-place swap, no URL change */
  presenting: boolean;
  setPresenting(v: boolean): void;

  load(): Promise<void>;
  /** Re-read /state without resetting ephemeral editor UI. Skips while a
   *  debounce or PUT is in flight, and drops the snapshot if a write started
   *  after the GET. */
  refresh(): Promise<void>;
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

export const useStore = create<Store>((set, getState) => ({
  loaded: false,
  bootError: null,
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

  denied: null,
  canEdit: true,
  mode: 'edit',

  async load() {
    try {
      // a visitor arriving on a link is only allowed what that link grants.
      // never default a ?k= tab to editor if /share fails — that would show
      // the editor chrome for a present/presenter token.
      let mode: ShareMode = 'edit';
      if (shareToken) {
        const link = await shareInfo().catch(() => null);
        if (!link) {
          set({
            denied: 'share-required',
            canEdit: false,
            loaded: false,
          });
          return;
        }
        mode = link.mode;
      }
      const s = await api<AppState>('/state');
      set({
        ...s,
        loaded: true,
        bootError: null,
        denied: null,
        mode,
        canEdit: mode === 'edit',
      });
    } catch (err) {
      if (getState().denied) return;
      const message = err instanceof Error ? err.message : String(err);
      set({
        bootError: message.includes('missing-supabase')
          ? 'This deck needs a Bolt Cloud database. Apply the slides schema and deploy the deck-api edge function (see .bolt/skills/slides/SKILL.md), then reload.'
          : 'Could not reach the deck API. Apply the slides schema and deploy deck-api (see .bolt/skills/slides/SKILL.md), then reload.',
      });
    }
  },

  async refresh() {
    if (writesPending()) {
      pendingRefresh = true;
      return;
    }
    pendingRefresh = false;
    if (getState().denied) return;
    const gen = writeGen;
    try {
      const s = await api<AppState>('/state');
      if (gen !== writeGen || writesPending()) {
        pendingRefresh = true;
        flushPendingRefresh();
        return;
      }
      const cur = getState().current;
      set({
        ...s,
        current: Math.max(0, Math.min(cur, Math.max(0, s.slides.length - 1))),
        loaded: true,
        bootError: null,
      });
    } catch {
      /* keep the last good state; the next focus/visibility pass retries */
    }
  },

  setCurrent(i) {
    const n = Math.max(0, Math.min(getState().slides.length - 1, i));
    set({ current: n });
  },

  updateDeck(patch) {
    bumpWrite();
    set((s) => ({ deck: { ...s.deck, ...patch } }));
    debounceSave('deck', () => {
      const deck = getState().deck;
      return trackPut(
        api('/deck', 'PUT', {
          title: deck.title,
          transition: deck.transition,
          font: deck.font,
          accent: deck.accent,
        })
      );
    });
  },

  patchSlide(id, patch) {
    bumpWrite();
    set((s) => ({
      slides: s.slides.map((sl) => (sl.id === id ? { ...sl, ...patch } : sl)),
    }));
    bus?.postMessage({ type: 'patch', id, patch });
    const keys = Object.keys(patch);
    const notesOnly = keys.length > 0 && keys.every((k) => k === 'notes');
    const send = () =>
      trackPut(
        api(
          '/slides/' + id,
          'PUT',
          notesOnly
            ? { notes: getState().slides.find((s) => s.id === id)?.notes }
            : patch
        )
      );
    if (notesOnly) debounceSave('notes:' + id, send);
    else void send();
  },

  setProp(id, path, value) {
    bumpWrite();
    const slide = getState().slides.find((s) => s.id === id);
    if (!slide) return;
    const props = setPath(slide.props, path, value);
    set((s) => ({
      slides: s.slides.map((sl) => (sl.id === id ? { ...sl, props } : sl)),
    }));
    debounceSave(id, () =>
      trackPut(
        api('/slides/' + id, 'PUT', {
          props: getState().slides.find((s) => s.id === id)?.props,
        })
      )
    );
  },

  setBackground(id, background) {
    getState().patchSlide(id, { background });
  },

  async addSlide(layout, props, position, background) {
    bumpWrite();
    const pos = position ?? getState().current + 1;
    const s = await trackPut(
      api<AppState>('/slides', 'POST', {
        layout,
        props,
        position: pos,
        background,
      })
    );
    set({ ...s, current: pos });
  },

  async duplicateSlide(id) {
    bumpWrite();
    const s = await trackPut(api<AppState>(`/slides/${id}/duplicate`, 'POST'));
    const idx = getState().slides.findIndex((sl) => sl.id === id);
    set({ ...s, current: idx + 1 });
  },

  async deleteSlide(id) {
    bumpWrite();
    const cur = getState().current;
    const s = await trackPut(api<AppState>('/slides/' + id, 'DELETE'));
    set({ ...s, current: Math.min(cur, s.slides.length - 1) });
  },

  reorder(ids) {
    bumpWrite();
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
    void trackPut(api('/order', 'PUT', { ids }));
  },

  async importDeck(json) {
    bumpWrite();
    const s = await trackPut(api<AppState>('/import', 'POST', json));
    set({ ...s, current: 0 });
  },
}));
