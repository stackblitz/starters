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
      const { DB_FILE, lastWriteAt } = await import('./server/db.mjs');
      const { applyDraft, DRAFT_FILE } = await import('./server/draft.mjs');
      server.middlewares.use(apiMiddleware(server.config.root));

      /* Nothing in the bundle imports data/deck.json, so an import from the deck
         CLI changes the deck with no HMR and the browser keeps showing the old
         slides until someone reloads by hand.

         Only outside rewrites are announced. The editor saves optimistically —
         local state first, request after — so re-fetching on its own writes
         would race the user and overwrite what they are still typing. A write
         this process just made is therefore ignored. */
      let pending: ReturnType<typeof setTimeout> | undefined;

      const announce = (file: string) => {
        if (file !== DB_FILE || Date.now() - lastWriteAt() < 1000) return;

        // creating the file emits add + change; coalesce into one re-fetch
        clearTimeout(pending);
        pending = setTimeout(
          () => server.hot.send({ type: 'custom', event: 'deck:changed' }),
          50
        );
      };

      server.watcher.add(DB_FILE);
      server.watcher.on('add', announce);
      server.watcher.on('change', announce);

      /* `npm run predev` applies a draft that already exists at boot; this
         covers one written afterwards. Applying writes the deck through this
         process, so the watcher above treats it as our own and stays quiet —
         announce it here instead. A draft caught mid-write reads as unreadable
         and is left for the change event that completes it. */
      let applying: ReturnType<typeof setTimeout> | undefined;

      const apply = (file: string) => {
        if (file !== DRAFT_FILE) return;

        clearTimeout(applying);
        applying = setTimeout(async () => {
          if ((await applyDraft()) !== 'imported') return;
          server.hot.send({ type: 'custom', event: 'deck:changed' });
        }, 150);
      };

      server.watcher.add(DRAFT_FILE);
      server.watcher.on('add', apply);
      server.watcher.on('change', apply);
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
