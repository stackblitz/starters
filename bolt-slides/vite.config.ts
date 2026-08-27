import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/* Dev-only: POST /__deck writes repo-root deck.json. Self-writes skip the
   custom HMR event so an in-flight rail drag is not interrupted; other
   windows still hear about the write via BroadcastChannel. Agent/external
   writes send `deck-file-changed` with the parsed file. */
function deckFilePlugin(): Plugin {
  const rel = 'deck.json';
  let ignoreHotUntil = 0;

  return {
    name: 'deck-file',
    configureServer(server: ViteDevServer) {
      const filePath = path.join(server.config.root, rel);
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/__deck' || req.method !== 'POST') {
          next();
          return;
        }
        try {
          const raw = JSON.parse(await readBody(req as IncomingMessage));
          if (!raw || typeof raw !== 'object') {
            throw new Error('invalid-deck');
          }
          const file = raw as {
            boltSlidesVersion?: number;
            boltSlidesId?: string | null;
            deck: unknown;
            slides: unknown;
          };
          if (!file.deck || !Array.isArray(file.slides)) {
            throw new Error('invalid-deck');
          }
          if (!file.boltSlidesId) file.boltSlidesId = randomUUID();
          file.boltSlidesVersion = file.boltSlidesVersion ?? 1;
          ignoreHotUntil = Date.now() + 400;
          await writeFile(
            filePath,
            JSON.stringify(file, null, 2) + '\n',
            'utf8'
          );
          sendJson(res, 200, file);
        } catch {
          sendJson(res, 400, { error: 'invalid-deck' });
        }
      });
    },
    async handleHotUpdate({ file, server }) {
      if (path.basename(file) !== rel) return;
      if (Date.now() < ignoreHotUntil) return [];
      try {
        const parsed = JSON.parse(await readFile(file, 'utf8'));
        server.ws.send({
          type: 'custom',
          event: 'deck-file-changed',
          data: parsed,
        });
      } catch {
        /* keep the last good client state */
      }
      return [];
    },
  };
}

export default defineConfig({
  plugins: [react(), deckFilePlugin()],
  resolve: {
    tsconfigPaths: true,
  },
});
