import { test, type TestContext } from '@webcontainer/test';
import { beforeEach, expect, onTestFinished } from 'vitest';

beforeEach<TestContext>(async ({ setup, webcontainer }) => {
  await setup(async () => {
    await webcontainer.mount('bolt-cms-react-router');
    await webcontainer.runCommand('npm', ['install']);
  });
});

test('user can build project', async ({ webcontainer }) => {
  await webcontainer.runCommand('npm', ['run', 'build']);

  // SPA mode: React Router emits a static client bundle plus index.html.
  await expect(webcontainer.readdir('build/client')).resolves
    .toMatchInlineSnapshot(`
    [
      "assets",
      "index.html",
    ]
  `);

  const html = await webcontainer.readFile('build/client/index.html');
  expect(html).toContain('data-site-theme="classic"');
});

test('user can start project and see changes in preview', async ({
  preview,
  webcontainer,
}) => {
  const { exit } = webcontainer.runCommand('npm', ['run', 'dev']);
  onTestFinished(exit);

  // Without Supabase env the site still renders its chrome with the
  // WordPress defaults and a setup notice.
  await preview.getByRole('link', { name: 'My WordPress Site' });
  await preview.getByText('Supabase is not configured.');

  const types = await webcontainer.readFile('app/lib/cms/types.ts');

  await webcontainer.writeFile(
    'app/lib/cms/types.ts',
    types.replace(
      "site_title: 'My WordPress Site'",
      "site_title: 'File edited'"
    )
  );

  await preview.getByRole('link', { name: 'File edited' });
});
