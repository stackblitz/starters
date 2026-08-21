import { test, type TestContext } from '@webcontainer/test';
import { beforeEach, expect } from 'vitest';

beforeEach<TestContext>(async ({ setup, webcontainer }) => {
  await setup(async () => {
    await webcontainer.mount('bolt-slides');
    await webcontainer.runCommand('npm', ['install']);
  });
});

/* A published deck is the live deck: it reads the same database the editor
   writes to, through the same Edge Function, so there is nothing to bake into
   the build and no snapshot for a published page to fall behind.

   The owner key is the thing that must not be there. It is the credential that
   proves a request may edit the deck, and the only thing that ever holds it is
   the dev server, which hands it over on a route it serves itself — so a
   published deck is keyless by construction and cannot be edited by whoever
   opens it (sharing the editor is what an `edit` share link is for). If that
   ever stops holding, every deck anyone publishes becomes editable by its
   audience. */
test('user can build project', async ({ webcontainer }) => {
  /* Build against a filled-in .env, which is the state a project is published
     from: the deck's address has to reach the bundle, and the deck's key must
     not — these three lines are exactly what Bolt and the agent leave behind. */
  await webcontainer.writeFile(
    '.env',
    [
      'VITE_SUPABASE_URL=https://project-under-test.supabase.co',
      'VITE_SUPABASE_ANON_KEY=anon-key-under-test',
      'DECK_OWNER_KEY=owner-key-under-test',
    ].join('\n')
  );

  await webcontainer.runCommand('npm', ['run', 'build']);

  await expect(webcontainer.readdir('dist')).resolves.toMatchInlineSnapshot(`
    [
      "assets",
      "index.html",
    ]
  `);

  const assets = await webcontainer.readdir('dist/assets');
  const scripts = assets.filter((name) => name.endsWith('.js'));
  expect(scripts.length).toBeGreaterThan(0);

  const bundles = await Promise.all(
    scripts.map((name) => webcontainer.readFile(`dist/assets/${name}`))
  );
  const bundled = bundles.join('\n');

  // the published deck has to reach the same database the editor writes to
  expect(bundled).toContain('https://project-under-test.supabase.co');
  expect(bundled).toContain('anon-key-under-test');

  /* And must carry no way to edit it. Not the key, and not the dev server's
     route for handing the key out either: `import.meta.env.DEV` is a literal
     `false` here, which takes that whole branch out of the build with it. */
  expect(bundled).not.toContain('owner-key-under-test');
  expect(bundled).not.toContain('__deck/env');
});

test('user can typecheck project', async ({ webcontainer }) => {
  await webcontainer.runCommand('npm', ['run', 'typecheck']);
});

/* The deck lives in Postgres, and two things put it there: the schema the agent
   applies with `apply_migration`, and the function it deploys with
   `deploy_edge_function` — slug `deck`, which is this folder's name, since
   Supabase serves a function at /functions/v1/<folder>. Both are found by
   path, so a rename that looks harmless leaves a template whose first prompt
   cannot create a deck at all. Neither file enters the app's build, so the
   toolchain would not notice their absence either.

   What they contain is tested where it runs, against Postgres, in
   bolt-slides-deck.test.ts. */
test('the pieces the deck is made of ship with the template', async ({
  webcontainer,
}) => {
  await expect(webcontainer.readdir('supabase')).resolves.toContain(
    'schema.sql'
  );
  await expect(
    webcontainer.readdir('supabase/functions/deck')
  ).resolves.toContain('index.ts');

  /* And nothing that used to keep a deck inside the project came back. A second
     place to keep slides is not a backup: it is a second answer to what is in
     the deck, and the app would show whichever one the user did not mean. */
  const root = await webcontainer.readdir('.');
  expect(root).not.toContain('data');
  expect(root).not.toContain('server');
  expect(root).not.toContain('scripts');
});
