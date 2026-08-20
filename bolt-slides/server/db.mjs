/* Local data layer — one JSON file, no dependencies: data/deck.json holds the
   whole deck (slides, comments, profiles, statuses, share links). Copy that
   file and the deck travels with it.

   The shape is deliberately table-like — deck, slides[], profiles[],
   comments[], shares[], grants[] — because this is the development stand-in
   for a hosted database. Porting to Bolt Cloud / Supabase is one array per
   table and the same API routes on top (see docs/cloud-setup.md). */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '..'
);
export const DATA_DIR = path.join(ROOT, 'data');
export const DB_FILE = path.join(DATA_DIR, 'deck.json');
const SEED_FILE = path.join(DATA_DIR, 'deck.seed.json');

const EMPTY = () => ({
  deck: {
    title: 'Untitled deck',
    transition: 'fade',
    font: 'inter',
    accent: null,
    updated_at: null,
  },
  slides: [],
  profiles: [],
  comments: [],
  shares: [],
  grants: [],
});

export const uid = () => crypto.randomUUID().slice(0, 8);
const now = () => new Date().toISOString();

let db = null;
let saveTimer = null;
let loadedMtime = 0;
let dirty = false;

const fileMtime = () =>
  fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).mtimeMs : 0;

/* Open (or create) the file. Another process — the deck CLI, the skill — may
   have rewritten it since we last read, so reload when the file is newer and
   we have nothing unsaved of our own. */
export async function openDb() {
  if (db && !dirty && fileMtime() > loadedMtime + 1) db = null;
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      db = { ...EMPTY(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
    } catch {
      db = EMPTY();
    }
    loadedMtime = fileMtime();
  } else {
    db = EMPTY();
    if (fs.existsSync(SEED_FILE)) {
      importDeck(JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')));
    }
    persistNow();
  }
  return db;
}

export const state = () => db ?? EMPTY();

export function persist() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 250);
}
/* Flush before exit: a debounced write must never be lost, and a stale copy
   must never clobber newer writes from another process. */
export function persistNow() {
  if (!db || !dirty) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  loadedMtime = fileMtime();
  dirty = false;
}
for (const sig of ['SIGINT', 'SIGTERM', 'exit']) process.on(sig, persistNow);

/* ── rows ──────────────────────────────────────────────────────────── */
const byPosition = (a, b) => a.position - b.position;

export const findSlide = (id) =>
  state().slides.find((s) => s.id === id) ?? null;
export const sortedSlides = () => [...state().slides].sort(byPosition);

export function renumber() {
  sortedSlides().forEach((s, i) => {
    s.position = i;
  });
  persist();
}

export function getState() {
  const s = state();
  return {
    deck: {
      title: s.deck.title,
      transition: s.deck.transition,
      font: s.deck.font ?? 'inter',
      accent: s.deck.accent ?? null,
    },
    slides: sortedSlides().map((sl) => ({ ...sl })),
    profiles: s.profiles.map((p) => ({ ...p })),
    comments: s.comments.map((c) => ({ ...c })),
  };
}

export const blankSlide = (over = {}) => ({
  id: uid(),
  position: state().slides.length,
  layout: 'statement',
  props: {},
  background: { type: 'none' },
  animation: 'cascade',
  transition: null,
  nav: null,
  notes: '',
  status: 'none',
  assignee: null,
  created_at: now(),
  updated_at: now(),
  ...over,
});

/* ── portable JSON deck format (what the CLI + skill author) ───────── */
export function exportDeck() {
  const s = state();
  return {
    title: s.deck.title,
    transition: s.deck.transition,
    font: s.deck.font ?? 'inter',
    accent: s.deck.accent ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    slides: sortedSlides().map(
      ({ id, position, created_at, updated_at, ...rest }) => rest
    ),
  };
}

export function importDeck(deckJson, { keepCollab = false } = {}) {
  const s = db ?? (db = EMPTY());
  if (!keepCollab) s.comments = [];
  s.deck = {
    title: deckJson.title ?? 'Untitled deck',
    transition: deckJson.transition ?? 'fade',
    font: deckJson.font ?? 'inter',
    accent: deckJson.accent ?? null,
    updated_at: now(),
  };
  s.slides = (deckJson.slides ?? []).map((sl, i) =>
    blankSlide({
      position: i,
      layout: sl.layout,
      props: sl.props ?? {},
      background: sl.background ?? { type: 'none' },
      animation: sl.animation ?? 'cascade',
      transition: sl.transition ?? null,
      nav: sl.nav ?? null,
      notes: sl.notes ?? '',
      status: sl.status ?? 'none',
      assignee: sl.assignee ?? null,
    })
  );
  persist();
}
