/* Where the app gets its credentials, and what it does when they lead nowhere.

   A template starts with no database — Bolt provisions one when it is asked to
   — so "nothing to reach" is the state every slides project is in on its first
   load, and the app has to be honest about it rather than showing an empty
   editor that looks like a deck with no slides. The screens are NoDatabase.tsx
   and NoKey.tsx; what decides which one appears is here.

   The credentials themselves are the other half. In Bolt the database is
   provisioned, and the deck's owner key written into .env, while the dev server
   is already running — so in dev the app asks the dev server for them
   (vite.config.ts serves /__deck/env) rather than trusting what was inlined
   when the bundle was made, which by then can be from before either existed. */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const URL_VAR = 'VITE_SUPABASE_URL';
const KEY_VAR = 'VITE_SUPABASE_ANON_KEY';

const PROJECT = 'https://project.supabase.co';
const DECK_FN = `${PROJECT}/functions/v1/deck`;

/* Bolt writes placeholder credentials into .env at git init, pointing at this
   project reference, which does not exist. Anything that treats "the variable
   is set" as "there is a database" therefore spends the first load talking to
   nobody and calls the silence a network failure.
   (packages/claude-code-server/src/utils/dotenv.ts) */
const PLACEHOLDER = 'https://0ec90b57d6e95fcbda19832f.supabase.co';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/* These tests run in dev, as the editor does, so what the dev server answers
   with is what configures the app. Both answers are routed rather than queued:
   the app is free to ask either of them again, and a test that cared how often
   would be testing the caching rather than the behaviour. */
type DevEnv = { url: string; anonKey: string; ownerKey: string } | null;
let devEnv: DevEnv = null;
/** what the deck function does when reached */
let deck: () => Promise<Response> = async () => json({ ok: true });

const NO_ENV = { url: '', anonKey: '', ownerKey: '' };
const deckCalls = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url).startsWith(DECK_FN));

/* The module reads its configuration once per page, the way the app does — so
   each case needs its own evaluation of it. The query makes that a different
   module to the browser's loader, which is what re-runs it. */
let evaluation = 0;
const backend = async (
  dev: DevEnv,
  inlinedUrl = '',
  inlinedKey = inlinedUrl ? 'inlined-anon-key' : ''
) => {
  devEnv = dev;
  vi.stubEnv(URL_VAR, inlinedUrl);
  vi.stubEnv(KEY_VAR, inlinedKey);
  return import(
    /* @vite-ignore */ `../bolt-slides/src/data/backend.ts?case=${++evaluation}`
  );
};

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('__deck/env'))
      return devEnv ? json(devEnv) : new Response('not found', { status: 404 });
    if (url.startsWith(DECK_FN)) return deck();
    throw new Error(`unexpected request: ${url}`);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  devEnv = null;
  deck = async () => json({ ok: true });
});

test('with no credentials there is no database, and nothing is asked of it', async () => {
  const { hasDatabase, request, DeckError } = await backend(NO_ENV);
  await expect(hasDatabase()).resolves.toBe(false);

  const failed = await request('/state').catch((e: unknown) => e);
  expect(failed).toBeInstanceOf(DeckError);
  expect((failed as InstanceType<typeof DeckError>).failure).toBe(
    'no-database'
  );
  expect(deckCalls()).toHaveLength(0);
});

test("Bolt's placeholder credentials count as no database, not a broken one", async () => {
  const { request } = await backend({
    url: PLACEHOLDER,
    anonKey: 'anon-key',
    ownerKey: '',
  });

  const failed = await request('/state').catch((e: { failure: string }) => e);
  expect(failed.failure).toBe('no-database');
  expect(deckCalls()).toHaveLength(0);
});

/* The reason the credentials are read from the dev server rather than captured
   when it booted: in Bolt they are written while it is already running. The
   no-database screen retries on a timer, and this is what makes retrying worth
   anything — otherwise the project sits on a screen explaining a problem that
   has already been fixed. */
test('a database provisioned while the app is open is picked up', async () => {
  const { request } = await backend(NO_ENV);
  await expect(request('/state')).rejects.toMatchObject({
    failure: 'no-database',
  });

  devEnv = { url: PROJECT, anonKey: 'anon-key', ownerKey: 'owner-key' };

  await expect(request('/state')).resolves.toEqual({ ok: true });
  expect(deckCalls()).toHaveLength(1);
});

/* With real credentials the app must reach the deck function and nothing else:
   the tables are unreachable with the anon key by design (the schema enables
   row level security and defines no policies), so a request to Supabase's REST
   API would fail in a way no amount of client code could fix. */
test('the dev server supplies the credentials, including the owner key', async () => {
  const { hasDatabase, hasOwnerKey, request } = await backend(
    { url: PROJECT, anonKey: 'served-anon-key', ownerKey: 'owner-key' },
    /* what the bundle was built with — deliberately different, and ignored */
    'https://stale.supabase.co'
  );
  await expect(hasDatabase()).resolves.toBe(true);
  await expect(hasOwnerKey()).resolves.toBe(true);

  deck = async () => json({ deck: { title: 'Live' } });
  await expect(request('/state')).resolves.toEqual({ deck: { title: 'Live' } });

  const [url, options] = deckCalls()[0];
  expect(url).toBe(`${DECK_FN}/state`);
  const headers = options!.headers as Record<string, string>;
  expect(headers.apikey).toBe('served-anon-key');
  expect(headers.Authorization).toBe('Bearer served-anon-key');
  /* The header that decides whether this app may edit the deck at all. Its
     absence is what a published deck's requests look like — and what left the
     editor stuck in present mode when nothing wrote the key into .env. */
  expect(headers['x-deck-key']).toBe('owner-key');
});

/* No route to ask means something other than the dev server is serving the
   app: it runs on what it was built with, and holds no owner key. */
test('without the dev route the app runs on what was built into it', async () => {
  const { hasDatabase, hasOwnerKey, request } = await backend(null, PROJECT);
  await expect(hasDatabase()).resolves.toBe(true);
  await expect(hasOwnerKey()).resolves.toBe(false);

  await request('/state');

  const [url, options] = deckCalls()[0];
  expect(url).toBe(`${DECK_FN}/state`);
  const headers = options!.headers as Record<string, string>;
  expect(headers.apikey).toBe('inlined-anon-key');
  expect(headers).not.toHaveProperty('x-deck-key');
});

/* A function that was never deployed, or a project deleted from under the app,
   is the common case — far more common than being offline — and it is a
   different message from "you have no database yet". */
test('a database whose function does not answer is a different problem', async () => {
  const { request } = await backend({
    url: PROJECT,
    anonKey: 'anon-key',
    ownerKey: '',
  });

  deck = async () => {
    throw new TypeError('Failed to fetch');
  };
  await expect(request('/state')).rejects.toMatchObject({
    failure: 'unreachable',
  });

  // Supabase's own 404 for a function that is not there
  deck = async () => new Response('', { status: 404 });
  await expect(request('/state')).rejects.toMatchObject({
    failure: 'unreachable',
  });
});

/* Why a request was refused is what tells the app which screen to show: the
   gate for a visitor who needs a link or a password, read-only chrome for one
   whose link does not allow writing. */
test('a refusal keeps the reason the function gave', async () => {
  const { request } = await backend({
    url: PROJECT,
    anonKey: 'anon-key',
    ownerKey: '',
  });

  const refusals = [
    {
      status: 401,
      body: { error: 'share-required' },
      failure: 'share-required',
    },
    {
      status: 403,
      body: { error: 'password-required' },
      failure: 'password-required',
    },
    { status: 403, body: { error: 'read-only' }, failure: 'read-only' },
    { status: 500, body: { error: 'deck-unavailable' }, failure: 'error' },
  ];

  for (const { status, body, failure } of refusals) {
    deck = async () => json(body, status);
    await expect(request('/state')).rejects.toMatchObject({ failure });
  }
});
