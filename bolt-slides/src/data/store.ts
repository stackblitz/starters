/* App state — one zustand store shared by the editor and present mode.
   Mutations are optimistic: state updates instantly, the API call persists to
   the deck file in the background (text edits are debounced per slide). */
import { create } from 'zustand'
import type { AppState, Background, CommentData, DeckMeta, Profile, SlideData } from './types'
import { shareHeaders, shareInfo, shareToken, type ShareMode } from './share'

/* Why a request was refused, when it was: the app shows a password gate for
   'password-required' and a "ask for a link" screen for 'share-required'. */
export type Denial = 'share-required' | 'password-required' | null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch('/api' + path, {
    method,
    headers: { ...shareHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      const why = await res.json().catch(() => ({}))
      if (why.error === 'share-required' || why.error === 'password-required') {
        useStore.setState({ denied: why.error, canEdit: false })
      }
    }
    throw new Error(`${method} ${path} → ${res.status}`)
  }
  return res.json()
}

/* set a deep value in a plain-JSON object via "items.0.title" paths */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setPath(obj: any, path: string, value: unknown): any {
  const clone = structuredClone(obj)
  const keys = path.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = clone
  for (let i = 0; i < keys.length - 1; i++) {
    const k: string | number = Array.isArray(cur) ? Number(keys[i]) : keys[i]
    if (cur[k] == null) cur[k] = /^\d+$/.test(keys[i + 1]) ? [] : {}
    cur = cur[k]
  }
  const last = keys[keys.length - 1]
  cur[Array.isArray(cur) ? Number(last) : last] = value
  return clone
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getPath = (obj: any, path: string): any =>
  path.split('.').reduce((o, k) => (o == null ? undefined : o[Array.isArray(o) ? Number(k) as never : k]), obj)

/* Cross-window mirror: the editor tab and the presenter window run separate
   copies of this store over the same deck, so a slide patch made in one
   is echoed to the other (notes typed in the presenter console show up in the
   editor's Notes tab live, and vice versa). The receiver only updates state —
   the window that made the edit already persisted it. */
const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('deck-store') : null
bus?.addEventListener('message', (e) => {
  const m = e.data as { type?: string; id?: string; patch?: Partial<SlideData> } | null
  if (m?.type !== 'patch' || !m.id || !m.patch) return
  useStore.setState((s) => ({ slides: s.slides.map((sl) => (sl.id === m.id ? { ...sl, ...m.patch } : sl)) }))
})

const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {}
function debounceSave(id: string, fn: () => void, ms = 500) {
  clearTimeout(saveTimers[id])
  saveTimers[id] = setTimeout(fn, ms)
}

interface Store extends AppState {
  loaded: boolean
  /** set when the API refuses us — drives the gate screens */
  denied: Denial
  /** false for share links that may not write (present / presenter) */
  canEdit: boolean
  /** what kind of visitor this browser is */
  mode: ShareMode
  current: number
  me: string | null
  /** "slideId|listPath" while a repeatable list is being edited (keeps its + visible) */
  activeList: string | null
  setActiveList(v: string | null): void

  load(): Promise<void>
  setCurrent(i: number): void

  updateDeck(patch: Partial<DeckMeta>): void
  patchSlide(id: string, patch: Partial<SlideData>): void
  setProp(id: string, path: string, value: unknown): void
  setBackground(id: string, bg: Background): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addSlide(layout: string, props: any, position?: number, background?: Background): Promise<void>
  duplicateSlide(id: string): Promise<void>
  deleteSlide(id: string): Promise<void>
  reorder(ids: string[]): void

  setMe(id: string): void
  createProfile(name: string, color: string): Promise<Profile>
  addComment(slideId: string, body: string): Promise<void>
  setCommentResolved(id: string, resolved: boolean): void
  deleteComment(id: string): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  importDeck(json: any): Promise<void>
  /* freeform canvas: selected item index on the current slide (ephemeral,
     mirrors the canvas selection so the right panel can show its settings)
     + a one-shot request to open the chart data drawer */
  cnvSel: number | null
  setCnvSel(i: number | null): void
  cnvDataReq: boolean
  reqCnvData(v: boolean): void
}

export const useStore = create<Store>((set, getState) => ({
  loaded: false,
  cnvSel: null,
  setCnvSel: (i) => set({ cnvSel: i }),
  cnvDataReq: false,
  reqCnvData: (v) => set({ cnvDataReq: v }),
  deck: { title: '', transition: 'fade' },
  slides: [],
  profiles: [],
  comments: [],
  current: 0,
  me: localStorage.getItem('slides:me'),
  activeList: null,
  setActiveList(v) { set({ activeList: v }) },

  denied: null,
  canEdit: true,
  mode: 'edit',

  async load() {
    // a visitor arriving on a link is only allowed what that link grants
    const link = shareToken ? await shareInfo().catch(() => null) : null
    const mode: ShareMode = link?.mode ?? 'edit'
    const s = await api<AppState>('/state')
    const me = localStorage.getItem('slides:me')
    set({
      ...s,
      loaded: true,
      denied: null,
      mode,
      canEdit: mode === 'edit',
      me: s.profiles.some((p) => p.id === me) ? me : null,
    })
  },

  setCurrent(i) {
    const n = Math.max(0, Math.min(getState().slides.length - 1, i))
    set({ current: n })
  },

  updateDeck(patch) {
    set((s) => ({ deck: { ...s.deck, ...patch } }))
    debounceSave('deck', () => api('/deck', 'PUT', patch))
  },

  patchSlide(id, patch) {
    set((s) => ({ slides: s.slides.map((sl) => (sl.id === id ? { ...sl, ...patch } : sl)) }))
    api('/slides/' + id, 'PUT', patch)
    bus?.postMessage({ type: 'patch', id, patch })
  },

  setProp(id, path, value) {
    const slide = getState().slides.find((s) => s.id === id)
    if (!slide) return
    const props = setPath(slide.props, path, value)
    set((s) => ({ slides: s.slides.map((sl) => (sl.id === id ? { ...sl, props } : sl)) }))
    debounceSave(id, () => api('/slides/' + id, 'PUT', { props: getState().slides.find((s) => s.id === id)?.props }))
  },

  setBackground(id, background) {
    getState().patchSlide(id, { background })
  },

  async addSlide(layout, props, position, background) {
    const pos = position ?? getState().current + 1
    const s = await api<AppState>('/slides', 'POST', { layout, props, position: pos, background })
    set({ ...s, current: pos })
  },

  async duplicateSlide(id) {
    const s = await api<AppState>(`/slides/${id}/duplicate`, 'POST')
    const idx = getState().slides.findIndex((sl) => sl.id === id)
    set({ ...s, current: idx + 1 })
  },

  async deleteSlide(id) {
    const cur = getState().current
    const s = await api<AppState>('/slides/' + id, 'DELETE')
    set({ ...s, current: Math.min(cur, s.slides.length - 1) })
  },

  reorder(ids) {
    const cur = getState().slides[getState().current]?.id
    set((s) => ({
      slides: ids
        .map((id, i) => ({ ...s.slides.find((sl) => sl.id === id)!, position: i }))
        .filter(Boolean),
      current: Math.max(0, ids.indexOf(cur ?? '')),
    }))
    api('/order', 'PUT', { ids })
  },

  setMe(id) {
    localStorage.setItem('slides:me', id)
    set({ me: id })
  },

  async createProfile(name, color) {
    const p = await api<Profile>('/profiles', 'POST', { name, color })
    set((s) => ({ profiles: [...s.profiles, p] }))
    return p
  },

  async addComment(slideId, body) {
    const c = await api<CommentData>('/comments', 'POST', { slideId, profileId: getState().me, body })
    set((s) => ({ comments: [...s.comments, c] }))
  },

  setCommentResolved(id, resolved) {
    set((s) => ({ comments: s.comments.map((c) => (c.id === id ? { ...c, resolved: resolved ? 1 : 0 } : c)) }))
    api('/comments/' + id, 'PUT', { resolved })
  },

  deleteComment(id) {
    set((s) => ({ comments: s.comments.filter((c) => c.id !== id) }))
    api('/comments/' + id, 'DELETE')
  },

  async importDeck(json) {
    const s = await api<AppState>('/import', 'POST', json)
    set({ ...s, current: 0 })
  },
}))
