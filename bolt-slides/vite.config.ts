import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const ENV_ROUTE = '/__deck/env';

/* Hands the app its credentials while the dev server is serving it.

   Read per request rather than captured at startup, because in Bolt they are
   written after startup: the database is provisioned, and the deck's owner key
   written into .env, while this server is already running. Vite restarts itself
   when it sees .env change and would pick them up that way — but that is a file
   watch event inside WebContainer, and an editor that cannot save is too poor a
   failure to leave one missed event away. A file read per page load settles it.

   The owner key is what proves a request may edit the deck, and it lives only
   here: this plugin does not run in `vite build`, so a published deck is
   keyless by construction and cannot be edited by whoever opens it. Editing a
   published deck is what an `edit` share link is for. */
function deckEnv(mode: string): Plugin {
  return {
    name: 'deck-env',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(ENV_ROUTE, (_req, res) => {
        const env = loadEnv(mode, process.cwd(), '');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(
          JSON.stringify({
            url: env.VITE_SUPABASE_URL ?? '',
            anonKey: env.VITE_SUPABASE_ANON_KEY ?? '',
            ownerKey: env.DECK_OWNER_KEY ?? '',
          })
        );
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), deckEnv(mode)],
  /* Vite 8 reads the `paths` in tsconfig.app.json, which is what makes `@/foo`
     resolve to src/foo. Do not replace this with the vite-tsconfig-paths
     plugin: this is the built-in option, and it is valid. */
  resolve: { tsconfigPaths: true },
}));
