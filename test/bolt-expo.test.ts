import { test, type TestContext } from '@webcontainer/test';
import { beforeEach, expect, onTestFinished } from 'vitest';

beforeEach<TestContext>(async ({ setup, webcontainer }) => {
  await setup(async () => {
    await webcontainer.mount('bolt-expo');
    await webcontainer.runCommand('npm', ['install']);
  });
});

test('user can build project', async ({ webcontainer }) => {
  await webcontainer.runCommand('npm', ['run', 'build:web']);

  await expect(webcontainer.readdir('dist')).resolves.toMatchInlineSnapshot(`
      [
        "_expo",
        "assets",
        "favicon.ico",
        "index.html",
        "metadata.json",
      ]
    `);
});

test('user can start project and see changes in preview', async ({
  preview,
  webcontainer,
}) => {
  const { exit } = webcontainer.runCommand('npm', ['run', 'dev']);
  onTestFinished(exit);

  await preview.getByText("This screen doesn't exist.");

  const app = await webcontainer.readFile('app/+not-found.tsx');

  await webcontainer.writeFile(
    'app/+not-found.tsx',
    app.replace("This screen doesn't exist.", 'File edited')
  );

  await preview.getByText('File edited');
});
