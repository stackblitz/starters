/* The deck API. Every read and write the app makes arrives here.

     GET    /state                  the whole deck: meta + slides
     GET    /version                a counter, bumped by any write anywhere
     PUT    /meta                   { title?, transition?, font?, accent?,
                                      visibility?, publish_url? }
     POST   /slides                 { layout, props?, position?, … } → state
     PUT    /slides/:id             partial slide patch
     POST   /slides/:id/duplicate   → state
     DELETE /slides/:id             → state
     PUT    /order                  { ids: [...] }
     GET    /export                 the portable deck JSON
     POST   /import                 portable deck JSON, replacing the deck
     GET    /shares                 every share link and its state
     PUT    /shares/:mode           { password?, rotate? } → the link
     DELETE /shares/:mode           stop sharing that mode
     GET    /share?token=…          { mode, hasPassword } — public, pre-unlock
     POST   /share/unlock           { token, password } → { key }

   Deliberately not `/deck`, because the function is called `deck` and Supabase
   routes it at /functions/v1/deck: a deck-meta route of the same name would make
   /deck/deck the way to rename a deck. It is `/meta`.

   These handlers take a Sql (see sql.ts) rather than a database client, so the
   test suite runs them against an in-process Postgres. Nothing here reads the
   environment or touches Deno; index.ts does that. */
import { one, type Sql } from './sql.ts';
import {
  may,
  needsPassword,
  noteAttempt,
  randomToken,
  resolveAccess,
  throttledFor,
  verifyPassword,
  hashPassword,
  MIN_PASSWORD,
  MODES,
  type Access,
  type Mode,
} from './access.ts';

/* Every header the app sends has to be listed, or the browser's preflight fails
   and no request is ever made — a class of bug that looks like the function
   being broken rather than the headers being unlisted. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-deck-key, x-share-token, x-share-grant',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const SLIDE_FIELDS = [
  'layout',
  'props',
  'background',
  'animation',
  'transition',
  'nav',
  'notes',
  'status',
] as const;

const SLIDE_COLUMNS = `id, position, layout, props, background, animation,
  transition, nav, notes, status`;

interface SlideRow {
  id: string;
  position: number;
  layout: string;
  props: unknown;
  background: unknown;
  animation: string;
  transition: string | null;
  nav: string | null;
  notes: string;
  status: string;
}

/* ── reading the deck ───────────────────────────────────────────────── */

async function readState(sql: Sql, access: { mode: Mode; owner: boolean }) {
  const { mode } = access;
  const deck = await one(
    sql,
    `SELECT title, transition, font, accent, visibility, publish_url, version
     FROM deck WHERE id = true`
  );
  const slides = await sql.query<SlideRow>(
    `SELECT ${SLIDE_COLUMNS} FROM slides ORDER BY position`
  );
  return {
    deck,
    /* What this visitor may do, decided here and reported rather than inferred
       by the client from which headers it happens to be holding. The editor
       renders read-only from this, and a stale owner key or a revoked link
       therefore shows the truth instead of an editor whose every save fails. */
    access: { mode, canEdit: mode === 'edit', owner: access.owner },
    /* The audience view does not receive the speaker notes. Not hidden in the
       UI, not blanked on the client — never sent. */
    slides:
      mode === 'present' ? slides.map((s) => ({ ...s, notes: '' })) : slides,
  };
}

/* Positions are renumbered after anything that can leave a gap, so `position`
   stays the index a slide is at rather than a number that merely sorts. */
const renumber = (sql: Sql) =>
  sql.query(
    `UPDATE slides s SET position = o.pos
     FROM (SELECT id, (row_number() OVER (ORDER BY position) - 1) AS pos
           FROM slides) o
     WHERE s.id = o.id AND s.position <> o.pos`
  );

/* ── where the deck is published ────────────────────────────────────── */

/* A published deck reports its own address. The browser sets `Origin` and page
   scripts cannot forge it, so the first load of the published site tells us
   where it lives — custom domains included, which no amount of guessing at
   Bolt's URL shapes would get right.

   Preview and localhost origins are skipped because those addresses open for
   nobody but the person looking at them, which is the whole reason share links
   need this in the first place. */
const PRIVATE_ORIGIN =
  /(^https?:\/\/localhost(:\d+)?$)|(^https?:\/\/127\.0\.0\.1(:\d+)?$)|(\.webcontainer-api\.io$)|(\.webcontainer\.io$)|(\.preview\.bolt\.host$)/;

async function notePublishOrigin(sql: Sql, origin: string | null) {
  if (!origin || PRIVATE_ORIGIN.test(origin)) return;
  let value: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    value = url.origin;
  } catch {
    return;
  }
  /* Only ever fills a blank. Whoever calls first could be someone else's page,
     and the cost of that is one wrong link the owner can correct — while
     overwriting on every request would let any passing site steal the deck's
     sharing address for good. */
  await sql.query(
    'UPDATE deck SET publish_url = $1 WHERE id = true AND publish_url IS NULL',
    [value]
  );
}

/* ── the router ─────────────────────────────────────────────────────── */

export async function handle(req: Request, sql: Sql): Promise<Response> {
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const seg = url.pathname.split('/').filter(Boolean);
  if (seg[0] === 'functions' && seg[1] === 'v1') seg.splice(0, 2);
  if (seg[0] === 'deck') seg.shift(); // the function's own name
  const method = req.method;

  const body = async (): Promise<Record<string, unknown>> => {
    const text = await req.text();
    return text ? JSON.parse(text) : {};
  };

  await notePublishOrigin(sql, req.headers.get('origin'));

  const access = await resolveAccess(sql, req.headers);
  const denied = () => {
    if (needsPassword(access))
      return json({ error: 'password-required', mode: access.mode }, 403);
    if (!access) return json({ error: 'share-required' }, 401);
    return json({ error: 'read-only', mode: access.mode }, 403);
  };

  /* ── links: unlocking is public, managing them is not ── */
  if (seg[0] === 'share') {
    if (method === 'GET' && seg.length === 1) {
      const token = url.searchParams.get('token') ?? '';
      const share = await one<{ mode: Mode; password_hash: string | null }>(
        sql,
        'SELECT mode, password_hash FROM shares WHERE token = $1',
        [token]
      );
      return share
        ? json({ mode: share.mode, hasPassword: !!share.password_hash })
        : json({ error: 'no such link' }, 404);
    }
    if (method === 'POST' && seg[1] === 'unlock') {
      /* Supabase terminates TLS ahead of this function, so the caller's address
         is a header rather than a socket. It can be spoofed, which caps what the
         throttle is worth: it slows a run of guesses from one address, and the
         iteration count is what makes each guess cost something regardless. */
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
      const wait = await throttledFor(sql, ip);
      if (wait)
        return new Response(
          JSON.stringify({ error: 'too-many-tries', retryAfter: wait }),
          {
            status: 429,
            headers: {
              ...CORS,
              'Content-Type': 'application/json',
              'Retry-After': String(wait),
            },
          }
        );
      const b = await body();
      const share = await one<{ mode: Mode; password_hash: string | null }>(
        sql,
        'SELECT mode, password_hash FROM shares WHERE token = $1',
        [String(b.token ?? '')]
      );
      const ok =
        !!share &&
        (await verifyPassword(String(b.password ?? ''), share.password_hash));
      await noteAttempt(sql, ip, ok);
      /* A wrong password and a dead link answer the same, so a guesser cannot
         use the reply to learn which links exist. */
      if (!ok || !share) return json({ error: 'denied' }, 403);
      const key = randomToken(18);
      await sql.query(`INSERT INTO share_grants (key, mode) VALUES ($1, $2)`, [
        key,
        share.mode,
      ]);
      await sql.query(
        `DELETE FROM share_grants WHERE created_at < now() - interval '30 days'`
      );
      return json({ key, mode: share.mode });
    }
  }

  if (seg[0] === 'shares') {
    if (!may(access, 'manage')) return denied();
    if (method === 'GET') {
      const rows = await sql.query(
        `SELECT mode, token, (password_hash IS NOT NULL) AS "hasPassword",
                created_at
         FROM shares ORDER BY mode`
      );
      return json(rows);
    }
    const mode = seg[1] as Mode;
    if (!MODES.includes(mode)) return json({ error: 'unknown mode' }, 400);
    if (method === 'PUT') {
      const b = await body();
      const password = b.password as string | null | undefined;
      if (
        typeof password === 'string' &&
        password !== '' &&
        password.length < MIN_PASSWORD
      )
        return json({ error: 'weak-password', min: MIN_PASSWORD }, 400);

      const existing = await one<{ token: string }>(
        sql,
        'SELECT token FROM shares WHERE mode = $1',
        [mode]
      );
      const token = existing && !b.rotate ? existing.token : randomToken();
      const hash =
        password === undefined
          ? undefined
          : password === null || password === ''
          ? null
          : await hashPassword(password);

      const row = await one(
        sql,
        `INSERT INTO shares (mode, token, password_hash)
         VALUES ($1, $2, $3::text)
         ON CONFLICT (mode) DO UPDATE SET
           token = EXCLUDED.token,
           password_hash = CASE WHEN $4::boolean THEN EXCLUDED.password_hash
                                ELSE shares.password_hash END
         RETURNING mode, token, (password_hash IS NOT NULL) AS "hasPassword",
                   created_at`,
        [mode, token, hash ?? null, hash !== undefined]
      );
      /* Changing the password, or rotating the link, turns out everyone who was
         already inside — otherwise "change the password" would not lock anyone
         out, which is the only reason to change it. */
      if (b.rotate || password !== undefined)
        await sql.query('DELETE FROM share_grants WHERE mode = $1', [mode]);
      return json(row);
    }
    if (method === 'DELETE') {
      await sql.query('DELETE FROM shares WHERE mode = $1', [mode]);
      return json({ ok: true });
    }
  }

  /* ── everything else needs at least read access ── */
  if (!may(access, 'read')) return denied();
  const viewer = access as { mode: Mode; owner: boolean };
  const mode = viewer.mode;

  if (method === 'GET' && seg[0] === 'state')
    return json(await readState(sql, viewer));

  if (method === 'GET' && seg[0] === 'version') {
    const row = await one<{ version: string }>(
      sql,
      'SELECT version FROM deck WHERE id = true'
    );
    return json({ version: Number(row?.version ?? 0) });
  }

  if (method === 'PUT' && seg[0] === 'meta') {
    if (!may(access, 'write')) return denied();
    const b = await body();
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const key of ['title', 'transition', 'font', 'accent', 'visibility']) {
      if (b[key] === undefined) continue;
      params.push(b[key]);
      sets.push(`${key} = $${params.length}`);
    }
    if (b.publish_url !== undefined) {
      /* Stored as an origin: the deck appends its own paths, and a stray path
         here would produce links like /present/present. */
      let value: string | null = null;
      if (b.publish_url !== null) {
        try {
          const parsed = new URL(String(b.publish_url));
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
            throw new Error('not a site');
          value = parsed.origin;
        } catch {
          return json({ error: 'publish_url must be a site URL' }, 400);
        }
      }
      params.push(value);
      sets.push(`publish_url = $${params.length}`);
    }
    if (!sets.length) return json({ error: 'nothing to change' }, 400);
    const row = await one(
      sql,
      `UPDATE deck SET ${sets.join(', ')} WHERE id = true
       RETURNING title, transition, font, accent, visibility, publish_url`,
      params
    );
    return json(row);
  }

  if (seg[0] === 'slides') {
    if (method === 'POST' && seg.length === 1) {
      if (!may(access, 'write')) return denied();
      const b = await body();
      const count = await one<{ n: number }>(
        sql,
        'SELECT count(*)::int AS n FROM slides'
      );
      const position = Math.max(
        0,
        Math.min(Number(b.position ?? count?.n ?? 0), count?.n ?? 0)
      );
      /* Making room and inserting in one statement: two would leave a moment
         where two slides claim the same position, and the editor reads the deck
         constantly. */
      await sql.query(
        `WITH shifted AS (
           UPDATE slides SET position = position + 1 WHERE position >= $1
           RETURNING 1
         )
         INSERT INTO slides (position, layout, props, background, animation,
                             transition, nav, notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          position,
          b.layout ?? 'statement',
          JSON.stringify(b.props ?? {}),
          JSON.stringify(b.background ?? { type: 'none' }),
          b.animation ?? 'cascade',
          b.transition ?? null,
          b.nav ?? null,
          b.notes ?? '',
          b.status ?? 'none',
        ]
      );
      return json(await readState(sql, viewer), 201);
    }

    const id = seg[1];
    if (method === 'PUT' && seg.length === 2) {
      const b = await body();
      if (!may(access, 'patch-slide', b)) return denied();
      const sets: string[] = [];
      const params: unknown[] = [id];
      for (const field of SLIDE_FIELDS) {
        if (b[field] === undefined) continue;
        const value =
          field === 'props' || field === 'background'
            ? JSON.stringify(b[field])
            : b[field];
        params.push(value);
        sets.push(`${field} = $${params.length}`);
      }
      if (!sets.length) return json({ error: 'nothing to change' }, 400);
      const row = await one<{ id: string }>(
        sql,
        `UPDATE slides SET ${sets.join(', ')}, updated_at = now()
         WHERE id = $1 RETURNING id`,
        params
      );
      return row ? json({ ok: true }) : json({ error: 'not found' }, 404);
    }

    if (method === 'POST' && seg[2] === 'duplicate') {
      if (!may(access, 'write')) return denied();
      const copied = await one<{ id: string }>(
        sql,
        `WITH src AS (SELECT * FROM slides WHERE id = $1),
              shifted AS (
                UPDATE slides SET position = position + 1
                WHERE position > (SELECT position FROM src) RETURNING 1
              )
         INSERT INTO slides (position, layout, props, background, animation,
                             transition, nav, notes, status)
         SELECT position + 1, layout, props, background, animation, transition,
                nav, notes, 'none'
         FROM src
         RETURNING id`,
        [id]
      );
      return copied
        ? json(await readState(sql, viewer), 201)
        : json({ error: 'not found' }, 404);
    }

    if (method === 'DELETE' && seg.length === 2) {
      if (!may(access, 'write')) return denied();
      await sql.query('DELETE FROM slides WHERE id = $1', [id]);
      await renumber(sql);
      return json(await readState(sql, viewer));
    }
  }

  if (method === 'PUT' && seg[0] === 'order') {
    if (!may(access, 'write')) return denied();
    const b = await body();
    const ids = (b.ids ?? []) as string[];
    await sql.query(
      `UPDATE slides s SET position = o.pos - 1
       FROM (SELECT id, ordinality AS pos
             FROM unnest($1::uuid[]) WITH ORDINALITY AS t(id, ordinality)) o
       WHERE s.id = o.id`,
      [ids]
    );
    await renumber(sql);
    return json({ ok: true });
  }

  if (method === 'GET' && seg[0] === 'export') {
    const row = await one<{ deck: { slides?: { notes?: string }[] } }>(
      sql,
      'SELECT export_deck() AS deck'
    );
    const deck = row?.deck ?? {};
    if (mode === 'present' && deck.slides)
      deck.slides = deck.slides.map((s) => ({ ...s, notes: '' }));
    return json(deck);
  }

  if (method === 'POST' && seg[0] === 'import') {
    if (!may(access, 'write')) return denied();
    await sql.query('SELECT import_deck($1::jsonb)', [
      JSON.stringify(await body()),
    ]);
    return json(await readState(sql, viewer));
  }

  return json({ error: 'no such route' }, 404);
}
