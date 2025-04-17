import { test, type TestContext } from '@webcontainer/test';
import { beforeEach, onTestFinished } from 'vitest';

beforeEach<TestContext>(async ({ webcontainer }) => {
  await webcontainer.mount('bolt-vite-react-ts');
});

test('user can start project', async ({ preview, webcontainer }) => {
  await webcontainer.runCommand('npm', ['install']);

  const { exit } = webcontainer.runCommand('npm', ['run', 'dev']);
  onTestFinished(exit);

  await preview.getByText(
    'Start prompting (or editing) to see magic happen :)'
  );
});
