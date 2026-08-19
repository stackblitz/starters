/* Share links — who may see this deck, and what they may change.

   The deck runs on your machine; sharing means exposing that origin (a LAN
   address, a tunnel). So the owner is whoever reaches the server directly on
   loopback with no link in hand, and everyone else arrives holding one:

     edit       the editor — full write access
     presenter  the presenter console — read, plus speaker notes
     present    the audience view — read only

   Each mode has at most one link, optionally password-protected. Passwords
   are stored as scrypt hashes with a per-share salt; entering the right one
   mints a grant key the browser keeps, so the password is asked once.

   Hosting this for real means re-implementing exactly this file behind your
   backend — these rules are the security, not the UI. See docs/cloud-setup.md. */
import crypto from 'node:crypto'
import { state, persist } from './db.mjs'

export const MODES = ['edit', 'presenter', 'present']
export const MIN_PASSWORD = 8
const GRANT_DAYS = 30          // an unlocked visitor is remembered this long
const TRIES = 8                // unlock attempts allowed per window
const WINDOW_MS = 10 * 60_000  // …and how long the window (and lockout) lasts

const now = () => new Date().toISOString()
const token = () => crypto.randomBytes(12).toString('base64url')

/* ── passwords ─────────────────────────────────────────────────────── */
/* scrypt at ~4x Node's default cost: a guess costs real CPU, which is what
   makes the rate limit below hard to out-run. */
const SCRYPT = { N: 2 ** 16, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }
const hash = (password, salt) => crypto.scryptSync(password, salt, 32, SCRYPT).toString('hex')
function verify(password, share) {
  if (!share.pass_hash) return true
  if (!password) return false
  const a = Buffer.from(hash(password, share.pass_salt), 'hex')
  const b = Buffer.from(share.pass_hash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/* ── brute force ───────────────────────────────────────────────────
   Per-IP attempt counter: after TRIES bad guesses the address is locked out
   for the rest of the window. Wrong guesses cost the attacker a scrypt hash
   each; right ones reset the counter. */
const attempts = new Map()
export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  return (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown'
}
/* seconds until this address may try again (0 = it may try now) */
export function throttledFor(ip) {
  const a = attempts.get(ip)
  if (!a) return 0
  const left = WINDOW_MS - (Date.now() - a.first)
  if (left <= 0) { attempts.delete(ip); return 0 }
  return a.count >= TRIES ? Math.ceil(left / 1000) : 0
}
function noteAttempt(ip, ok) {
  if (ok) { attempts.delete(ip); return }
  const a = attempts.get(ip)
  if (!a || Date.now() - a.first > WINDOW_MS) attempts.set(ip, { count: 1, first: Date.now() })
  else a.count += 1
}

/* ── requests ──────────────────────────────────────────────────────── */
/* A page on another site can send a browser "simple request" to this server
   without a preflight. Every write therefore has to come from our own origin:
   browsers set Origin (and Sec-Fetch-Site) on cross-site requests and cannot
   be talked out of it, so this is what stops a random web page from rewriting
   the deck while the dev server is running. Non-browser clients (curl, the
   CLI) send neither header and are unaffected. */
export function sameOrigin(req) {
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none') return false
  const origin = req.headers.origin
  if (!origin) return true
  try { return new URL(origin).host === req.headers.host } catch { return false }
}
/* Loopback with no proxy headers = the owner sitting at this machine. Any
   tunnel or LAN visitor fails this and needs a link. */
export function isOwner(req) {
  const h = req.headers
  if (h['x-forwarded-for'] || h['x-forwarded-host'] || h['cf-connecting-ip'] || h['forwarded']) return false
  const addr = req.socket?.remoteAddress ?? ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

const shareByToken = (t) => state().shares.find((s) => s.token === String(t)) ?? null
const shareByMode = (m) => state().shares.find((s) => s.mode === m) ?? null

/* What this request is allowed to do:
     { mode: 'edit', owner: true }         → the owner, everything
     { mode }                              → a valid share link
     { needsPassword: true, mode }         → right link, no/failed grant
     null                                  → no valid link at all           */
export function access(req) {
  const t = req.headers['x-share-token']
  // Holding a link means you get what the link gives, even on this machine:
  // that way the owner can open a share link (incognito or not) and see
  // exactly what a visitor sees, and a revoked link is dead everywhere.
  if (!t) return isOwner(req) ? { mode: 'edit', owner: true } : null
  const share = shareByToken(t)
  if (!share) return null
  if (share.pass_hash) {
    const key = req.headers['x-share-grant']
    const grant = key ? state().grants.find((g) => g.key === String(key)) : null
    const fresh = grant && Date.now() - Date.parse(grant.created_at) < GRANT_DAYS * 86_400_000
    if (!grant || !fresh || grant.mode !== share.mode) return { needsPassword: true, mode: share.mode }
  }
  return { mode: share.mode, owner: false }
}

/* Capability check for one API call. `patch` lets the presenter link through
   for a notes-only slide update and nothing else. */
export function may(acc, action, patch) {
  if (!acc || acc.needsPassword) return false
  if (acc.mode === 'edit') return true
  if (action === 'read') return true
  if (acc.mode === 'presenter' && action === 'patch-slide') {
    const keys = Object.keys(patch ?? {})
    return keys.length > 0 && keys.every((k) => k === 'notes')
  }
  return false
}

/* ── link management (owner only) ──────────────────────────────────── */
export const listShares = () =>
  state().shares.map((s) => ({ mode: s.mode, token: s.token, hasPassword: !!s.pass_hash, created_at: s.created_at }))

export function saveShare(mode, { password, rotate } = {}) {
  if (!MODES.includes(mode)) return null
  if (typeof password === 'string' && password !== '' && password.length < MIN_PASSWORD) return { error: 'weak' }
  const s = state()
  let share = shareByMode(mode)
  if (!share) {
    share = { mode, token: token(), pass_hash: null, pass_salt: null, created_at: now() }
    s.shares.push(share)
  } else if (rotate) {
    share.token = token()
  }
  if (password === null || password === '') { share.pass_hash = null; share.pass_salt = null }
  else if (typeof password === 'string') {
    share.pass_salt = crypto.randomBytes(16).toString('hex')
    share.pass_hash = hash(password, share.pass_salt)
  }
  // changing the password (or rotating) invalidates everyone already inside
  if (rotate || password !== undefined) s.grants = s.grants.filter((g) => g.mode !== mode)
  persist()
  return listShares().find((x) => x.mode === mode)
}

export function removeShare(mode) {
  const s = state()
  s.shares = s.shares.filter((x) => x.mode !== mode)
  s.grants = s.grants.filter((g) => g.mode !== mode)
  persist()
  return { ok: true }
}

/* ── unlocking (public) ────────────────────────────────────────────── */
export function unlock(tokenValue, password, ip = 'unknown') {
  const share = shareByToken(tokenValue ?? '')
  const ok = !!share && verify(password, share)
  noteAttempt(ip, ok)
  if (!ok) return null
  const s = state()
  const cutoff = Date.now() - GRANT_DAYS * 86_400_000
  s.grants = s.grants.filter((g) => Date.parse(g.created_at) >= cutoff) // sweep the expired
  const key = crypto.randomBytes(18).toString('base64url')
  s.grants.push({ key, mode: share.mode, created_at: now() })
  persist()
  return { key, mode: share.mode }
}

/* What a visitor is allowed to know before they are let in. */
export function shareInfo(tokenValue) {
  const share = shareByToken(tokenValue ?? '')
  return share ? { mode: share.mode, hasPassword: !!share.pass_hash } : null
}
