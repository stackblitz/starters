# Deck backend (Bolt Cloud / Supabase)

The starter ships the schema and the `deck-api` edge function. A Supabase
project is already provisioned for every Bolt project; the agent still has
to **apply the migration** and **deploy the function** before the editor or
the skill can store slides. That is Step 0 in
`.bolt/skills/slides/SKILL.md` — not optional, not "only when publishing".

## Contract

The browser and the skill both talk to:

```
$VITE_SUPABASE_URL/functions/v1/deck-api
```

The gateway still wants `Authorization` and `apikey`. Who is calling
decides which Bearer:

- **Browser (Bolt preview)** — anon key + host-injected `X-Deck-Owner`.
  Bolt derives a per-project preview owner token, injects it into the
  iframe, and (because `.bolt/config.json` sets `previewOwnerSecret`)
  copies the same value to the `DECK_OWNER_SECRET` edge-function secret.
  It is not in workspace `.env` and never a `VITE_` var.
- **Skill / agent** — `SUPABASE_SERVICE_ROLE_KEY` as Bearer. Do not mint a
  second owner secret; do not send `X-Deck-Owner`; do not ask the user to
  add `DECK_OWNER_SECRET`.
- **Share links / published `bolt.host`** — anon key + `X-Share-Token` (and
  `X-Share-Grant` after a password unlock). The bare published URL is not
  the editor.

Custom headers `X-Share-Token`, `X-Share-Grant`, and `X-Deck-Owner` must be
allowed in CORS (the shipped function already does this). `GET /health` is
the deploy probe: `200` and no deck data, no owner credentials.

```
GET    /health
GET    /state
PUT    /deck
POST   /slides
PUT    /slides/:id
POST   /slides/:id/duplicate
DELETE /slides/:id
PUT    /order
GET    /export      POST /import
GET|PUT|DELETE /shares[/:mode]
GET    /share?token=…
POST   /share/unlock
```

## Tables

`deck` (single row), `slides`, `shares`,
`share_grants`, `unlock_attempts`.

**RLS is on with no policies.** The browser must never query these tables
directly: `shares` holds password hashes and `slides` holds speaker notes.
The function uses the service role.

## Permissions the function enforces

- `Authorization` bearer is `SUPABASE_SERVICE_ROLE_KEY` — **owner** (agent)
- `X-Deck-Owner` matching `DECK_OWNER_SECRET` — **owner**. Bolt injects the
  preview owner token into the iframe and syncs it to this secret when
  `previewOwnerSecret` is set in `.bolt/config.json`. Top-level published
  `bolt.host` does not get the header.
- no share token, no service role, no owner proof — **401** once the secret
  is configured (legacy: owner if the secret is unset, e.g. local Vite)
- `edit` share link — everything
- `presenter` — read, plus writing `notes` on a slide
- `present` — read, with `notes` stripped from the response
- export / import / share management — owner or `edit` only

A request carrying a share token is judged **by that token**, even from the
owner's own browser.

## Authoring

Import/export uses the same JSON payload as `.bolt/skills/slides/SKILL.md`.
Author through `deck-api` — do not `execute_sql` into `slides`. After a write
the function broadcasts on the `deck` channel so the preview re-fetches
immediately (no table SELECT; RLS stays locked).
