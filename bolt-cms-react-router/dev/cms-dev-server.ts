/**
 * Dev-only Vite plugin that stands in for the Bolt host so `/admin` works
 * outside of a Bolt project.
 *
 *   POST /__cms   execute one `CmsOp` with the service-role key from `.env`
 *   GET  /__host  a page that frames `/admin` and proxies its postMessage
 *                 requests to `/__cms` (exercises the real iframe transport)
 *
 * Nothing here is part of `react-router build`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';

import {
  CMS_HOST_SOURCE,
  CMS_PROTOCOL_VERSION,
  isCmsTable,
  type CmsOp,
  type CmsRequest,
  type CmsResponse,
  type Filter,
} from '../app/admin/bridge/protocol.ts';

const UPLOADS_DIR = 'public/wp-content/uploads';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, filters: Filter[] | undefined) {
  for (const f of filters ?? []) {
    switch (f.op) {
      case 'eq':
        query = query.eq(f.column, f.value);
        break;
      case 'neq':
        query = query.neq(f.column, f.value);
        break;
      case 'gt':
        query = query.gt(f.column, f.value);
        break;
      case 'gte':
        query = query.gte(f.column, f.value);
        break;
      case 'lt':
        query = query.lt(f.column, f.value);
        break;
      case 'lte':
        query = query.lte(f.column, f.value);
        break;
      case 'in':
        query = query.in(f.column, f.value as unknown[]);
        break;
      case 'is':
        query = query.is(f.column, f.value as null | boolean);
        break;
      case 'ilike':
        query = query.ilike(f.column, String(f.value));
        break;
      case 'like':
        query = query.like(f.column, String(f.value));
        break;
    }
  }
  return query;
}

function assertTable(table: string) {
  if (!isCmsTable(table)) {
    throw Object.assign(new Error(`Table "${table}" is not a cms_ table`), {
      code: 'forbidden_table',
    });
  }
}

export async function executeOp(
  supabase: SupabaseClient,
  root: string,
  op: CmsOp
): Promise<{ data: unknown; count?: number | null }> {
  switch (op.kind) {
    case 'hello':
      return {
        data: { host: 'vite-dev-middleware', version: CMS_PROTOCOL_VERSION },
      };

    case 'select': {
      assertTable(op.table);
      let q = supabase
        .from(op.table)
        .select(op.columns ?? '*', op.count ? { count: 'exact' } : undefined);
      q = applyFilters(q, op.filters);
      for (const o of op.order ?? []) {
        q = q.order(o.column, {
          ascending: o.ascending ?? true,
          nullsFirst: o.nullsFirst,
        });
      }
      if (op.range) q = q.range(op.range.from, op.range.to);
      const result = op.single ? await q.maybeSingle() : await q;
      if (result.error) throw result.error;
      return { data: result.data, count: result.count };
    }

    case 'insert': {
      assertTable(op.table);
      const { data, error } = await supabase
        .from(op.table)
        .insert(op.values)
        .select(op.returning ?? '*');
      if (error) throw error;
      return { data };
    }

    case 'upsert': {
      assertTable(op.table);
      const { data, error } = await supabase
        .from(op.table)
        .upsert(op.values, { onConflict: op.onConflict })
        .select(op.returning ?? '*');
      if (error) throw error;
      return { data };
    }

    case 'update': {
      assertTable(op.table);
      if (!op.filters?.length) {
        throw Object.assign(new Error('update requires filters'), {
          code: 'unfiltered_write',
        });
      }
      let q = supabase.from(op.table).update(op.values);
      q = applyFilters(q, op.filters);
      const { data, error } = await q.select(op.returning ?? '*');
      if (error) throw error;
      return { data };
    }

    case 'delete': {
      assertTable(op.table);
      if (!op.filters?.length) {
        throw Object.assign(new Error('delete requires filters'), {
          code: 'unfiltered_write',
        });
      }
      let q = supabase.from(op.table).delete();
      q = applyFilters(q, op.filters);
      const { data, error } = await q.select('*');
      if (error) throw error;
      return { data };
    }

    case 'upload': {
      // Keep uploads inside public/wp-content/uploads: drop traversal and
      // leading separators, then double-check the resolved location.
      const rel = path.posix
        .normalize(op.path.replace(/\\/g, '/'))
        .split('/')
        .filter((seg) => seg && seg !== '.' && seg !== '..')
        .join('/');
      const uploadsRoot = path.resolve(root, UPLOADS_DIR);
      const target = path.resolve(uploadsRoot, rel);
      if (!rel || !target.startsWith(uploadsRoot + path.sep)) {
        throw Object.assign(new Error('invalid upload path'), {
          code: 'invalid_path',
        });
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(op.dataBase64, 'base64'));
      return { data: { url: `/wp-content/uploads/${rel}` } };
    }

    default:
      throw Object.assign(
        new Error(`Unknown op "${(op as { kind: string }).kind}"`),
        { code: 'unknown_op' }
      );
  }
}

const HOST_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Bolt CMS dev host</title>
<style>
  html,body{margin:0;height:100%;background:#111114;color:#fff;font:13px system-ui}
  header{display:flex;gap:12px;align-items:center;padding:8px 12px;border-bottom:1px solid #333}
  iframe{border:0;width:100%;height:calc(100% - 37px);background:#fff}
  code{color:#2ba6ff}
</style>
</head>
<body>
<header>
  <strong>Bolt CMS dev host</strong>
  <span>Framing <code>/admin</code>; proxying postMessage requests to <code>/__cms</code>.</span>
  <span id="count">0 requests</span>
</header>
<iframe id="admin" src="/admin"></iframe>
<script type="module">
  const frame = document.getElementById('admin');
  const count = document.getElementById('count');
  let n = 0;
  window.addEventListener('message', async (event) => {
    if (event.source !== frame.contentWindow) return;
    const msg = event.data;
    if (!msg || msg.source !== ${JSON.stringify('bolt-cms')}) return;
    n += 1; count.textContent = n + ' requests';
    const res = await fetch('/__cms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });
    const body = await res.json();
    frame.contentWindow.postMessage(body, window.location.origin);
  });
</script>
</body>
</html>`;

export function cmsDevServer(): Plugin {
  return {
    name: 'bolt-cms-dev-server',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const root = server.config.root;
      const env = loadEnv(server.config.mode, root, '');
      const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
      const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;
      const supabase = url && key ? createClient(url, key) : null;

      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];

        if (pathname === '/__host' && req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html');
          res.end(HOST_PAGE);
          return;
        }

        if (pathname !== '/__cms') {
          next();
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'method not allowed' });
          return;
        }

        let request: CmsRequest | undefined;
        try {
          request = JSON.parse(await readBody(req)) as CmsRequest;
        } catch {
          sendJson(res, 400, { error: 'invalid json' });
          return;
        }

        const id = request?.id ?? '';
        if (!supabase) {
          const body: CmsResponse = {
            source: CMS_HOST_SOURCE,
            id,
            ok: false,
            error: {
              code: 'no_supabase',
              message:
                'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env to use /admin outside of Bolt.',
            },
          };
          sendJson(res, 200, body);
          return;
        }

        try {
          const { data, count } = await executeOp(supabase, root, request.op);
          const body: CmsResponse = {
            source: CMS_HOST_SOURCE,
            id,
            ok: true,
            data,
            count,
          };
          sendJson(res, 200, body);
        } catch (error) {
          const e = error as {
            message?: string;
            code?: string;
            details?: unknown;
          };
          const body: CmsResponse = {
            source: CMS_HOST_SOURCE,
            id,
            ok: false,
            error: {
              message: e.message ?? 'Unknown error',
              code: e.code,
              details: e.details,
            },
          };
          sendJson(res, 200, body);
        }
      });
    },
  };
}
