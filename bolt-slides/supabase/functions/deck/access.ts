/* Who is asking, and what they may do about it.

   Nothing in the browser decides this. The anon key that ships in a published
   deck lets anyone call this function, so every rule here is the rule — hiding a
   button in the editor hides nothing. Three ways in:

     owner key    the deck's own key, held by the dev server and nowhere else
     share link   a token minted for one mode, optionally behind a password
     neither      the published deck, read only, and only while it is public

   The modes a link can grant:

     edit       the editor — full write access
     presenter  the presenter console — read, plus writing speaker notes
     present    the audience view — read, and never the notes

   Speaker notes are the thing worth protecting: they are what the presenter
   says, not what the audience sees, so `present` never receives them in the
   first place rather than being trusted not to display them. */
import { one, type Sql } from './sql.ts';

export const MODES = ['edit', 'presenter', 'present'] as const;
export type Mode = (typeof MODES)[number];

export const MIN_PASSWORD = 8;
const GRANT_DAYS = 30; // an unlocked visitor is remembered this long
const TRIES = 8; // password attempts allowed per address…
const WINDOW_MINUTES = 10; // …and how long the window (and the lockout) lasts

/* PBKDF2 because Web Crypto has it and scrypt is not available here. The
   iteration count is the cost of one guess; the throttle above is what makes a
   run of guesses hopeless, and the two are meant to be read together. */
const PBKDF2 = { name: 'pbkdf2-sha256', iterations: 210_000, bytes: 32 };

export type Access =
  | { mode: Mode; owner: boolean }
  | { needsPassword: true; mode: Mode };

export const needsPassword = (
  a: Access | null
): a is {
  needsPassword: true;
  mode: Mode;
} => !!a && 'needsPassword' in a;

/* ── random values and comparing them ───────────────────────────────── */

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** URL-safe, because these end up in a link someone types or sends. */
export function randomToken(bytes = 12): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return b64(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* Comparison that takes the same time whether it fails on the first byte or the
   last, so a timing difference cannot be used to guess a key byte by byte. */
export function sameSecret(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

/* ── passwords ──────────────────────────────────────────────────────── */

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    PBKDF2.bytes * 8
  );
  return new Uint8Array(bits);
}

/** Stored self-describing, so the cost can be raised later without a migration. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2.iterations);
  return `${PBKDF2.name}$${PBKDF2.iterations}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null
): Promise<boolean> {
  if (!stored) return true; // no password set: everyone holding the link is in
  if (!password) return false;
  const [algorithm, iterations, salt, hash] = stored.split('$');
  if (algorithm !== PBKDF2.name) return false;
  const attempt = await derive(password, unb64(salt), Number(iterations));
  return sameSecret(b64(attempt), hash);
}

/* ── throttling guesses ─────────────────────────────────────────────── */

/** Seconds until this address may try again; 0 means it may try now. */
export async function throttledFor(sql: Sql, ip: string): Promise<number> {
  const row = await one<{ wait: number }>(
    sql,
    `SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (
       first_at + ($2 || ' minutes')::interval - now()
     ))))::int AS wait
     FROM unlock_attempts
     WHERE ip = $1 AND tries >= $3
       AND first_at > now() - ($2 || ' minutes')::interval`,
    [ip, WINDOW_MINUTES, TRIES]
  );
  return row?.wait ?? 0;
}

export async function noteAttempt(sql: Sql, ip: string, ok: boolean) {
  if (ok) {
    await sql.query('DELETE FROM unlock_attempts WHERE ip = $1', [ip]);
    return;
  }
  await sql.query(
    `INSERT INTO unlock_attempts (ip, tries, first_at) VALUES ($1, 1, now())
     ON CONFLICT (ip) DO UPDATE SET
       tries = CASE
         WHEN unlock_attempts.first_at < now() - ($2 || ' minutes')::interval
         THEN 1 ELSE unlock_attempts.tries + 1 END,
       first_at = CASE
         WHEN unlock_attempts.first_at < now() - ($2 || ' minutes')::interval
         THEN now() ELSE unlock_attempts.first_at END`,
    [ip, WINDOW_MINUTES]
  );
}

/* ── who is asking ──────────────────────────────────────────────────── */

export async function resolveAccess(
  sql: Sql,
  headers: Headers
): Promise<Access | null> {
  const ownerKey = headers.get('x-deck-key');
  const token = headers.get('x-share-token');

  /* A link means you get what the link gives, even holding the owner key: it is
     the only way to see what a visitor sees, and it makes a revoked link dead
     everywhere rather than dead for everyone except the owner. */
  if (token) {
    const share = await one<{ mode: Mode; password_hash: string | null }>(
      sql,
      'SELECT mode, password_hash FROM shares WHERE token = $1',
      [token]
    );
    if (!share) return null;
    if (share.password_hash) {
      const grant = headers.get('x-share-grant');
      const held = grant
        ? await one<{ mode: Mode }>(
            sql,
            `SELECT mode FROM share_grants
             WHERE key = $1 AND created_at > now() - ($2 || ' days')::interval`,
            [grant, GRANT_DAYS]
          )
        : null;
      if (held?.mode !== share.mode)
        return { needsPassword: true, mode: share.mode };
    }
    return { mode: share.mode, owner: false };
  }

  const deck = await one<{ owner_key: string; visibility: string }>(
    sql,
    'SELECT owner_key, visibility FROM deck WHERE id = true'
  );
  if (!deck) return null;

  if (ownerKey && sameSecret(ownerKey, deck.owner_key))
    return { mode: 'edit', owner: true };

  /* No credentials at all: the published deck, if the owner left it public. */
  return deck.visibility === 'public'
    ? { mode: 'present', owner: false }
    : null;
}

export type Action = 'read' | 'write' | 'patch-slide' | 'manage';

/** One capability check. `patch` is what lets a presenter write notes only. */
export function may(
  access: Access | null,
  action: Action,
  patch?: Record<string, unknown>
): boolean {
  if (!access || needsPassword(access)) return false;
  if (access.mode === 'edit') return true;
  if (action === 'read') return true;
  if (access.mode === 'presenter' && action === 'patch-slide') {
    const keys = Object.keys(patch ?? {});
    return keys.length > 0 && keys.every((k) => k === 'notes');
  }
  return false;
}
