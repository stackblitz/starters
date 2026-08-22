import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/** Serve-only. Never runs in `vite build`, so DECK_OWNER_SECRET stays out of
 *  the published JS. Local `npm run dev` and the Bolt WC preview use this. */
function ownerProofPlugin(): Plugin {
  return {
    name: 'deck-owner-proof',
    configureServer(server) {
      const env = loadEnv(
        server.config.mode,
        server.config.envDir || process.cwd(),
        ''
      );
      const token = env.DECK_OWNER_SECRET || '';
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path !== '/.bolt/owner-proof') {
          next();
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ token: token || null }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), ownerProofPlugin()],
  resolve: {
    tsconfigPaths: true,
  },
});
