/* The dev server lives in its own file: a second Vite process in the same test
   file cannot start — it fails with `spawn vite EACCES` — so the build tests and
   this one cannot share one. */
import { test, type TestContext } from '@webcontainer/test';
import { beforeEach, expect, onTestFinished } from 'vitest';

const DECK = {
  title: 'Quarterly Review',
  slides: [
    { layout: 'cover', props: { title: 'Quarterly Review' } },
    { layout: 'statement', props: { title: 'Revenue doubled' } },
  ],
};

beforeEach<TestContext>(async ({ setup, webcontainer }) => {
  await setup(async () => {
    await webcontainer.mount('bolt-slides');
    await webcontainer.runCommand('npm', ['install']);
  });
});

/* Starting the project, and then the thing an open editor needs from an import.

   Slide text is contenteditable, so keystrokes live in the DOM and only reach
   the deck on blur, addressed by slide id. An import that either goes
   unannounced or re-issues ids therefore leaves every field writing to a slide
   that is gone — the typed text shows for a frame and snaps back, with nothing
   logged anywhere. Both halves are checked on the sequence the first prompt
   produces: an editor save, and the import that follows it a moment later.

   The editor's own saves must stay quiet, since re-fetching over someone
   mid-sentence is the reason that guard exists at all — which is what makes an
   import landing right behind one the case that breaks. */
test('user can start project and edit the deck across an import', async ({
  webcontainer,
}) => {
  await webcontainer.writeFile('deck.draft.json', JSON.stringify(DECK));
  await webcontainer.writeFile('probe.mjs', PROBE);

  // predev applies the draft, so this comes up on the authored deck
  const dev = webcontainer.runCommand('npm', ['run', 'dev']);
  onTestFinished(dev.exit);

  /* Whichever port it settled on — and failing on the port rather than waiting
     out the test timeout, since a dev server that never starts is the one way
     this test goes quiet instead of red. */
  let port = '';
  dev.onData((chunk) => {
    const found = chunk
      .replace(/\u001b\[[\d;]*m/g, '')
      .match(/localhost:(\d+)/);
    if (found && !port) port = found[1];
  });
  await expect.poll(() => port, { timeout: 30_000 }).toBeTruthy();

  const out = await webcontainer.runCommand('node', ['probe.mjs', port]);
  const probe = JSON.parse(out.match(/\{[\s\S]*\}/)![0]);

  // what the browser loads is the deck that was authored
  expect(probe.loaded.title).toBe('Quarterly Review');
  expect(probe.loaded.layouts).toEqual(['cover', 'statement']);

  // an import is announced, so a browser can pick up a deck it did not write
  expect(probe.events).toContain('deck:changed');

  // and what that browser already has still addresses the same slides
  expect(probe.ids.after).toEqual(probe.ids.before);

  // the import won: it is the newer authority on the deck, not the stale save
  expect(probe.title).toBe('Quarterly Review');
});

/* Runs inside the project, next to the dev server: loads the deck and saves
   through the API the way the editor does, imports the draft the way the skill
   does, and reports what a browser would have heard. */
const PROBE = `
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const host = 'localhost:' + process.argv[2];
const deck = () => JSON.parse(fs.readFileSync('data/deck.json', 'utf8'));
const ids = () => deck().slides.map((s) => s.id);

/* what the browser hears: the dev server's own channel, joined the way the
   client does */
const events = [];
const ws = new WebSocket('ws://' + host + '/', 'vite-hmr');
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.type === 'custom') events.push(m.event);
};
await new Promise((resolve, reject) => {
  ws.onopen = () => resolve();
  ws.onerror = () => reject(new Error('no dev server to listen to'));
});

const state = await (await fetch('http://' + host + '/api/state')).json();
const loaded = {
  title: state.deck.title,
  layouts: state.slides.map((s) => s.layout),
};

await fetch('http://' + host + '/api/deck', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: 'Renamed in the editor' }),
});
await new Promise((r) => setTimeout(r, 400)); // let that save reach the file

// a separate process, as the skill's import always is
const before = ids();
await new Promise((resolve) => {
  spawn('node', ['scripts/deck.mjs', 'import', 'deck.draft.json'], {
    stdio: 'ignore',
  }).on('close', resolve);
});
const after = ids();

await new Promise((r) => setTimeout(r, 1000)); // and the watcher to report it
console.log(
  JSON.stringify({
    loaded,
    events,
    ids: { before, after },
    title: deck().deck.title,
  })
);
process.exit(0);
`;
