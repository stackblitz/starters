/* Applying deck.draft.json — the authored deck lands even if nobody runs the
   import.

   Authoring is two steps (write deck.draft.json, then `deck.mjs import`), and
   the second one is the one that gets dropped: the draft sits on disk while the
   app still renders whatever it rendered before. So the draft is also applied on
   its own, from `npm run predev` before the server boots and from the dev
   server's watcher once it is running — whichever comes first.

   The deck records which draft content it already reflects, and a draft is
   applied once per distinct content. That is what keeps a restart from
   re-applying a draft over work done since: editing in the app never changes the
   draft, so its content still matches what was recorded and nothing happens.
   Recording content rather than a timestamp is deliberate — mtimes do not
   survive a project being stored and materialized again, so a rule that
   compared them could re-apply a stale draft on every open. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ROOT,
  openDb,
  importDeck,
  persistNow,
  adoptedDraft,
  setAdoptedDraft,
} from './db.mjs';

export const DRAFT_FILE = path.join(ROOT, 'deck.draft.json');

const hash = (contents) =>
  crypto.createHash('sha256').update(contents).digest('hex').slice(0, 16);

const isDraft = (file) => path.resolve(file) === DRAFT_FILE;

/* Record the draft as already reflected by the deck, without applying it. Called
   wherever the two are brought into agreement — importing the draft, exporting
   over it — and after any explicit replacement of the deck, since someone who
   chose something else must not be overruled by the next restart. A path that is
   not the draft is a no-op, so callers can pass whatever file they were given. */
export function noteDraft(file = DRAFT_FILE) {
  try {
    if (!isDraft(file)) return;
    setAdoptedDraft(hash(fs.readFileSync(DRAFT_FILE, 'utf8')));
  } catch {
    // no draft to note
  }
}

/* Never throws: this runs on the way to starting the dev server, and no draft
   problem is worth leaving the project without one. */
export async function applyDraft(file = DRAFT_FILE) {
  try {
    if (!fs.existsSync(file)) return 'no-draft';

    const contents = fs.readFileSync(file, 'utf8');
    const id = hash(contents);

    await openDb();
    if (adoptedDraft() === id) return 'unchanged';

    importDeck(JSON.parse(contents));
    setAdoptedDraft(id);
    persistNow();

    return 'imported';
  } catch {
    return 'unreadable';
  }
}
