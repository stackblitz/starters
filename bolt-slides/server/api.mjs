/* REST API for the editor — mounted as Vite dev-server middleware (see
   vite.config.ts), so `npm run dev` is the whole stack: app + API + a JSON
   file for storage (data/deck.json, no database, no dependencies).

   This is the development stand-in for a hosted backend: the routes below are
   the contract the client speaks, and porting to Bolt Cloud / Supabase means
   re-implementing exactly these (docs/cloud-setup.md). Routes:

     GET    /api/state                     full app state (deck, slides, profiles, comments)
     PUT    /api/deck                      { title?, transition? }
     POST   /api/slides                    { layout, props?, position?, ... } → slide
     PUT    /api/slides/:id                partial slide patch
     POST   /api/slides/:id/duplicate      → new slide (inserted after original)
     DELETE /api/slides/:id
     PUT    /api/order                     { ids: [...] } reorder
     POST   /api/profiles                  { name, color } → profile
     POST   /api/comments                  { slideId, profileId, body } → comment
     PUT    /api/comments/:id              { resolved }
     DELETE /api/comments/:id
     GET    /api/export                    portable deck JSON
     POST   /api/import                    portable deck JSON (replaces deck)
     POST   /api/og                        { dataUrl } → writes public/og.png
     GET    /api/shares                    owner: every share link + its state
     PUT    /api/shares/:mode              owner: { password?, rotate? } → link
     DELETE /api/shares/:mode              owner: stop sharing that mode
     GET    /api/share?token=…             public: { mode, hasPassword }
     POST   /api/share/unlock              public: { token, password } → { key }

   Access is decided in server/share.mjs: the owner is whoever reaches this
   server on loopback; everyone else arrives with a share token (and a grant,
   if that link has a password) and gets only what their mode allows. */
import fs from 'node:fs';
import path from 'node:path';
import {
  openDb,
  state,
  persist,
  getState,
  findSlide,
  sortedSlides,
  renumber,
  blankSlide,
  exportDeck,
  importDeck,
  uid,
} from './db.mjs';
import {
  access,
  may,
  listShares,
  saveShare,
  removeShare,
  unlock,
  shareInfo,
  sameOrigin,
  clientIp,
  throttledFor,
  MODES,
  MIN_PASSWORD,
} from './share.mjs';

const now = () => new Date().toISOString();

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const SLIDE_FIELDS = [
  'layout',
  'props',
  'background',
  'animation',
  'transition',
  'nav',
  'notes',
  'status',
  'assignee',
];

/* make room at `pos` by pushing everything from there down */
function shiftFrom(pos) {
  sortedSlides().forEach((s) => {
    if (s.position >= pos) s.position += 1;
  });
}

export function apiMiddleware(rootDir) {
  return async (req, res, next) => {
    const u = new URL(req.url, 'http://x');
    if (!u.pathname.startsWith('/api/')) return next();
    await openDb();
    const seg = u.pathname.slice(5).split('/').filter(Boolean); // after /api/
    const m = req.method;

    try {
      /* ── who is this? ── */
      // a write must come from this app, not from a page on another site
      if (m !== 'GET' && !sameOrigin(req))
        return send(res, 403, { error: 'cross-origin' });
      const acc = access(req);
      const deny = () => {
        if (acc?.needsPassword)
          return send(res, 403, { error: 'password-required', mode: acc.mode });
        if (!acc) return send(res, 401, { error: 'share-required' });
        return send(res, 403, { error: 'read-only', mode: acc.mode });
      };

      /* ── share links: public unlock, owner-only management ── */
      if (seg[0] === 'share') {
        if (m === 'GET' && seg.length === 1) {
          const info = shareInfo(u.searchParams.get('token'));
          return info
            ? send(res, 200, info)
            : send(res, 404, { error: 'no such link' });
        }
        if (m === 'POST' && seg[1] === 'unlock') {
          const ip = clientIp(req);
          const wait = throttledFor(ip);
          if (wait) {
            res.setHeader('Retry-After', String(wait));
            return send(res, 429, {
              error: 'too-many-tries',
              retryAfter: wait,
            });
          }
          const b = await readBody(req);
          const granted = unlock(b.token, b.password, ip);
          // a wrong password must not be distinguishable from a dead link
          return granted
            ? send(res, 200, granted)
            : send(res, 403, { error: 'denied' });
        }
      }
      if (seg[0] === 'shares') {
        if (!acc?.owner) return send(res, 403, { error: 'owner-only' });
        if (m === 'GET') return send(res, 200, listShares());
        const mode = seg[1];
        if (!MODES.includes(mode))
          return send(res, 400, { error: 'unknown mode' });
        if (m === 'PUT') {
          const saved = saveShare(mode, await readBody(req));
          if (saved?.error === 'weak')
            return send(res, 400, {
              error: 'weak-password',
              min: MIN_PASSWORD,
            });
          return send(res, 200, saved);
        }
        if (m === 'DELETE') return send(res, 200, removeShare(mode));
      }

      /* ── everything else needs at least read access ── */
      if (!may(acc, 'read')) return deny();
      const writable = (action, patch) => may(acc, action, patch);
      /* the audience link never receives speaker notes — not hidden in the UI,
         simply absent from the response */
      const visible = (state) =>
        acc.mode !== 'present'
          ? state
          : {
              ...state,
              slides: state.slides.map(({ notes, ...rest }) => ({
                ...rest,
                notes: '',
              })),
            };

      /* ── state / deck ── */
      if (m === 'GET' && seg[0] === 'state')
        return send(res, 200, visible(getState()));
      if (m === 'PUT' && seg[0] === 'deck') {
        if (!writable('write')) return deny();
        const b = await readBody(req);
        const d = state().deck;
        for (const k of ['title', 'transition', 'font', 'accent'])
          if (b[k] !== undefined) d[k] = b[k];
        d.updated_at = now();
        persist();
        return send(res, 200, {
          title: d.title,
          transition: d.transition,
          font: d.font,
          accent: d.accent,
        });
      }

      /* ── slides ── */
      if (seg[0] === 'slides') {
        if (m === 'POST' && seg.length === 1) {
          if (!writable('write')) return deny();
          const b = await readBody(req);
          const count = state().slides.length;
          const pos = Math.max(0, Math.min(b.position ?? count, count));
          shiftFrom(pos);
          state().slides.push(
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
              assignee: b.assignee ?? null,
            })
          );
          persist();
          return send(res, 201, visible(getState()));
        }
        const id = seg[1];
        if (m === 'PUT' && seg.length === 2) {
          const b = await readBody(req);
          // the presenter link may write notes and nothing else
          if (!writable('patch-slide', b)) return deny();
          const slide = findSlide(id);
          if (!slide) return send(res, 404, { error: 'not found' });
          for (const k of SLIDE_FIELDS) if (b[k] !== undefined) slide[k] = b[k];
          slide.updated_at = now();
          persist();
          return send(res, 200, { ok: true });
        }
        if (m === 'POST' && seg[2] === 'duplicate') {
          if (!writable('write')) return deny();
          const src = findSlide(id);
          if (!src) return send(res, 404, { error: 'not found' });
          shiftFrom(src.position + 1);
          state().slides.push(
            blankSlide({
              ...structuredClone(src),
              id: uid(),
              position: src.position + 1,
              status: 'none',
              created_at: now(),
              updated_at: now(),
            })
          );
          persist();
          return send(res, 201, visible(getState()));
        }
        if (m === 'DELETE' && seg.length === 2) {
          if (!writable('write')) return deny();
          const s2 = state();
          s2.slides = s2.slides.filter((x) => x.id !== id);
          s2.comments = s2.comments.filter((c) => c.slide_id !== id);
          renumber();
          return send(res, 200, visible(getState()));
        }
      }

      if (m === 'PUT' && seg[0] === 'order') {
        if (!writable('write')) return deny();
        const b = await readBody(req);
        (b.ids ?? []).forEach((sid, i) => {
          const sl = findSlide(sid);
          if (sl) sl.position = i;
        });
        persist();
        return send(res, 200, { ok: true });
      }

      /* ── profiles / comments ── */
      if (m === 'POST' && seg[0] === 'profiles') {
        if (!writable('write')) return deny();
        const b = await readBody(req);
        const profile = {
          id: uid(),
          name: b.name,
          color: b.color,
          created_at: now(),
        };
        state().profiles.push(profile);
        persist();
        return send(res, 201, {
          id: profile.id,
          name: profile.name,
          color: profile.color,
        });
      }
      if (seg[0] === 'comments') {
        if (m !== 'GET' && !writable('write')) return deny();
        if (m === 'POST') {
          const b = await readBody(req);
          const comment = {
            id: uid(),
            slide_id: b.slideId,
            profile_id: b.profileId ?? null,
            body: b.body,
            resolved: 0,
            created_at: now(),
          };
          state().comments.push(comment);
          persist();
          return send(res, 201, comment);
        }
        if (m === 'PUT' && seg[1]) {
          const b = await readBody(req);
          const c = state().comments.find((x) => x.id === seg[1]);
          if (c) {
            c.resolved = b.resolved ? 1 : 0;
            persist();
          }
          return send(res, 200, { ok: true });
        }
        if (m === 'DELETE' && seg[1]) {
          const s2 = state();
          s2.comments = s2.comments.filter((x) => x.id !== seg[1]);
          persist();
          return send(res, 200, { ok: true });
        }
      }

      /* ── portability ── */
      if (m === 'GET' && seg[0] === 'export')
        return send(
          res,
          200,
          acc.mode === 'edit' ? exportDeck() : visible(exportDeck())
        );
      if (m === 'POST' && seg[0] === 'import') {
        if (!writable('write')) return deny();
        importDeck(await readBody(req));
        return send(res, 200, visible(getState()));
      }

      /* ── OG image: slide 1 snapshot → public/og.png ── */
      if (m === 'POST' && seg[0] === 'og') {
        if (!writable('write')) return deny();
        const b = await readBody(req);
        const png = (b.dataUrl ?? '').replace(/^data:image\/png;base64,/, '');
        if (!png) return send(res, 400, { error: 'dataUrl required' });
        fs.writeFileSync(
          path.join(rootDir, 'public', 'og.png'),
          Buffer.from(png, 'base64')
        );
        return send(res, 200, { ok: true });
      }

      return send(res, 404, { error: 'no such route' });
    } catch (e) {
      return send(res, 500, { error: String(e?.message ?? e) });
    }
  };
}
