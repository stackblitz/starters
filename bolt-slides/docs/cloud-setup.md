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

with `Authorization: Bearer $VITE_SUPABASE_ANON_KEY` and `apikey` set to the
same key. Custom headers `X-Share-Token` and `X-Share-Grant` must be allowed
in CORS (the shipped function already does this).

```
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

- no share token — **owner** (full edit). The published/preview URL is the
  credential.
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
