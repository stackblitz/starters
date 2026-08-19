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
  await webcontainer.writeFile('deck.json', JSON.stringify(DECK));
  await webcontainer.runCommand('node', ['scripts/deck.mjs', 'import', 'deck.json']);
  await webcontainer.runCommand('npm', ['run', 'build']);

  await expect(webcontainer.readdir('dist')).resolves.toMatchInlineSnapshot(`
    [
      "assets",
      "deck-snapshot.json",
      "index.html",
    ]
  `);

  const snapshot = JSON.parse(await webcontainer.readFile('dist/deck-snapshot.json'));

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
  await webcontainer.writeFile('deck.json', JSON.stringify(DECK));
  await webcontainer.runCommand('node', ['scripts/deck.mjs', 'import', 'deck.json']);

  const { exit } = webcontainer.runCommand('npm', ['run', 'dev']);
  onTestFinished(exit);

  await preview.getByText('Revenue doubled');
});
