import { defineConfig } from 'vitest/config';
import { vitestWebcontainers } from '@webcontainer/test/plugin';

export default defineConfig({
  plugins: [vitestWebcontainers()],

  test: {
    reporters: 'verbose',

    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [
        {
          browser: 'chromium',
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
        {
          browser: 'firefox',
          testTimeout: process.env.CI ? 180_000 : 120_000,
          hookTimeout: process.env.CI ? 180_000 : 120_000,
          retry: process.env.CI ? 3 : undefined,
        },
      ],
      headless: true,
    },
  },
});
