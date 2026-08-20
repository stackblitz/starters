import { test, type TestContext } from '@webcontainer/test';
import { beforeEach, expect, onTestFinished } from 'vitest';

const DECK = {
  title: 'Quarterly Review',
  transition: 'fade',
  font: 'inter',
  slides: [
    {
      layout: 'cover',
      props: { title: 'Quarterly Review' },
      notes: 'open with the headline number',
      status: 'needs-review',
    },
    { layout: 'statement', props: { title: 'Revenue doubled' } },
  ],
};

beforeEach<TestContext>(async ({ setup, webcontainer }) => {
  await setup(async () => {
    await webcontainer.mount('bolt-slides');
    await webcontainer.runCommand('npm', ['install']);
  });
});

/* The deck API is Vite dev-server middleware, so a published deck renders from
   a snapshot baked in at build time. If that stops happening, publishing a deck
   breaks silently — the page just never finishes loading. */
test('user can build project', async ({ webcontainer }) => {
  await webcontainer.writeFile('deck.draft.json', JSON.stringify(DECK));
  await webcontainer.runCommand('node', [
    'scripts/deck.mjs',
    'import',
    'deck.draft.json',
  ]);
  await webcontainer.runCommand('npm', ['run', 'build']);

  await expect(webcontainer.readdir('dist')).resolves.toMatchInlineSnapshot(`
    [
      "assets",
      "deck-snapshot.json",
      "index.html",
    ]
  `);

  const snapshot = JSON.parse(
    await webcontainer.readFile('dist/deck-snapshot.json')
  );

  expect(snapshot.deck.title).toBe('Quarterly Review');
  expect(snapshot.slides.map((s: { layout: string }) => s.layout)).toEqual([
    'cover',
    'statement',
  ]);

  // presenter view works on a published deck, so notes travel with it
  expect(snapshot.slides[0].notes).toBe('open with the headline number');

  // review state and collaboration rows must not reach a public URL
  expect(snapshot.slides[0]).not.toHaveProperty('status');
  expect(snapshot).not.toHaveProperty('comments');
  expect(snapshot).not.toHaveProperty('profiles');
});

test('user can start project and see the deck in the editor', async ({
  preview,
  webcontainer,
}) => {
  await webcontainer.writeFile('deck.draft.json', JSON.stringify(DECK));
  await webcontainer.runCommand('node', [
    'scripts/deck.mjs',
    'import',
    'deck.draft.json',
  ]);

  const { exit } = webcontainer.runCommand('npm', ['run', 'dev']);
  onTestFinished(exit);

  await preview.getByText('Revenue doubled');
});

/* Authoring is two steps — write deck.draft.json, then import it — and the
   import is the one that gets dropped, leaving the deck rendering something the
   draft has moved on from. `predev` closes that gap on every start, so what it
   must never do is undo work: the deck records which draft content it already
   reflects, and editing in the app does not change the draft. */
test('a draft is applied before the dev server starts, and only once', async ({
  webcontainer,
}) => {
  const deck = async () =>
    JSON.parse(await webcontainer.readFile('data/deck.json'));

  await webcontainer.writeFile('deck.draft.json', JSON.stringify(DECK));
  await webcontainer.runCommand('npm', ['run', 'predev']);

  const applied = await deck();
  expect(applied.deck.title).toBe('Quarterly Review');
  expect(applied.slides.map((s: { layout: string }) => s.layout)).toEqual([
    'cover',
    'statement',
  ]);

  /* Restarting re-runs predev. The draft has not changed, so the deck must come
     through untouched — same slides, not fresh copies of them, since anything
     referring to a slide by id would be left pointing at nothing. */
  await webcontainer.runCommand('npm', ['run', 'predev']);

  const restarted = await deck();
  expect(restarted.slides.map((s: { id: string }) => s.id)).toEqual(
    applied.slides.map((s: { id: string }) => s.id)
  );

  // work done after the draft was applied survives the next start
  await webcontainer.runCommand('node', [
    '-e',
    `import('./server/db.mjs').then(async (db) => {
       await db.openDb();
       db.state().slides.push(db.blankSlide({ position: 2, layout: 'quote' }));
       db.persist();
       db.persistNow();
     })`,
  ]);
  await webcontainer.runCommand('npm', ['run', 'predev']);

  expect((await deck()).slides).toHaveLength(3);

  // a genuinely new draft is what does replace the deck
  await webcontainer.writeFile(
    'deck.draft.json',
    JSON.stringify({ title: 'Rewritten', slides: [{ layout: 'quote' }] })
  );
  await webcontainer.runCommand('npm', ['run', 'predev']);

  expect((await deck()).deck.title).toBe('Rewritten');
});

/* Exporting a deck and importing it back is how the skill edits an existing
   deck, so it has to be lossless. Slide ids carry through the draft format for
   that reason, and comments hang off those ids — re-issuing them on every
   import would quietly detach every review thread in the deck. */
test('a deck survives the export/import round trip with its comments', async ({
  webcontainer,
}) => {
  await webcontainer.writeFile('deck.draft.json', JSON.stringify(DECK));
  await webcontainer.runCommand('node', [
    'scripts/deck.mjs',
    'import',
    'deck.draft.json',
  ]);

  await webcontainer.runCommand('node', [
    '-e',
    `import('./server/db.mjs').then(async (db) => {
       await db.openDb();
       const first = db.sortedSlides()[0];
       db.state().comments.push({ id: 'c1', slide_id: first.id, body: 'fix this' });
       db.persist();
       db.persistNow();
     })`,
  ]);

  const before = JSON.parse(await webcontainer.readFile('data/deck.json'));

  await webcontainer.runCommand('node', [
    'scripts/deck.mjs',
    'export',
    'deck.draft.json',
  ]);
  await webcontainer.runCommand('node', [
    'scripts/deck.mjs',
    'import',
    'deck.draft.json',
  ]);

  const after = JSON.parse(await webcontainer.readFile('data/deck.json'));

  expect(after.slides.map((s: { id: string }) => s.id)).toEqual(
    before.slides.map((s: { id: string }) => s.id)
  );
  expect(after.comments).toHaveLength(1);
  expect(after.comments[0].slide_id).toBe(after.slides[0].id);
});
