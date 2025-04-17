import { defineConfig } from 'vitest/config';
import { vitestWebcontainers } from '@webcontainer/test/plugin';

export default defineConfig({
  plugins: [vitestWebcontainers()],
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }, { browser: 'firefox' }],
      headless: true,
    },
  },
});
