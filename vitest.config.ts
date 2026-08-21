import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { vitestWebContainers } from '@webcontainer/test/plugin';

export default defineConfig({
  plugins: [vitestWebContainers()],

  /* pglite ships its Postgres as WebAssembly plus a filesystem bundle, and
     pre-bundling the package leaves the second one empty — it fails with
     "Invalid FS bundle size: 0". The slides tests run their SQL on it. */
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },

  test: {
    reporters: 'verbose',

    browser: {
      enabled: true,
      provider: playwright(),
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
