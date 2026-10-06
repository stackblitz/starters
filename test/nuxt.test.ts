import { test, type TestContext } from '@webcontainer/test';
import { beforeEach, expect, onTestFinished } from 'vitest';

beforeEach<TestContext>(async ({ setup, webcontainer }) => {
  await setup(async () => {
    await webcontainer.mount('nuxt');
    await webcontainer.runCommand('npm', ['install']);
  });
});

test('user can build project', async ({ webcontainer }) => {
  await webcontainer.runCommand('npm', ['run', 'generate']);

  await expect(webcontainer.readdir('.output/public')).resolves
    .toMatchInlineSnapshot(`
    [
      "200.html",
      "404.html",
      "_nuxt",
      "_payload.json",
      "favicon.ico",
      "index.html",
      "robots.txt",
    ]
  `);
});

test('user can start project and see changes in preview', async ({
  preview,
  webcontainer,
}) => {
  const { exit } = webcontainer.runCommand('npm', ['run', 'dev']);
  onTestFinished(exit);

  await preview.getByText(
    'Start prompting (or editing) to see magic happen :)'
  );

  const app = await webcontainer.readFile('app/app.vue');

  await webcontainer.writeFile(
    'app/app.vue',
    app.replace(
      '<p>Start prompting (or editing) to see magic happen :)</p>',
      '<h1>File edited</h1>'
    )
  );

  await preview.getByRole('heading', { level: 1, name: 'File edited' });
});
