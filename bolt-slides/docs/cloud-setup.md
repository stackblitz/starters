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

- **Browser (preview)** — anon key + host-injected `X-Deck-Owner` matching
  `DECK_OWNER_SECRET` (never a `VITE_` var; not in the published JS).
- **Skill / agent** — `SUPABASE_SERVICE_ROLE_KEY` as Bearer. Do not mint a
  second owner secret; do not send `X-Deck-Owner`.
- **Share links** — anon key + `X-Share-Token` (and `X-Share-Grant` after a
  password unlock).

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
POST   /profiles · /comments · PUT/DELETE /comments/:id
GET    /export      POST /import
GET|PUT|DELETE /shares[/:mode]
GET    /share?token=…
POST   /share/unlock
```

## Tables

`deck` (single row), `slides`, `profiles`, `comments`, `shares`,
`share_grants`, `unlock_attempts`.

**RLS is on with no policies.** The browser must never query these tables
directly: `shares` holds password hashes and `slides` holds speaker notes.
The function uses the service role.

## Permissions the function enforces

- `Authorization` bearer is `SUPABASE_SERVICE_ROLE_KEY` — **owner** (agent)
- `X-Deck-Owner` matching `DECK_OWNER_SECRET` — **owner**. Bolt preview
  injects this; it is not in the published JS bundle.
- no share token, no service role, no owner proof — **401** once the secret
  is configured (legacy: owner if the secret is unset)
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
