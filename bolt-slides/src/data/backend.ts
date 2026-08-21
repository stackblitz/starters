/* The deck lives in Postgres, reached through one Edge Function.

   There is no local copy and no fallback. That is the point: an app that can
   fall back to a file has two answers to "what is in this deck", and every one
   of them is wrong somewhere. If the database is not reachable the app says so
   (see NoDatabase.tsx) rather than showing something it made up.

   Three credentials can ride along, and which one you hold is what you are:

     anon key      identifies the project. Required, and worth nothing alone —
                   the schema gives it no access to any table
     owner key     the deck's own key. Handed to the app by the dev server and
                   absent from production builds (vite.config.ts), so a
                   published deck cannot be edited by whoever opens it
     share token   a link someone was sent, plus a grant if it had a password

   The function decides what each of those may do (supabase/functions/deck). */
import { shareHeaders } from './share';

export interface DeckConfig {
  url: string;
  anonKey: string;
  /** the deck's own key — dev only, and empty in every published build */
  ownerKey: string;
}

/* Where the credentials come from depends on who is serving the app.

   A published build has them inlined at build time, which is right: they were
   known when it was built and cannot change afterwards. The dev server is the
   opposite case — in Bolt the database arrives, and the owner key is written,
   while it is already running — so it answers for them per request and this
   asks (vite.config.ts). Both answers are one page load away from current. */
const inlined = (): DeckConfig => ({
  url: import.meta.env.VITE_SUPABASE_URL ?? '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  ownerKey: '',
});

let pending: Promise<DeckConfig> | null = null;

async function read(): Promise<DeckConfig> {
  /* A literal `false` in a build, which takes the rest of this function — the
     route, the owner key it would carry — out of the bundle with it. */
  if (!import.meta.env.DEV) return inlined();
  try {
    const res = await fetch('/__deck/env');
    if (!res.ok) return inlined();
    const env = (await res.json()) as Partial<DeckConfig>;
    return {
      url: env.url ?? '',
      anonKey: env.anonKey ?? '',
      ownerKey: env.ownerKey ?? '',
    };
  } catch {
    /* No route means a build being previewed, or a dev server that has gone
       away. The inlined values are the honest answer either way. */
    return inlined();
  }
}

/** The credentials this page is working with. Read once, then remembered. */
export const config = (): Promise<DeckConfig> => (pending ??= read());

/** Ask again on the next call — the answer may have been set up since. */
export const forget = () => {
  pending = null;
};

/* Bolt writes placeholder credentials into .env before a project has a database,
   pointing at a project reference that does not exist, so "configured" has to
   mean more than "the variable is set" — otherwise the app spends its first load
   talking to a project nobody owns and reports it as a network failure.
   (packages/claude-code-server/src/utils/dotenv.ts) */
const PLACEHOLDER_PROJECT = '0ec90b57d6e95fcbda19832f';

export const configured = (c: DeckConfig) =>
  !!c.url && !!c.anonKey && !c.url.includes(PLACEHOLDER_PROJECT);

/** Whether there is a database to talk to at all. */
export const hasDatabase = async () => configured(await config());

/** True in the editor the dev server serves, false in a published build. */
export const hasOwnerKey = async () => !!(await config()).ownerKey;

const deckApi = (c: DeckConfig) =>
  `${c.url.replace(/\/$/, '')}/functions/v1/deck`;

export type Failure =
  /** no database yet, or credentials that point at nothing */
  | 'no-database'
  /** there is a database, but this request did not arrive or did not answer */
  | 'unreachable'
  /** this visitor holds no valid link */
  | 'share-required'
  /** the link is real but locked */
  | 'password-required'
  /** the link is real and does not allow this */
  | 'read-only'
  /** the deck answered, unhappily */
  | 'error';

export class DeckError extends Error {
  constructor(readonly failure: Failure, message: string) {
    super(message);
    this.name = 'DeckError';
  }
}

export async function request<T = unknown>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const cfg = await config();
  /* Both of these are the kind of failure that gets fixed while the app is
     open — a database being created, a function being deployed — so drop the
     remembered credentials on the way out and let the next attempt look again.
     That is what lets a waiting screen turn into the deck on its own. */
  if (!configured(cfg)) {
    forget();
    throw new DeckError('no-database', 'this project has no database');
  }

  let res: Response;
  try {
    res = await fetch(deckApi(cfg) + path, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.anonKey}`,
        apikey: cfg.anonKey,
        ...(cfg.ownerKey ? { 'x-deck-key': cfg.ownerKey } : {}),
        ...shareHeaders(),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    /* Not "offline": the far more common cause is a function that was never
       deployed, or a project that has been deleted from under the app. */
    forget();
    throw new DeckError('unreachable', `${method} ${path} did not arrive`);
  }

  if (res.ok) return res.json() as Promise<T>;

  const why = await res.json().catch(() => ({} as { error?: string }));
  if (res.status === 401 || res.status === 403) {
    const failure =
      why.error === 'password-required'
        ? 'password-required'
        : why.error === 'read-only'
        ? 'read-only'
        : 'share-required';
    throw new DeckError(failure, `${method} ${path} → ${res.status}`);
  }
  /* A 404 from the deck's own router is a bug; a 404 from Supabase means the
     function is not deployed, which is the same problem as unreachable and has
     the same fix. */
  if (res.status === 404 && !why.error) {
    forget();
    throw new DeckError('unreachable', 'the deck function is not deployed');
  }

  throw new DeckError('error', `${method} ${path} → ${res.status}`);
}

/** The unlock exchange, which runs before the app has any access at all. */
export async function unlock(
  token: string,
  password: string
): Promise<
  | { ok: true; key: string }
  | { ok: false; reason: 'denied' }
  | { ok: false; reason: 'throttled'; retryAfter: number }
  | { ok: false; reason: 'offline' }
> {
  const cfg = await config();
  let res: Response;
  try {
    res = await fetch(`${deckApi(cfg)}/share/unlock`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.anonKey}`,
        apikey: cfg.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password }),
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const header = Number(res.headers.get('Retry-After'));
    return {
      ok: false,
      reason: 'throttled',
      retryAfter: body.retryAfter ?? (Number.isFinite(header) ? header : 600),
    };
  }
  if (!res.ok) return { ok: false, reason: 'denied' };
  const { key } = await res.json();
  return { ok: true, key };
}
