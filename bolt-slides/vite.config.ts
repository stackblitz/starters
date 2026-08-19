import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/* The API (server/api.mjs) + JSON persistence (server/db.mjs → data/deck.json)
   ride on the Vite dev server, so `npm run dev` runs the whole stack.

   Deliberately not mounted on the preview server: `npm run preview` serves the
   production build, and a published build has no API. Mounting it here would
   make preview the one command that hides the difference. */
function deckApi(): Plugin {
  return {
    name: 'deck-api',
    async configureServer(server) {
      const { apiMiddleware } = await import('./server/api.mjs');
      server.middlewares.use(apiMiddleware(server.config.root));
    },
  };
}

/* Bakes the deck into the bundle so a published build has something to render
   without an API. See server/snapshot.mjs. */
function deckSnapshot(): Plugin {
  return {
    name: 'deck-snapshot',
    apply: 'build',
    async generateBundle() {
      const { readDeckSnapshot } = await import('./server/snapshot.mjs');
      this.emitFile({
        type: 'asset',
        fileName: 'deck-snapshot.json',
        source: JSON.stringify(readDeckSnapshot()),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), deckApi(), deckSnapshot()],
  resolve: {
    tsconfigPaths: true,
  },
});
