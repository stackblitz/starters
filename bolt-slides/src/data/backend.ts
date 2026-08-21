/* The deck lives in Postgres, reached through one Edge Function.

   There is no local copy and no fallback. That is the point: an app that can
   fall back to a file has two answers to "what is in this deck", and every one
   of them is wrong somewhere. If the database is not reachable the app says so
   (see NoDatabase.tsx) rather than showing something it made up.

   Three credentials can ride along, and which one you hold is what you are:

     anon key      identifies the project. Required, and worth nothing alone —
                   the schema gives it no access to any table
     owner key     the deck's own key. Handed to the app by the dev server and
                   defined out of production builds (vite.config.ts), so a
                   published deck cannot be edited by whoever opens it
     share token   a link someone was sent, plus a grant if it had a password

   The function decides what each of those may do (supabase/functions/deck). */
import { shareHeaders } from './share';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const OWNER_KEY = import.meta.env.DECK_OWNER_KEY ?? '';

/* Bolt writes placeholder credentials into .env before a project has a database,
   pointing at a project reference that does not exist, so "configured" has to
   mean more than "the variable is set" — otherwise the app spends its first load
   talking to a project nobody owns and reports it as a network failure.
   (packages/claude-code-server/src/utils/dotenv.ts) */
const PLACEHOLDER_PROJECT = '0ec90b57d6e95fcbda19832f';

export const hasDatabase =
  !!SUPABASE_URL && !!ANON_KEY && !SUPABASE_URL.includes(PLACEHOLDER_PROJECT);

/** True in the editor the dev server serves, false in a published build. */
export const hasOwnerKey = !!OWNER_KEY;

const DECK_API = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/deck`;

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
  if (!hasDatabase)
    throw new DeckError('no-database', 'this project has no database');

  let res: Response;
  try {
    res = await fetch(DECK_API + path, {
      method,
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
        ...(OWNER_KEY ? { 'x-deck-key': OWNER_KEY } : {}),
        ...shareHeaders(),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    /* Not "offline": the far more common cause is a function that was never
       deployed, or a project that has been deleted from under the app. */
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
  if (res.status === 404 && !why.error)
    throw new DeckError('unreachable', 'the deck function is not deployed');

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
  let res: Response;
  try {
    res = await fetch(`${DECK_API}/share/unlock`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
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
