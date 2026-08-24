/**
 * deck-api — REST contract the editor, presenter, and share links speak.
 * Agents write `deck` / `slides` rows in Postgres, not through this function.
 *
 * Routes (each prefixed /deck-api by the gateway):
 *   GET    /health      (no deck data — deploy probe)
 *   GET    /state
 *   PUT    /deck
 *   POST   /slides
 *   PUT    /slides/:id
 *   POST   /slides/:id/duplicate
 *   DELETE /slides/:id
 *   PUT    /order
 *   GET    /export      POST /import
 *   POST   /og
 *   GET|PUT|DELETE /shares[/:mode]
 *   GET    /share?token=…
 *   POST   /share/unlock
 *
 * Owner, in order: share token (that token's mode, even from the owner
 * browser) → Authorization or apikey equals SUPABASE_SERVICE_ROLE_KEY →
 * X-Deck-Owner matches DECK_OWNER_SECRET (Bolt injects a preview owner
 * token into the iframe and, when `.bolt/config.json` names this secret,
 * copies it to the function env; it is not in the workspace .env or the
 * published JS) → deny. If the function secret is unset, no-token is still
 * owner (local Vite / legacy). The functions gateway requires a real JWT;
 * an empty Bearer is rejected before this function runs.
 * Tables have RLS and no policies; the function uses the service role.
 */
import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Share-Token, X-Share-Grant, X-Deck-Owner',
};

const MODES = ['edit', 'presenter', 'present'] as const;
type ShareMode = (typeof MODES)[number];
const MIN_PASSWORD = 8;
const GRANT_DAYS = 30;
const TRIES = 8;
const WINDOW_MS = 10 * 60_000;
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

type Acc =
  | { mode: ShareMode; owner: boolean; needsPassword?: false }
  | { mode: ShareMode; owner: false; needsPassword: true }
  | null;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const seg = pathSegments(url.pathname);
    const m = req.method;

    if (m === 'GET' && seg[0] === 'health') {
      return json(200, { ok: true });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const acc = await access(req, supabase);

    if (seg[0] === 'share') {
      if (m === 'GET' && seg.length === 1) {
        const info = await shareInfo(supabase, url.searchParams.get('token'));
        return info ? json(200, info) : json(404, { error: 'no such link' });
      }
      if (m === 'POST' && seg[1] === 'unlock') {
        const ip = clientIp(req);
        const wait = await throttledFor(supabase, ip);
        if (wait) {
          return json(
            429,
            { error: 'too-many-tries', retryAfter: wait },
            { 'Retry-After': String(wait) }
          );
        }
        const b = await readBody(req);
        const granted = await unlock(supabase, b.token, b.password, ip);
        return granted ? json(200, granted) : json(403, { error: 'denied' });
      }
    }

    if (seg[0] === 'shares') {
      if (!acc?.owner) return json(403, { error: 'owner-only' });
      if (m === 'GET') return json(200, await listShares(supabase));
      const mode = seg[1] as ShareMode;
      if (!MODES.includes(mode)) return json(400, { error: 'unknown mode' });
      if (m === 'PUT') {
        const saved = await saveShare(supabase, mode, await readBody(req));
        if (saved && 'error' in saved && saved.error === 'weak') {
          return json(400, { error: 'weak-password', min: MIN_PASSWORD });
        }
        return json(200, saved);
      }
      if (m === 'DELETE') {
        await removeShare(supabase, mode);
        return json(200, { ok: true });
      }
    }

    if (!may(acc, 'read')) return deny(acc);
    const writable = (action: string, patch?: Record<string, unknown>) =>
      may(acc, action, patch);

    if (m === 'GET' && seg[0] === 'state') {
      return json(200, visible(await getState(supabase), acc!));
    }
    if (m === 'PUT' && seg[0] === 'deck') {
      if (!writable('write')) return deny(acc);
      const b = await readBody(req);
      const patch: Record<string, unknown> = { updated_at: now() };
      for (const k of ['title', 'transition', 'font', 'accent']) {
        if (b[k] !== undefined) patch[k] = b[k];
      }
      await ensureDeck(supabase);
      const { data, error } = await supabase
        .from('deck')
        .update(patch)
        .eq('id', 1)
        .select()
        .single();
      if (error) throw error;
      return written(200, {
        title: data.title,
        transition: data.transition,
        font: data.font,
        accent: data.accent,
      });
    }

    if (seg[0] === 'slides') {
      if (m === 'POST' && seg.length === 1) {
        if (!writable('write')) return deny(acc);
        const b = await readBody(req);
        const slides = await loadSlides(supabase);
        const count = slides.length;
        const pos = Math.max(0, Math.min(b.position ?? count, count));
        await shiftFrom(supabase, slides, pos);
        await supabase.from('slides').insert(
          blankSlide({
            position: pos,
            layout: b.layout ?? 'statement',
            props: b.props ?? {},
            background: b.background ?? { type: 'none' },
            animation: b.animation ?? 'cascade',
            transition: b.transition ?? null,
            nav: b.nav ?? null,
            notes: b.notes ?? '',
            status: b.status ?? 'none',
          })
        );
        return written(201, visible(await getState(supabase), acc!));
      }
      const id = seg[1];
      if (m === 'PUT' && seg.length === 2) {
        const b = await readBody(req);
        if (!writable('patch-slide', b)) return deny(acc);
        const { data: slide } = await supabase
          .from('slides')
          .select('id')
          .eq('id', id)
          .maybeSingle();
        if (!slide) return json(404, { error: 'not found' });
        const patch: Record<string, unknown> = { updated_at: now() };
        for (const k of SLIDE_FIELDS) {
          if (b[k] !== undefined) patch[k] = b[k];
        }
        const { error } = await supabase
          .from('slides')
          .update(patch)
          .eq('id', id);
        if (error) throw error;
        return written(200, { ok: true });
      }
      if (m === 'POST' && seg[2] === 'duplicate') {
        if (!writable('write')) return deny(acc);
        const { data: src } = await supabase
          .from('slides')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (!src) return json(404, { error: 'not found' });
        const slides = await loadSlides(supabase);
        await shiftFrom(supabase, slides, src.position + 1);
        const copy = { ...src };
        delete copy.id;
        await supabase.from('slides').insert(
          blankSlide({
            ...copy,
            position: src.position + 1,
            status: 'none',
          })
        );
        return written(201, visible(await getState(supabase), acc!));
      }
      if (m === 'DELETE' && seg.length === 2) {
        if (!writable('write')) return deny(acc);
        await supabase.from('slides').delete().eq('id', id);
        await renumber(supabase);
        return written(200, visible(await getState(supabase), acc!));
      }
    }

    if (m === 'PUT' && seg[0] === 'order') {
      if (!writable('write')) return deny(acc);
      const b = await readBody(req);
      const ids: string[] = b.ids ?? [];
      for (let i = 0; i < ids.length; i++) {
        await supabase.from('slides').update({ position: i }).eq('id', ids[i]);
      }
      return written(200, { ok: true });
    }

    if (m === 'GET' && seg[0] === 'export') {
      const deck = await exportDeck(supabase);
      return json(200, acc!.mode === 'edit' ? deck : visibleDeck(deck));
    }
    if (m === 'POST' && seg[0] === 'import') {
      if (!writable('write')) return deny(acc);
      await importDeck(supabase, await readBody(req));
      return written(200, visible(await getState(supabase), acc!));
    }

    if (m === 'POST' && seg[0] === 'og') {
      if (!writable('write')) return deny(acc);
      return json(200, { ok: true });
    }

    return json(404, { error: 'no such route' });
  } catch {
    return json(500, { error: 'internal' });
  }
});

const DECK_CHANNEL = 'deck';
const DECK_EVENT = 'change';

/** Tell every open editor/presenter to re-fetch. Broadcast does not read
 *  tables, so it works with RLS-on / no policies. */
function notifyDeckChanged() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return Promise.resolve();
  return fetch(`${url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          topic: DECK_CHANNEL,
          event: DECK_EVENT,
          private: false,
          payload: { at: Date.now() },
        },
      ],
    }),
  }).catch(() => {
    /* a missed ping falls back to focus/visibility refetch */
  });
}

function json(
  status: number,
  body: unknown,
  extra: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extra,
    },
  });
}

function written(
  status: number,
  body: unknown,
  extra: Record<string, string> = {}
): Response {
  const res = json(status, body, extra);
  const ping = notifyDeckChanged();
  const waitUntil = (
    globalThis as {
      EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void };
    }
  ).EdgeRuntime?.waitUntil;
  if (waitUntil) waitUntil(ping);
  return res;
}

function deny(acc: Acc): Response {
  if (acc?.needsPassword) {
    return json(403, { error: 'password-required', mode: acc.mode });
  }
  if (!acc) return json(401, { error: 'share-required' });
  return json(403, { error: 'read-only', mode: acc.mode });
}

function pathSegments(pathname: string): string[] {
  const stripped = pathname
    .replace(/^\/functions\/v1\/deck-api/, '')
    .replace(/^\/deck-api/, '');
  return stripped.split('/').filter(Boolean);
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID().slice(0, 8);

function token(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function clientIp(req: Request): string {
  // prefer platform-provided client IPs. x-forwarded-for's first hop is
  // client-controlled; the last hop is what the trusted proxy appended.
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const hops = fwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return 'unknown';
}

function may(
  acc: Acc,
  action: string,
  patch?: Record<string, unknown>
): boolean {
  if (!acc || acc.needsPassword) return false;
  if (acc.mode === 'edit') return true;
  if (action === 'read') return true;
  if (acc.mode === 'presenter' && action === 'patch-slide') {
    const keys = Object.keys(patch ?? {});
    return keys.length > 0 && keys.every((k) => k === 'notes');
  }
  return false;
}

async function access(req: Request, supabase: SupabaseClient): Promise<Acc> {
  const t = req.headers.get('x-share-token');
  if (t) {
    const { data: share } = await supabase
      .from('shares')
      .select('*')
      .eq('token', t)
      .maybeSingle();
    if (!share) return null;
    if (share.pass_hash) {
      const key = req.headers.get('x-share-grant');
      const { data: grant } = key
        ? await supabase
            .from('share_grants')
            .select('*')
            .eq('key', key)
            .maybeSingle()
        : { data: null };
      const fresh =
        grant &&
        Date.now() - Date.parse(grant.created_at) < GRANT_DAYS * 86_400_000;
      if (!grant || !fresh || grant.mode !== share.mode) {
        return { needsPassword: true, mode: share.mode, owner: false };
      }
    }
    return { mode: share.mode as ShareMode, owner: false };
  }
  if (isServiceRoleRequest(req)) return { mode: 'edit', owner: true };
  const secret = Deno.env.get('DECK_OWNER_SECRET');
  const proof = req.headers.get('x-deck-owner');
  if (secret && proof && proof === secret) return { mode: 'edit', owner: true };
  if (!secret) {
    /* not on Bolt yet (local Vite) — keep "bare URL is owner" */
    return { mode: 'edit', owner: true };
  }
  return null;
}

/** Service role may arrive on Authorization or apikey. Match the function
 *  env key only — do not decode JWT claims (that invites forged tokens).
 *  Empty Bearer never reaches here; Kong rejects it. */
function isServiceRoleRequest(req: Request): boolean {
  const expected = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
  if (!expected) return false;
  return (
    isServiceRoleToken(req.headers.get('authorization') ?? '', expected) ||
    isServiceRoleToken(req.headers.get('apikey') ?? '', expected)
  );
}

function isServiceRoleToken(raw: string, expected: string): boolean {
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  return !!token && timingSafeEqual(token, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function visible(
  state: {
    deck: unknown;
    slides: Array<Record<string, unknown>>;
  },
  acc: { mode: ShareMode }
) {
  if (acc.mode !== 'present') return state;
  return {
    ...state,
    slides: state.slides.map(({ notes: _notes, ...rest }) => ({
      ...rest,
      notes: '',
    })),
  };
}

function visibleDeck(deck: {
  title: unknown;
  transition: unknown;
  font: unknown;
  accent: unknown;
  slides: Array<Record<string, unknown>>;
}) {
  return {
    ...deck,
    slides: deck.slides.map(({ notes: _notes, ...rest }) => ({
      ...rest,
      notes: '',
    })),
  };
}

async function ensureDeck(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('deck')
    .select('id')
    .eq('id', 1)
    .maybeSingle();
  if (!data) {
    const { error } = await supabase.from('deck').insert({
      id: 1,
      title: 'Untitled deck',
      transition: 'fade',
      font: 'inter',
    });
    if (error && !String(error.message).includes('duplicate')) throw error;
  }
}

async function loadSlides(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('slides')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function getState(supabase: SupabaseClient) {
  await ensureDeck(supabase);
  const { data: deck, error: deckErr } = await supabase
    .from('deck')
    .select('title, transition, font, accent')
    .eq('id', 1)
    .single();
  if (deckErr) throw deckErr;
  const slides = await loadSlides(supabase);
  return {
    deck: {
      title: deck.title,
      transition: deck.transition,
      font: deck.font ?? 'inter',
      accent: deck.accent ?? null,
    },
    slides,
  };
}

function blankSlide(over: Record<string, unknown> = {}) {
  return {
    id: uid(),
    position: 0,
    layout: 'statement',
    props: {},
    background: { type: 'none' },
    animation: 'cascade',
    transition: null,
    nav: null,
    notes: '',
    status: 'none',
    created_at: now(),
    updated_at: now(),
    ...over,
  };
}

async function shiftFrom(
  supabase: SupabaseClient,
  slides: Array<{ id: string; position: number }>,
  pos: number
) {
  const movers = slides
    .filter((s) => s.position >= pos)
    .sort((a, b) => b.position - a.position);
  for (const s of movers) {
    const { error } = await supabase
      .from('slides')
      .update({ position: s.position + 1 })
      .eq('id', s.id);
    if (error) throw error;
  }
}

async function renumber(supabase: SupabaseClient) {
  const slides = await loadSlides(supabase);
  for (let i = 0; i < slides.length; i++) {
    if (slides[i].position !== i) {
      await supabase
        .from('slides')
        .update({ position: i })
        .eq('id', slides[i].id);
    }
  }
}

async function exportDeck(supabase: SupabaseClient) {
  const state = await getState(supabase);
  return {
    title: state.deck.title,
    transition: state.deck.transition,
    font: state.deck.font,
    accent: state.deck.accent ?? undefined,
    slides: state.slides.map(
      ({
        id: _id,
        position: _position,
        created_at: _c,
        updated_at: _u,
        ...rest
      }) => rest
    ),
  };
}

async function importDeck(
  supabase: SupabaseClient,
  deckJson: Record<string, unknown>
) {
  await ensureDeck(supabase);
  await supabase.from('slides').delete().neq('id', '');
  const { error: deckErr } = await supabase
    .from('deck')
    .update({
      title: (deckJson.title as string) ?? 'Untitled deck',
      transition: (deckJson.transition as string) ?? 'fade',
      font: (deckJson.font as string) ?? 'inter',
      accent: (deckJson.accent as string | null) ?? null,
      updated_at: now(),
    })
    .eq('id', 1);
  if (deckErr) throw deckErr;
  const incoming = (deckJson.slides as Array<Record<string, unknown>>) ?? [];
  if (incoming.length) {
    const rows = incoming.map((sl, i) =>
      blankSlide({
        position: i,
        layout: sl.layout,
        props: sl.props ?? {},
        background: sl.background ?? { type: 'none' },
        animation: sl.animation ?? 'cascade',
        transition: sl.transition ?? null,
        nav: sl.nav ?? null,
        notes: sl.notes ?? '',
        status: sl.status ?? 'none',
      })
    );
    const { error } = await supabase.from('slides').insert(rows);
    if (error) throw error;
  }
}

async function listShares(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('shares').select('*');
  if (error) throw error;
  return (data ?? []).map((s) => ({
    mode: s.mode,
    token: s.token,
    hasPassword: !!s.pass_hash,
    created_at: s.created_at,
  }));
}

async function saveShare(
  supabase: SupabaseClient,
  mode: ShareMode,
  patch: { password?: string | null; rotate?: boolean }
) {
  if (
    typeof patch.password === 'string' &&
    patch.password !== '' &&
    patch.password.length < MIN_PASSWORD
  ) {
    return { error: 'weak' as const };
  }
  const { data: existing } = await supabase
    .from('shares')
    .select('*')
    .eq('mode', mode)
    .maybeSingle();
  let share = existing;
  if (!share) {
    share = {
      mode,
      token: token(),
      pass_hash: null,
      pass_salt: null,
      created_at: now(),
    };
    const { error } = await supabase.from('shares').insert(share);
    if (error) throw error;
  } else if (patch.rotate) {
    share = { ...share, token: token() };
    await supabase
      .from('shares')
      .update({ token: share.token })
      .eq('mode', mode);
  }
  if (patch.password === null || patch.password === '') {
    await supabase
      .from('shares')
      .update({ pass_hash: null, pass_salt: null })
      .eq('mode', mode);
  } else if (typeof patch.password === 'string') {
    const salt = saltHex();
    const hash = await hashPassword(patch.password, salt);
    await supabase
      .from('shares')
      .update({ pass_salt: salt, pass_hash: hash })
      .eq('mode', mode);
  }
  if (patch.rotate || patch.password !== undefined) {
    await supabase.from('share_grants').delete().eq('mode', mode);
  }
  const links = await listShares(supabase);
  return links.find((x) => x.mode === mode);
}

async function removeShare(supabase: SupabaseClient, mode: ShareMode) {
  await supabase.from('shares').delete().eq('mode', mode);
  await supabase.from('share_grants').delete().eq('mode', mode);
}

async function shareInfo(supabase: SupabaseClient, tokenValue: string | null) {
  if (!tokenValue) return null;
  const { data: share } = await supabase
    .from('shares')
    .select('mode, pass_hash')
    .eq('token', tokenValue)
    .maybeSingle();
  return share ? { mode: share.mode, hasPassword: !!share.pass_hash } : null;
}

async function unlock(
  supabase: SupabaseClient,
  tokenValue: unknown,
  password: unknown,
  ip: string
) {
  const { data: share } = await supabase
    .from('shares')
    .select('*')
    .eq('token', String(tokenValue ?? ''))
    .maybeSingle();
  const ok =
    !!share &&
    (await verifyPassword(
      String(password ?? ''),
      share.pass_hash,
      share.pass_salt
    ));
  await noteAttempt(supabase, ip, ok);
  if (!ok) return null;
  const cutoff = new Date(Date.now() - GRANT_DAYS * 86_400_000).toISOString();
  await supabase.from('share_grants').delete().lt('created_at', cutoff);
  const key = token() + token().slice(0, 8);
  const { error } = await supabase.from('share_grants').insert({
    key,
    mode: share.mode,
    created_at: now(),
  });
  if (error) throw error;
  return { key, mode: share.mode };
}

async function throttledFor(
  supabase: SupabaseClient,
  ip: string
): Promise<number> {
  const { data } = await supabase
    .from('unlock_attempts')
    .select('*')
    .eq('ip', ip)
    .maybeSingle();
  if (!data) return 0;
  const left = WINDOW_MS - (Date.now() - Date.parse(data.first_at));
  if (left <= 0) {
    await supabase.from('unlock_attempts').delete().eq('ip', ip);
    return 0;
  }
  return data.count >= TRIES ? Math.ceil(left / 1000) : 0;
}

async function noteAttempt(supabase: SupabaseClient, ip: string, ok: boolean) {
  if (ok) {
    await supabase.from('unlock_attempts').delete().eq('ip', ip);
    return;
  }
  const { data } = await supabase
    .from('unlock_attempts')
    .select('*')
    .eq('ip', ip)
    .maybeSingle();
  if (!data || Date.now() - Date.parse(data.first_at) > WINDOW_MS) {
    await supabase.from('unlock_attempts').upsert({
      ip,
      count: 1,
      first_at: now(),
    });
    return;
  }
  await supabase
    .from('unlock_attempts')
    .update({ count: data.count + 1 })
    .eq('ip', ip);
}

function saltHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(
  password: string,
  saltHexStr: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(saltHexStr),
      iterations: 210_000,
    },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

async function verifyPassword(
  password: string,
  passHash: string | null,
  passSalt: string | null
): Promise<boolean> {
  if (!passHash) return true;
  if (!password || !passSalt) return false;
  const got = await hashPassword(password, passSalt);
  if (got.length !== passHash.length) return false;
  let out = 0;
  for (let i = 0; i < got.length; i++)
    out |= got.charCodeAt(i) ^ passHash.charCodeAt(i);
  return out === 0;
}
