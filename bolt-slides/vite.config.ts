import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* The API (server/api.mjs) + JSON persistence (server/db.mjs → data/deck.json)
   ride on the Vite dev server, so `npm run dev` runs the whole stack.

   This is the storage layer the rebuild replaces: it exists here only so the app
   keeps running while Postgres is put behind it. */
function deckApi() {
  return {
    name: 'deck-api',
    async configureServer(server: import('vite').ViteDevServer) {
      const { apiMiddleware } = await import('./server/api.mjs');
      server.middlewares.use(apiMiddleware(server.config.root));
    },
    async configurePreviewServer(server: import('vite').PreviewServer) {
      const { apiMiddleware } = await import('./server/api.mjs');
      server.middlewares.use(apiMiddleware(server.config.root));
    },
  };
}

export default defineConfig({
  plugins: [react(), deckApi()],
  /* Vite 8 reads the `paths` in tsconfig.app.json, which is what makes `@/foo`
     resolve to src/foo. Do not replace this with the vite-tsconfig-paths
     plugin: this is the built-in option, and it is valid. */
  resolve: { tsconfigPaths: true },
});
