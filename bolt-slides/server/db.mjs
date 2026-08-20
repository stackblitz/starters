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

export const ROOT = path.resolve(
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
  /* Which deck.draft.json content the deck already reflects — see
     server/draft.mjs. Bookkeeping, not deck content: it stays out of
     exportDeck() so it never travels in a portable deck. */
  adopted_draft: null,
});

export const uid = () => crypto.randomUUID().slice(0, 8);
const now = () => new Date().toISOString();

let db = null;
let saveTimer = null;
let loadedMtime = 0;
let dirty = false;
let lastWrite = 0;

/* When this process last wrote the file. The deck CLI runs as its own process,
   so its writes leave this untouched — that is how the dev server tells an
   outside rewrite from one of its own API saves (see vite.config.ts). */
export const lastWriteAt = () => lastWrite;

const fileMtime = () =>
  fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).mtimeMs : 0;

const rewrittenByAnotherProcess = () => fileMtime() > loadedMtime + 1;

/* Drop what we are holding, pending write included. Called when another process
   has replaced the deck: an import is an explicit "replace the deck" action, so
   it outranks our cached copy. That can cost an edit made in the last 250ms,
   which is the right trade — the alternative is silently throwing away the whole
   imported deck, and the client re-fetches on the change anyway. */
function discard() {
  clearTimeout(saveTimer);
  saveTimer = null;
  dirty = false;
  db = null;
}

/* Open (or create) the file. Another process — the deck CLI, the skill — may
   have rewritten it since we last read, so reload when the file is newer. */
export async function openDb() {
  if (db && rewrittenByAnotherProcess()) discard();
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

export const adoptedDraft = () => state().adopted_draft;

export function setAdoptedDraft(hash) {
  state().adopted_draft = hash;
  persist();
}

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

  /* An import landed while this write was still queued. Writing now would
     restore the deck the import just replaced, and the CLI would already have
     reported success — so the deck silently reverts. Drop ours instead. */
  if (rewrittenByAnotherProcess()) {
    discard();
    return;
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  loadedMtime = fileMtime();
  lastWrite = Date.now();
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
/* `id` is carried so a deck survives the round trip: re-importing an exported
   deck keeps the same slides rather than replacing them with copies, which is
   what lets comments stay attached (see importDeck). Position is implied by
   order, and the timestamps belong to the row, not to the authored deck. */
export function exportDeck() {
  const s = state();
  return {
    title: s.deck.title,
    transition: s.deck.transition,
    font: s.deck.font ?? 'inter',
    accent: s.deck.accent ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    slides: sortedSlides().map(
      ({ position, created_at, updated_at, ...rest }) => rest
    ),
  };
}

/* Replaces the deck. Slides authored without an `id` are new, so they get one;
   slides that carry one keep their identity, and anything pointing at them
   survives. Comments left without a slide are dropped — the slide they were
   written on is gone. */
export function importDeck(deckJson) {
  const s = db ?? (db = EMPTY());
  const previous = new Map(s.slides.map((sl) => [sl.id, sl]));

  s.deck = {
    title: deckJson.title ?? 'Untitled deck',
    transition: deckJson.transition ?? 'fade',
    font: deckJson.font ?? 'inter',
    accent: deckJson.accent ?? null,
    updated_at: now(),
  };
  s.slides = (deckJson.slides ?? []).map((sl, i) =>
    blankSlide({
      id: sl.id ?? uid(),
      created_at: previous.get(sl.id)?.created_at ?? now(),
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

  const kept = new Set(s.slides.map((sl) => sl.id));
  s.comments = s.comments.filter((c) => kept.has(c.slide_id));

  persist();
}
