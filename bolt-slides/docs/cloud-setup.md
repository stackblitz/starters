# Running this deck on a cloud backend (Bolt Cloud / Supabase)

Read this when a published deck needs to do more than present.

Publishing works out of the box: `npm run build` bakes the deck into the
bundle (`server/snapshot.mjs`) and the app renders that snapshot when no API
answers, so a published link presents the deck read-only. What a snapshot
cannot do is write, or keep a secret. Move to a cloud backend when you need:

- **editing or commenting on the published deck** — a snapshot is immutable,
  and every visitor sees the same build until you publish again
- **share links and passwords** — the client can send a token, but only a
  server can *check* one; a static bundle cannot refuse to serve itself
- **private speaker notes** — notes ride along in the snapshot, so on a
  published deck they are public to anyone who opens presenter view

---

## Which mode am I in?

| | Local file mode (the default) | Cloud mode |
|---|---|---|
| Data lives in | `data/deck.json` (one JSON file, no database) | Postgres tables |
| API is | `server/api.mjs`, mounted on the Vite dev server | one edge function |
| Published deck | presents, read-only, from the build snapshot | fully live |
| Published deck can be edited | **No** | Yes |
| Share links / passwords / private notes | local dev only | Yes |
| Deck CLI (`scripts/deck.mjs`) | works | not used — import through the API |

Check in one line:

```bash
curl -s localhost:5173/api/state >/dev/null && echo "local file mode" || echo "no local API — check for a cloud backend"
```

Local file mode is right for authoring on your machine, and its build snapshot
is enough for a deck you simply want people to *watch*. Move to cloud mode when
the published deck has to be live — edited, commented on, access-controlled, or
holding notes you do not want public.

---

## What the port has to provide

Whatever backend you use, it must give the client the same contract the app
already speaks, or the app will not work:

**Routes** (all under one function, e.g. `/functions/v1/deck-api`):

```
GET    /state                     deck + slides + profiles + comments
PUT    /deck                      { title?, transition?, font?, accent? }
POST   /slides                    → new slide
PUT    /slides/:id                partial patch
POST   /slides/:id/duplicate
DELETE /slides/:id
PUT    /order                     { ids: [...] }
POST   /profiles · /comments · PUT/DELETE /comments/:id
GET    /export      POST /import  portable deck JSON
GET|POST /og                      link-preview image
GET|PUT|DELETE /shares[/:mode]    owner only
GET    /share?token=…             { mode, hasPassword }
POST   /share/unlock              { token, password } → { key }
```

**Tables**: `deck` (single row), `slides`, `profiles`, `comments`, `shares`,
`share_grants`, and a throttle table for unlock attempts. Enable row-level
security with **no policies at all**: the browser must never read these
directly, because `shares` holds password hashes and `slides` holds speaker
notes that the audience link is not allowed to see. The function talks to the
database with the service role key; the browser only ever talks to the
function.

**Permissions** the function must enforce (not the UI):

- `edit` — everything
- `presenter` — read, plus writing `notes` on a slide and nothing else
- `present` — read, with `notes` stripped from the response server-side
- export / import / OG / share management — owner or `edit` only

**Passwords**: scrypt with a per-share salt, constant-time compare, minimum 8
characters, a wrong password indistinguishable from a dead link, and a
per-address attempt limit (8 per 10 minutes → 429 with `Retry-After`).

**CORS**: allow the two custom headers the client sends, `X-Share-Token` and
`X-Share-Grant`, or every request fails preflight.

---

## The one decision that matters: who is the owner?

Locally, the owner is whoever reaches the server on loopback. **That rule
cannot survive publishing** — nothing is loopback on a deployed site, so the
app falls back to view-only and the editor redirects to present mode.

The obvious replacement is "owner = a request with no share token". It makes
the published editor work, but understand what you have chosen:

> **Anyone who opens the bare published URL is the owner and can edit the
> deck.** The URL itself is the only credential.

That is fine for a personal deck on a link nobody guesses. It is not fine for
anything you would mind a stranger rewriting. If the deck matters, pick one:

- require the `edit` share link for write access, so the bare URL gets
  read-only, or
- give the function an owner secret (an env var) that the editor sends, and
  treat "no token and no secret" as a visitor rather than an owner.

Either way, a request carrying a share token must be judged **by that token**,
even from the owner's own machine — that is what makes a revoked link dead
everywhere and lets you preview what a visitor sees.

---

## Publish checklist

1. Port storage to the cloud backend before the first publish **if the
   published deck must be live**. A read-only deck does not need this — the
   build snapshot already covers it.
2. Build with `npx vite build` — that is what Bolt's deploy runs for this
   template, so it is what you want to reproduce locally. `npm run typecheck`
   is separate and does not gate the build.
4. Copying an existing deck across? `slides.position` is **1-based**. Data
   copied as 0-based renders off by one; renumber once after the import.
5. Never test permissions against the live deck. A `PUT /slides/:id` with
   `props` **replaces** the whole props object, and writing `notes: ""` wipes
   the real note. Duplicate a slide and test on the copy.
6. Check the published link in a private window: the editor should open, a
   `present` link should hide speaker notes, and a revoked link should be
   refused.
7. Delete what the port left behind once it is proven: `server/*.mjs`,
   `data/deck.json`, and `scripts/deck.mjs`. Removing `server/` also means
   removing the `deckApi()` and `deckSnapshot()` plugins from
   `vite.config.ts`, which import from it — the build fails otherwise. Cloud
   mode has a live API, so the snapshot fallback is no longer needed.

---

## Authoring decks in cloud mode

The `slides` skill authors decks as JSON. In local file mode it imports with
the CLI; in cloud mode the CLI is inert — post the same JSON to the API
instead:

```bash
curl -X POST "$DECK_API/import" \
  -H "Content-Type: application/json" \
  --data-binary @deck.draft.json
```

The JSON format is identical in both modes and is documented in
`.bolt/skills/slides/SKILL.md`.
