#!/usr/bin/env node
/* Deck CLI — the AI/skill (and humans) read + write the deck through this,
   so the deck file stays the single source of truth while authoring stays
   plain JSON.

     node scripts/deck.mjs export [file.json]   print (or write) the deck as JSON
     node scripts/deck.mjs import <file.json>   replace the deck from JSON
     node scripts/deck.mjs apply                import deck.draft.json if the deck
                                                does not already reflect it (predev)
     node scripts/deck.mjs reset                re-seed from data/deck.seed.json
     node scripts/deck.mjs status               one line per slide (layout, title, status)
     node scripts/deck.mjs published <url>      record where the deck is published
                                                ("published none" to forget it)

   The JSON format is documented in .bolt/skills/slides/SKILL.md. */
import fs from 'node:fs';
import {
  openDb,
  exportDeck,
  importDeck,
  getState,
  persistNow,
  setPublishUrl,
  DB_FILE,
} from '../server/db.mjs';
import { applyDraft, noteDraft, DRAFT_FILE } from '../server/draft.mjs';

const [cmd, arg] = process.argv.slice(2);

await openDb();

if (cmd === 'export') {
  const json = JSON.stringify(exportDeck(), null, 2);
  if (arg) {
    fs.writeFileSync(arg, json);
    // exporting over the draft makes the two agree; do not re-apply it later
    noteDraft(arg);
    persistNow();
    console.log(`wrote ${arg}`);
  } else console.log(json);
} else if (cmd === 'import') {
  if (!arg) {
    console.error('usage: deck.mjs import <file.json>');
    process.exit(1);
  }
  importDeck(JSON.parse(fs.readFileSync(arg, 'utf8')));
  noteDraft();
  persistNow();
  console.log(
    `imported ${arg} → ${DB_FILE} (${getState().slides.length} slides)`
  );
} else if (cmd === 'apply') {
  const outcome = await applyDraft();
  const said = {
    imported: () =>
      `applied ${DRAFT_FILE} → ${DB_FILE} (${getState().slides.length} slides)`,
    'no-draft': () => `no draft at ${DRAFT_FILE}, leaving the deck as it is`,
    unchanged: () => `deck already reflects ${DRAFT_FILE}`,
    unreadable: () => `could not read ${DRAFT_FILE}, leaving the deck as it is`,
  };
  console.log(said[outcome]?.() ?? outcome);
} else if (cmd === 'reset') {
  importDeck(
    JSON.parse(
      fs.readFileSync(
        new URL('../data/deck.seed.json', import.meta.url),
        'utf8'
      )
    )
  );
  // a reset is a choice against the draft; do not undo it on the next start
  noteDraft();
  persistNow();
  console.log(
    `reset from data/deck.seed.json (${getState().slides.length} slides)`
  );
} else if (cmd === 'published') {
  if (!arg) {
    console.error('usage: deck.mjs published <url | none>');
    process.exit(1);
  }
  const site = setPublishUrl(arg === 'none' ? null : arg);
  if (site === undefined) {
    console.error(`not a site URL: ${arg}`);
    process.exit(1);
  }
  persistNow();
  console.log(
    site
      ? `sharing links now point at ${site}`
      : 'forgot where the deck is published; sharing is off until it is set again'
  );
} else if (cmd === 'status') {
  const { slides } = getState();
  for (const s of slides) {
    const title = s.props.title ?? s.props.text ?? s.nav ?? '';
    console.log(
      `${String(s.position + 1).padStart(2)} ${s.layout.padEnd(
        11
      )} ${s.status.padEnd(12)} ${String(title).slice(0, 60)}`
    );
  }
} else {
  console.log(
    'usage: node scripts/deck.mjs <export [file] | import <file> | apply | reset | status | published <url|none>>'
  );
}
process.exit(0);
