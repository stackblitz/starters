/* What the app does when there is no deck to reach.

   A template starts with no database — Bolt provisions one when it is asked to
   — so this is the state every slides project is in on its first load, and the
   app has to be honest about it rather than showing an empty editor that looks
   like a deck with no slides. The screen itself is NoDatabase.tsx; what decides
   whether it appears is here. */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const URL_VAR = 'VITE_SUPABASE_URL';
const KEY_VAR = 'VITE_SUPABASE_ANON_KEY';

/* Bolt writes placeholder credentials into .env at git init, pointing at this
   project reference, which does not exist. Anything that treats "the variable
   is set" as "there is a database" therefore spends the first load talking to
   nobody and calls the silence a network failure.
   (packages/claude-code-server/src/utils/dotenv.ts) */
const PLACEHOLDER = 'https://0ec90b57d6e95fcbda19832f.supabase.co';

/* The module reads the environment once, at import, the way a bundle does — so
   each case needs its own evaluation of it. The query makes that a different
   module to the browser's loader, which is what re-runs it. */
let evaluation = 0;
const backend = async (url = '', key = url ? 'anon-key' : '') => {
  vi.stubEnv(URL_VAR, url);
  vi.stubEnv(KEY_VAR, key);
  return import(
    /* @vite-ignore */ `../bolt-slides/src/data/backend.ts?case=${++evaluation}`
  );
};

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test('with no credentials there is no database, and nothing is asked of the network', async () => {
  const { hasDatabase, request, DeckError } = await backend();
  expect(hasDatabase).toBe(false);

  const failed = await request('/state').catch((e: unknown) => e);
  expect(failed).toBeInstanceOf(DeckError);
  expect((failed as InstanceType<typeof DeckError>).failure).toBe(
    'no-database'
  );
  expect(fetch).not.toHaveBeenCalled();
});

test("Bolt's placeholder credentials count as no database, not a broken one", async () => {
  const { hasDatabase, request } = await backend(PLACEHOLDER);
  expect(hasDatabase).toBe(false);

  const failed = await request('/state').catch((e: { failure: string }) => e);
  expect(failed.failure).toBe('no-database');
  expect(fetch).not.toHaveBeenCalled();
});

/* With real credentials the app must reach the deck function and nothing else:
   the tables are unreachable with the anon key by design (the schema enables
   row level security and defines no policies), so a request to Supabase's REST
   API would fail in a way no amount of client code could fix. */
test('with real credentials, requests go to the deck function', async () => {
  const { hasDatabase, request } = await backend('https://project.supabase.co');
  expect(hasDatabase).toBe(true);

  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ deck: { title: 'Live' } }), { status: 200 })
  );

  await expect(request('/state')).resolves.toEqual({ deck: { title: 'Live' } });

  const [url, options] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe('https://project.supabase.co/functions/v1/deck/state');
  const headers = options!.headers as Record<string, string>;
  expect(headers.apikey).toBe('anon-key');
  expect(headers.Authorization).toBe('Bearer anon-key');
  /* No owner key here: this is what a published deck's requests look like, and
     it is the function that decides what they may do. */
  expect(headers).not.toHaveProperty('x-deck-key');
});

/* A function that was never deployed, or a project deleted from under the app,
   is the common case — far more common than being offline — and it is a
   different message from "you have no database yet". */
test('a database whose function does not answer is a different problem', async () => {
  const { request } = await backend('https://project.supabase.co');

  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(request('/state')).rejects.toMatchObject({
    failure: 'unreachable',
  });

  // Supabase's own 404 for a function that is not there
  vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));
  await expect(request('/state')).rejects.toMatchObject({
    failure: 'unreachable',
  });
});

/* Why a request was refused is what tells the app which screen to show: the
   gate for a visitor who needs a link or a password, read-only chrome for one
   whose link does not allow writing. */
test('a refusal keeps the reason the function gave', async () => {
  const { request } = await backend('https://project.supabase.co');

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
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status })
    );
    await expect(request('/state')).rejects.toMatchObject({ failure });
  }
});
