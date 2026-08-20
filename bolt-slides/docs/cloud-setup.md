# Running this deck on a cloud backend (Bolt Cloud / Supabase)

Read this **before** publishing, not after. The starter ships with local
storage that cannot survive a deploy, and the failure is silent: the published
page sits on "Loading project" forever, because it is waiting for an API that
only ever existed inside the dev server.

---

## Which mode am I in?

| | Local file mode (the default) | Cloud mode |
|---|---|---|
| Data lives in | `data/deck.json` (one JSON file, no database) | Postgres tables |
| API is | `server/api.mjs`, mounted on the Vite dev server | one edge function |
| Works when published | **No** | Yes |
| Deck CLI (`scripts/deck.mjs`) | works | not used — import through the API |

Check in one line:

```bash
curl -s localhost:5173/api/state >/dev/null && echo "local file mode" || echo "no local API — check for a cloud backend"
```

Local file mode is right for authoring on your machine. The moment the deck
needs to be *published* — a link you send someone, a client review, anything
outside your laptop — it has to move to cloud mode first.

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

1. Port storage to the cloud backend **before** the first publish.
2. `npm run build` — use the npm script, not `npx vite build`; the script is
   what the deploy runs.
3. Add `src/vite-env.d.ts` with `/// <reference types="vite/client" />` if
   TypeScript cannot see `import.meta.env`.
4. Copying an existing deck across? `slides.position` is **1-based**. Data
   copied as 0-based renders off by one; renumber once after the import.
5. Never test permissions against the live deck. A `PUT /slides/:id` with
   `props` **replaces** the whole props object, and writing `notes: ""` wipes
   the real note. Duplicate a slide and test on the copy.
6. Check the published link in a private window: the editor should open, a
   `present` link should hide speaker notes, and a revoked link should be
   refused.
7. Delete what the port left behind once it is proven: `server/*.mjs`,
   `data/deck.json`, and `scripts/deck.mjs`.

---

## Authoring decks in cloud mode

The `slides` skill authors decks as JSON. In local file mode it imports with
the CLI; in cloud mode the CLI is inert — post the same JSON to the API
instead:

```bash
curl -X POST "$DECK_API/import" \
  -H "Content-Type: application/json" \
  --data-binary @deck.json
```

The JSON format is identical in both modes and is documented in
`.bolt/skills/slides/SKILL.md`.
