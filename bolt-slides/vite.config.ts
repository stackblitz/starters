import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* The API (server/api.mjs) rides on the Vite dev server, so `npm run dev`
   runs the app plus the deck API the editor and skill talk to. */
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
  resolve: {
    tsconfigPaths: true,
  },
});
