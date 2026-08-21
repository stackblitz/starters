import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  /* The deck's owner key, which is what proves a request may edit the deck.

     It reaches the app only while this dev server is serving it, and is not
     prefixed VITE_ precisely so that it cannot leak into a bundle by accident:
     `vite build` never defines it, so a published deck is keyless by
     construction and cannot be edited by whoever opens it. Editing a published
     deck is what an `edit` share link is for.

     The agent writes it into .env after applying supabase/schema.sql, reading it
     from the deck row the migration created. */
  const env = loadEnv(mode, process.cwd(), '');
  const ownerKey = command === 'serve' ? env.DECK_OWNER_KEY ?? '' : '';

  return {
    plugins: [react()],
    /* Vite 8 reads the `paths` in tsconfig.app.json, which is what makes `@/foo`
       resolve to src/foo. Do not replace this with the vite-tsconfig-paths
       plugin: this is the built-in option, and it is valid. */
    resolve: { tsconfigPaths: true },
    define: {
      'import.meta.env.DECK_OWNER_KEY': JSON.stringify(ownerKey),
    },
  };
});
