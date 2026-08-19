import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* The API (server/api.mjs) + JSON persistence (server/db.mjs → data/deck.json)
   ride on the Vite dev server, so `npm run dev` runs the whole stack. */
function deckApi() {
  return {
    name: 'deck-api',
    async configureServer(server: import('vite').ViteDevServer) {
      const { apiMiddleware } = await import('./server/api.mjs')
      server.middlewares.use(apiMiddleware(server.config.root))
    },
    async configurePreviewServer(server: import('vite').PreviewServer) {
      const { apiMiddleware } = await import('./server/api.mjs')
      server.middlewares.use(apiMiddleware(server.config.root))
    },
  }
}

export default defineConfig({
  plugins: [react(), deckApi()],
  resolve: {
    tsconfigPaths: true,
  },
})
