/* The deck's database and the function in front of it.

   Everything the slides template persists goes through these two files, so they
   are tested against a real Postgres — pglite, the same engine compiled to
   WebAssembly — rather than a stand-in. The route handlers take a `Sql` instead
   of a driver for exactly this reason (supabase/functions/deck/sql.ts), so the
   code under test here is the code that gets deployed, with only the connection
   swapped.

   What that buys: the permission rules are checked where they are enforced.
   They cannot be checked in the browser, because the anon key ships inside
   every published deck — anyone the deck is shared with can call this function
   with whatever headers they like, so a rule that lives in the editor's UI is
   not a rule. */
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, expect, test } from 'vitest';
import schema from '../bolt-slides/supabase/schema.sql?raw';
import { handle } from '../bolt-slides/supabase/functions/deck/routes';
import type { Sql } from '../bolt-slides/supabase/functions/deck/sql';

/* Supabase provides these; pglite does not, and the schema's GRANTs would fail
   without them. `anon` matters most: it is the identity the published bundle's
   key resolves to. */
const ROLES = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role nologin noinherit bypassrls;
    end if;
  end $$;
`;

const DECK = {
  title: 'Quarterly review',
  transition: 'slide',
  slides: [
    { layout: 'cover', props: { title: 'One' }, notes: 'say hello' },
    { layout: 'statement', props: { title: 'Two' }, notes: 'the ask' },
    { layout: 'statement', props: { title: 'Three' }, status: 'review' },
  ],
};

interface Options {
  body?: unknown;
  headers?: Record<string, string>;
}

let db: PGlite;
let sql: Sql;
let owner: string;
/** A request to the deck function, as a browser would make it. */
let call: (
  method: string,
  route: string,
  options?: Options
) => Promise<Response>;
/** The same, holding the deck's own key: the dev server's editor. */
let asOwner: (
  method: string,
  route: string,
  body?: unknown
) => Promise<Response>;

const row = async <T>(text: string, params: unknown[] = []): Promise<T> =>
  (await db.query<T>(text, params)).rows[0];

beforeEach(async () => {
  db = new PGlite();
  await db.exec(ROLES);
  await db.exec(schema);

  sql = {
    query: async <T>(text: string, params: unknown[] = []) =>
      (await db.query<T>(text, params as never[])).rows as T[],
  };

  owner = (await row<{ owner_key: string }>('select owner_key from deck'))
    .owner_key;

  /* Shaped like a Request rather than being one, because `Origin` is a
     forbidden header name: a browser sets it itself and refuses to let script
     set it on a real Request — and Origin is how the function learns where the
     deck is published. The handlers use exactly these four members. */
  call = (method, route, { body, headers } = {}) =>
    handle(
      {
        method,
        url: 'https://project.functions.supabase.co/deck' + route,
        headers: new Headers({
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        }),
        text: async () => (body === undefined ? '' : JSON.stringify(body)),
      } as Request,
      sql
    );

  asOwner = (method, route, body) =>
    call(method, route, { body, headers: { 'x-deck-key': owner } });
});

/* ── the schema ──────────────────────────────────────────────────────────── */

/* The agent applies this file with `apply_migration`, a tool that can time out
   after the SQL has already committed — so the second attempt has to be
   harmless, or a slow first apply leaves the project unusable. */
test('the schema applies twice over, and there is exactly one deck', async () => {
  await db.exec(schema);

  expect(await row<{ n: number }>('select count(*)::int n from deck')).toEqual({
    n: 1,
  });

  // a deck is a singleton by construction, not by convention
  await expect(
    db.query('insert into deck (id) values (false)')
  ).rejects.toThrow();

  const { len } = await row<{ len: number }>(
    'select length(owner_key) len from deck'
  );
  expect(len).toBe(64);
});

/* Editing an existing deck means importing it again, changed. If that replaced
   every row, the editor's selection would jump on every agent edit and a
   slide's history would be thrown away because its wording moved — so a slide
   keeps its identity: by `id` when the incoming deck names one, and by position
   when it does not (a freshly authored deck names none). */
test('re-importing an edited deck keeps the slides it already had', async () => {
  await db.query('select import_deck($1::jsonb)', [JSON.stringify(DECK)]);
  const before = (
    await db.query<{ id: string }>('select id from slides order by position')
  ).rows.map((r) => r.id);
  expect(before).toHaveLength(3);

  const edited = structuredClone(DECK);
  edited.slides[1].props.title = 'Two, reworded';
  await db.query('select import_deck($1::jsonb)', [JSON.stringify(edited)]);

  const after = (
    await db.query<{ id: string; props: { title: string } }>(
      'select id, props from slides order by position'
    )
  ).rows;
  expect(after.map((r) => r.id)).toEqual(before);
  expect(after.map((r) => r.props.title)).toEqual([
    'One',
    'Two, reworded',
    'Three',
  ]);

  // and a shorter deck really is shorter
  await db.query('select import_deck($1::jsonb)', [
    JSON.stringify({ title: 'Short', slides: [DECK.slides[0]] }),
  ]);
  expect(await row('select count(*)::int n from slides')).toEqual({ n: 1 });
});

/* `export_deck` is how the agent reads a deck back before editing it, so the
   two functions have to agree on the format down to the last field: anything
   export emits that import drops is a change the user made and then lost. */
test('a deck survives the export/import round trip unchanged', async () => {
  await db.query('select import_deck($1::jsonb)', [JSON.stringify(DECK)]);

  const first = await row<{ d: unknown }>('select export_deck() d');
  await db.query('select import_deck($1::jsonb)', [JSON.stringify(first.d)]);
  const second = await row<{ d: unknown }>('select export_deck() d');

  expect(second.d).toEqual(first.d);
});

/* An open editor has no way to know the agent just authored a deck into the
   database — so it polls this number. If a write stops bumping it, the editor
   silently shows a deck that is no longer there. */
test('every write bumps the deck version, wherever it lands', async () => {
  const version = async () =>
    Number(
      (await row<{ version: string }>('select version from deck')).version
    );

  const start = await version();
  await db.query('select import_deck($1::jsonb)', [JSON.stringify(DECK)]);
  const afterImport = await version();
  await db.query("update slides set notes = 'changed' where position = 0");
  const afterSlide = await version();
  await db.query("update deck set title = 'Renamed' where id = true");
  const afterDeck = await version();

  expect(afterImport).toBeGreaterThan(start);
  expect(afterSlide).toBeGreaterThan(afterImport);
  expect(afterDeck).toBeGreaterThan(afterSlide);
});

/* The security model in one test.

   Supabase grants `anon` every privilege on the public schema, and the anon key
   is in the published bundle — so the only thing standing between a stranger
   holding a share link and the whole deck is row level security with no policy
   to satisfy. If a policy is ever added "to make something work", this fails,
   and it should: the fix belongs in the function. */
test('the anon key reaches nothing at all, holding every privilege', async () => {
  await db.query('select import_deck($1::jsonb)', [JSON.stringify(DECK)]);

  const guarded = [
    'deck',
    'slides',
    'shares',
    'share_grants',
    'unlock_attempts',
  ];
  const rls = await db.query<{ relname: string; relrowsecurity: boolean }>(
    `select relname, relrowsecurity from pg_class where relname = any($1)`,
    [guarded]
  );
  expect(rls.rows.filter((r) => !r.relrowsecurity)).toEqual([]);
  expect(rls.rows).toHaveLength(guarded.length);
  expect(await row('select count(*)::int n from pg_policies')).toEqual({
    n: 0,
  });

  await db.exec(`
    grant usage on schema public to anon;
    grant all on all tables in schema public to anon;
    grant all on all functions in schema public to anon;
  `);

  await db.exec('set role anon');
  const seen = await row<{ n: number }>('select count(*)::int n from slides');
  const exported = await row<{ d: { slides?: unknown[] } | null }>(
    'select export_deck() d'
  );
  /* Neither write raises: with no policy, a write matches no rows rather than
     failing, which is why the deck itself is what gets asserted on. */
  await db.query("update deck set title = 'defaced' where id = true");
  await db
    .query('select import_deck($1::jsonb)', [JSON.stringify({ slides: [] })])
    .catch(() => {});
  await db.exec('reset role');

  expect(seen.n).toBe(0);
  /* Null rather than an empty deck: with the row invisible there is nothing to
     build one from. Either way, nothing of the deck comes back. */
  expect(exported.d?.slides ?? []).toEqual([]);
  expect(await row('select title from deck')).toEqual({
    title: 'Quarterly review',
  });
  expect(await row('select count(*)::int n from slides')).toEqual({ n: 3 });
});

/* ── the function ────────────────────────────────────────────────────────── */

test('the owner reads and writes the whole deck', async () => {
  expect((await asOwner('POST', '/import', DECK)).status).toBe(200);

  const state = await (await asOwner('GET', '/state')).json();
  expect(state.deck.title).toBe('Quarterly review');
  expect(state.slides.map((s: { notes: string }) => s.notes)).toEqual([
    'say hello',
    'the ask',
    '',
  ]);
  /* What the visitor may do is the function's answer, not something the client
     infers from which headers it happens to be holding. */
  expect(state.access).toEqual({ mode: 'edit', canEdit: true, owner: true });
});

/* Publishing a deck makes it readable, because that is what publishing means.
   The speaker notes are the exception, and they are not hidden from the
   audience view — they are never sent to it. */
test('a public deck reads without credentials, and never its notes', async () => {
  await asOwner('POST', '/import', DECK);

  const state = await (await call('GET', '/state')).json();
  expect(state.access).toEqual({
    mode: 'present',
    canEdit: false,
    owner: false,
  });
  expect(state.slides.map((s: { notes: string }) => s.notes)).toEqual([
    '',
    '',
    '',
  ]);

  const exported = await (await call('GET', '/export')).json();
  expect(exported.slides.map((s: { notes?: string }) => s.notes ?? '')).toEqual(
    ['', '', '']
  );

  const refused = await call('PUT', '/meta', { body: { title: 'defaced' } });
  expect(refused.status).toBe(403);
  expect(await row('select title from deck')).toEqual({
    title: 'Quarterly review',
  });
});

test('a link-only deck shows a stranger nothing, and a fake token is nobody', async () => {
  await asOwner('POST', '/import', DECK);
  await asOwner('PUT', '/meta', { visibility: 'link' });

  const stranger = await call('GET', '/state');
  expect(stranger.status).toBe(401);
  expect((await stranger.json()).error).toBe('share-required');

  /* Not 200-as-the-public-deck: an invented token must not fall back to
     whatever a stranger would have been allowed. */
  const invented = await call('GET', '/state', {
    headers: { 'x-share-token': 'not-a-real-token' },
  });
  expect(invented.status).toBe(401);
});

test('only the owner may mint or list share links', async () => {
  expect((await call('GET', '/shares')).status).toBe(403);
  expect((await call('PUT', '/shares/edit', { body: {} })).status).toBe(403);
  expect((await asOwner('PUT', '/shares/nonsense', {})).status).toBe(400);

  const link = await (await asOwner('PUT', '/shares/present', {})).json();
  expect(link).toMatchObject({ mode: 'present', hasPassword: false });
  expect(link.token).toBeTruthy();

  // minting again returns the same link rather than quietly breaking the old one
  const again = await (await asOwner('PUT', '/shares/present', {})).json();
  expect(again.token).toBe(link.token);
});

/* The presenter console reads the notes and writes the notes — that is the
   whole difference between it and the audience view, and it is what makes it
   safe to hand to a co-presenter. */
test('a presenter link may write notes and nothing else', async () => {
  await asOwner('POST', '/import', DECK);
  const { token } = await (
    await asOwner('PUT', '/shares/presenter', {})
  ).json();
  const headers = { 'x-share-token': token };

  const state = await (await call('GET', '/state', { headers })).json();
  expect(state.slides[0].notes).toBe('say hello');
  const id = state.slides[0].id;

  expect(
    (
      await call('PUT', `/slides/${id}`, {
        headers,
        body: { notes: 'rewritten' },
      })
    ).status
  ).toBe(200);
  expect(
    (
      await call('PUT', `/slides/${id}`, {
        headers,
        body: { props: { title: 'hijacked' } },
      })
    ).status
  ).toBe(403);
  // and not by smuggling it alongside a legitimate field
  expect(
    (
      await call('PUT', `/slides/${id}`, {
        headers,
        body: { notes: 'fine', layout: 'quote' },
      })
    ).status
  ).toBe(403);

  const slide = await row<{ notes: string; props: { title: string } }>(
    'select notes, props from slides where id = $1',
    [id]
  );
  expect(slide).toEqual({ notes: 'rewritten', props: { title: 'One' } });
});

test('a password gates a link until it is answered, then remembers', async () => {
  await asOwner('POST', '/import', DECK);
  const { token } = await (
    await asOwner('PUT', '/shares/presenter', { password: 'correct horse' })
  ).json();
  const headers = { 'x-share-token': token };

  const gated = await call('GET', '/state', { headers });
  expect(gated.status).toBe(403);
  expect((await gated.json()).error).toBe('password-required');

  const wrong = await call('POST', '/share/unlock', {
    body: { token, password: 'battery staple' },
  });
  expect(wrong.status).toBe(403);

  const right = await call('POST', '/share/unlock', {
    body: { token, password: 'correct horse' },
  });
  expect(right.status).toBe(200);
  const { key } = await right.json();

  const inside = await call('GET', '/state', {
    headers: { ...headers, 'x-share-grant': key },
  });
  expect(inside.status).toBe(200);
  expect((await inside.json()).slides[0].notes).toBe('say hello');

  // a password too short to be one is refused before it is stored
  const weak = await asOwner('PUT', '/shares/present', { password: 'short' });
  expect(weak.status).toBe(400);
  expect((await weak.json()).error).toBe('weak-password');
});

/* Changing a password that locks nobody out is not a password change, and a
   rotated link whose old address still works has not been rotated. */
test('changing a password or rotating a link turns out whoever was inside', async () => {
  const first = await (
    await asOwner('PUT', '/shares/presenter', { password: 'correct horse' })
  ).json();
  const { key } = await (
    await call('POST', '/share/unlock', {
      body: { token: first.token, password: 'correct horse' },
    })
  ).json();

  await asOwner('PUT', '/shares/presenter', { password: 'a whole new one' });
  const held = await call('GET', '/state', {
    headers: { 'x-share-token': first.token, 'x-share-grant': key },
  });
  expect(held.status).toBe(403);

  const rotated = await (
    await asOwner('PUT', '/shares/presenter', { rotate: true })
  ).json();
  expect(rotated.token).not.toBe(first.token);
  expect(
    (await call('GET', '/state', { headers: { 'x-share-token': first.token } }))
      .status
  ).toBe(401);
});

/* A share password is short and guessable by design — someone has to be able
   to read it out. The iteration count makes one guess cost something; this
   makes a run of them hopeless. */
test('guessing a password gets throttled, even once it is right', async () => {
  const { token } = await (
    await asOwner('PUT', '/shares/present', { password: 'correct horse' })
  ).json();

  let last!: Response;
  for (let i = 0; i < 9; i++) {
    last = await call('POST', '/share/unlock', {
      body: { token, password: `guess ${i}` },
    });
  }

  expect(last.status).toBe(429);
  const { retryAfter } = await last.json();
  expect(retryAfter).toBeGreaterThan(0);
  expect(last.headers.get('Retry-After')).toBe(String(retryAfter));

  const correct = await call('POST', '/share/unlock', {
    body: { token, password: 'correct horse' },
  });
  expect(correct.status).toBe(429);
});

/* `position` is the index a slide sits at, not merely a number that sorts, so
   everything that can leave a gap renumbers. The editor reads the deck
   constantly; two slides claiming one position is a visible glitch. */
test('slides can be added, patched, duplicated, reordered and deleted', async () => {
  await asOwner('POST', '/import', DECK);

  const added = await (
    await asOwner('POST', '/slides', {
      layout: 'statement',
      props: { title: 'Inserted' },
      position: 1,
    })
  ).json();
  const titles = (state: { slides: { props: { title: string } }[] }) =>
    state.slides.map((s) => s.props.title);
  expect(titles(added)).toEqual(['One', 'Inserted', 'Two', 'Three']);
  expect(added.slides.map((s: { position: number }) => s.position)).toEqual([
    0, 1, 2, 3,
  ]);

  const id = added.slides[1].id;
  await asOwner('PUT', `/slides/${id}`, { props: { title: 'Renamed' } });
  const duplicated = await (
    await asOwner('POST', `/slides/${id}/duplicate`)
  ).json();
  expect(titles(duplicated)).toEqual([
    'One',
    'Renamed',
    'Renamed',
    'Two',
    'Three',
  ]);

  const ids = duplicated.slides.map((s: { id: string }) => s.id).reverse();
  await asOwner('PUT', '/order', { ids });
  const reordered = await (await asOwner('GET', '/state')).json();
  expect(reordered.slides.map((s: { id: string }) => s.id)).toEqual(ids);

  const deleted = await (await asOwner('DELETE', `/slides/${ids[0]}`)).json();
  expect(deleted.slides).toHaveLength(4);
  expect(deleted.slides.map((s: { position: number }) => s.position)).toEqual([
    0, 1, 2, 3,
  ]);

  expect(
    (await asOwner('PUT', '/slides/' + ids[0], { notes: 'x' })).status
  ).toBe(404);
});

/* Every share link is built on the published address, because the address the
   editor runs on opens for nobody else. The browser sets `Origin` and page
   scripts cannot forge it, so the published site tells us where it lives —
   custom domains included. */
test('the published deck records its own address, once, and never a preview', async () => {
  const origin = 'https://quarterly-review-ndww.bolthost.dev';
  const publishUrl = () =>
    row<{ publish_url: string | null }>('select publish_url from deck').then(
      (r) => r.publish_url
    );

  // sent with a path, which a browser never does, and stored without one anyway
  await call('GET', '/state', { headers: { origin: `${origin}/present` } });
  expect(await publishUrl()).toBe(origin);

  // a later caller cannot steal a deck's sharing address
  await call('GET', '/state', { headers: { origin: 'https://evil.example' } });
  expect(await publishUrl()).toBe(origin);

  await db.query('update deck set publish_url = null');
  for (const address of [
    'https://abc--5173--x.local-credentialless.webcontainer-api.io',
    'https://deck.preview.bolt.host',
    'http://localhost:5173',
  ]) {
    await call('GET', '/state', { headers: { origin: address } });
    expect(await publishUrl()).toBe(null);
  }

  // the owner can correct it, to a site and nothing else
  const saved = await (
    await asOwner('PUT', '/meta', {
      publish_url: 'https://slides.example.com/present?k=abc',
    })
  ).json();
  expect(saved.publish_url).toBe('https://slides.example.com');
  expect(
    (await asOwner('PUT', '/meta', { publish_url: 'example.com' })).status
  ).toBe(400);
  expect(await publishUrl()).toBe('https://slides.example.com');
});

/* A header the app sends but the preflight does not allow means the browser
   makes no request at all — which looks like the function being broken rather
   than a list being short. */
test('the preflight allows every header the app sends', async () => {
  const preflight = await call('OPTIONS', '/state');
  expect(preflight.status).toBe(204);

  const allowed = preflight.headers.get('Access-Control-Allow-Headers') ?? '';
  for (const header of [
    'authorization',
    'apikey',
    'content-type',
    'x-deck-key',
    'x-share-token',
    'x-share-grant',
  ]) {
    expect(allowed).toContain(header);
  }

  expect((await asOwner('GET', '/nonsense')).status).toBe(404);
});
