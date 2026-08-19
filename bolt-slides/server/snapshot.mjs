/* Build-time deck snapshot.

   A published build is a static bundle: server/api.mjs rides on the Vite dev
   server and does not exist once deployed. Without this the published page
   waits forever for an API that is not there. So the deck is baked into the
   bundle at build time and the client falls back to it — a published deck
   presents, but cannot be edited.

   Only what the deck needs to render is included. Review metadata (status,
   assignee) and collaboration rows (profiles, comments) are deliberately
   left out: a published URL is unauthenticated, and internal review state
   should not travel with a link you hand to an audience.

   Speaker notes ARE included, so presenter view works on a published deck.
   They are therefore public. Share links and passwords need a real backend
   to enforce — see docs/cloud-setup.md. */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '..'
);
const DB_FILE = path.join(ROOT, 'data', 'deck.json');
const SEED_FILE = path.join(ROOT, 'data', 'deck.seed.json');

const deckMeta = (d = {}) => ({
  title: d.title ?? 'Untitled deck',
  transition: d.transition ?? 'fade',
  font: d.font ?? 'inter',
  accent: d.accent ?? null,
});

const slide = (sl, i) => ({
  id: sl.id ?? `s${i}`,
  position: sl.position ?? i,
  layout: sl.layout,
  props: sl.props ?? {},
  background: sl.background ?? { type: 'none' },
  animation: sl.animation ?? 'cascade',
  transition: sl.transition ?? null,
  nav: sl.nav ?? null,
  notes: sl.notes ?? '',
});

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

/* data/deck.json is the live database shape; data/deck.seed.json is the
   portable format the CLI and the skill author. Accept either. */
export function readDeckSnapshot() {
  const db = fs.existsSync(DB_FILE) ? readJson(DB_FILE) : null;
  if (db) {
    return {
      deck: deckMeta(db.deck),
      slides: [...(db.slides ?? [])]
        .sort((a, b) => a.position - b.position)
        .map(slide),
    };
  }

  const seed = readJson(SEED_FILE) ?? {};
  return { deck: deckMeta(seed), slides: (seed.slides ?? []).map(slide) };
}
