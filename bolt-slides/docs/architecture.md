# How this deck is put together

One deck, kept in Postgres, reached through one Edge Function. This is the long
version of the README's architecture section: what the pieces are, what the
function promises the app, and why the rules sit where they do rather than
somewhere more convenient.

---

## Where a deck is

`supabase/schema.sql` is the whole story: a single `deck` row, its `slides`, the
`shares` that let other people in, and two functions — `import_deck(jsonb)` and
`export_deck()` — that move a deck in and out as one JSON document.

There is deliberately no second copy. No `data/deck.json`, no seed file, no
dev-server storage. A second place to keep slides is not a backup: it is a second
answer to "what is in this deck", and the app can only ever show one of them.

Two details worth knowing before changing anything:

- **`position` is the index a slide sits at**, 0-based, renumbered after anything
  that could leave a gap. It is not merely a number that sorts.
- **`version` is bumped by a trigger on every write, anywhere.** An open editor
  polls it — that is how it notices a deck the agent authored a second ago, or an
  edit made in the presenter window. If a write path ever stops bumping it, the
  editor keeps showing a deck that is no longer there.

Applying the schema is safe to repeat, which matters because the tool that
applies it can time out after the SQL has already committed.

---

## The way in

Everything the app does goes through `supabase/functions/deck`, served at
`/functions/v1/deck`:

```
GET    /state                  the deck: meta + slides + what this visitor may do
GET    /version                a counter, bumped by any write anywhere
PUT    /meta                   { title?, transition?, font?, accent?,
                                 visibility?, publish_url? }
POST   /slides                 { layout, props?, position?, … } → state
PUT    /slides/:id             partial slide patch
POST   /slides/:id/duplicate   → state
DELETE /slides/:id             → state
PUT    /order                  { ids: [...] } reorder
GET    /export                 the portable deck JSON
POST   /import                 portable deck JSON, replacing the deck
GET    /shares                 every share link and its state
PUT    /shares/:mode           { password?, rotate? } → the link
DELETE /shares/:mode           stop sharing that mode
GET    /share?token=…          { mode, hasPassword } — public, before unlocking
POST   /share/unlock           { token, password } → { key }
```

The file is split so the rules can be read on their own: `routes.ts` is the
router, `access.ts` decides who is asking, and `sql.ts` is the one method either
of them knows about the database. Nothing in those three touches Deno, which is
why the test suite runs the real handlers against an in-process Postgres
(`test/bolt-slides-deck.test.ts` in the starters repo) instead of a mock.

`index.ts` is the only Deno part: it opens the connection and serves.

---

## Who may do what, and why it lives here

**The anon key ships inside every published deck.** Anyone the deck is shared
with has it, and can call this function with whatever headers they like. So a
rule enforced in the editor's UI is not a rule; hiding a button hides a button.

The three ways in:

| Holding                     | Is                    | May                                                   |
| --------------------------- | --------------------- | ----------------------------------------------------- |
| the deck's `owner_key`      | the owner, editing    | everything                                            |
| an `edit` link              | someone they invited  | everything                                            |
| a `presenter` link          | a co-presenter        | read, and write `notes` — nothing else                 |
| a `present` link            | the audience          | read, and never receive the notes at all              |
| nothing, on a public deck   | a visitor             | read, and never receive the notes at all              |
| nothing, on a `link` deck   | nobody                | nothing                                               |

Four decisions inside that table are deliberate:

1. **Row level security is enabled on every table with no policies at all.**
   Supabase grants `anon` every privilege on the public schema, so this is the
   only thing between the published bundle's key and the deck. A policy for
   `anon` would hand the audience the speaker notes and a way to rewrite the
   deck — the two things this function exists to prevent. If a permission problem
   ever looks like it needs a policy, the fix belongs in the function.

2. **Speaker notes are never sent** to `present` — not blanked in the client, not
   hidden in the UI. They are what the presenter says rather than what the
   audience reads, so the audience view is not trusted to keep a secret it was
   given.

3. **A share link governs you even if you own the deck.** The owner opening a
   link sees exactly what its holder sees, which is the only honest way to
   preview one, and it makes a revoked link dead everywhere rather than dead for
   everyone except the person who revoked it. (A link also governs only the tab
   it was opened in: the token lives in `sessionStorage`.)

4. **The owner key is not hashed.** It is a key to the very rows it sits beside,
   so hashing it would protect nothing from anyone able to read that table, and
   keeping it readable means a lost `.env` can be recovered rather than locking
   the owner out permanently.

**Passwords** are PBKDF2-SHA256 with a per-link salt, 210,000 iterations, stored
in a self-describing format so the cost can be raised later without a migration.
The iteration count is what one guess costs; the per-address attempt limit (8 per
10 minutes, answered with `429` and `Retry-After`) is what makes a run of guesses
hopeless. A wrong password and a dead link answer identically, so guessing
cannot be used to learn which links exist. Changing a password or rotating a link
turns out everyone already inside — otherwise changing it would lock nobody out,
which is the only reason to change it.

**CORS**: every header the app sends has to be listed in the preflight, or the
browser makes no request at all — a failure that looks like the function being
broken rather than a list being short.

---

## Editing versus publishing

The editor proves itself with the deck's `owner_key`, which `vite.config.ts`
hands to the app **only while the dev server is serving it**. It is deliberately
not prefixed `VITE_`, so `vite build` never defines it: a published deck is
keyless by construction and cannot be edited by whoever opens it. Sharing the
editor is what an `edit` link is for.

That is why the published deck is not a static copy. It reads the same database
through the same function, so an edit made in the editor appears on it — and a
share link is worth sending because it opens the deck as it is.

**Where links point.** The address the editor runs on opens for nobody else, so
links are built on the published address instead. The first load of the published
site records it: browsers set `Origin` and page scripts cannot forge it, so the
site tells the deck where it lives — custom domains included, which no amount of
guessing at URL shapes would get right. Preview and localhost origins are
skipped, and only a blank is ever filled, so a passing site cannot steal a deck's
sharing address. The Share dialog can also set it by hand.

---

## When there is no database

A project starts without one, so this is the state every deck is in on its first
load. The app says so (`src/data/NoDatabase.tsx`) rather than showing an empty
editor that looks like a deck with no slides.

"Configured" has to mean more than "the variable is set": Bolt writes placeholder
credentials into `.env` at git init, pointing at a project that does not exist.
Treating those as a database means spending the first load talking to nobody and
reporting it as a network failure, so they are recognised and treated as what
they are.

---

## Things that will bite

- **A slide patch replaces what it names.** `PUT /slides/:id` with `props` swaps
  the whole props object, and `notes: ""` erases the real note. Never test
  against a deck someone cares about: export it first, or work on a duplicate.
- **An import replaces the deck**, keeping slide identity where it can — by `id`
  when the incoming deck names one, by position when it does not. Export before
  editing an existing deck, or the user's untouched slides come back as copies of
  themselves.
- **`npm run build`, not `npx vite build`.** The script is what the deploy runs.
- Check a published deck in a private window: the deck should present, a
  `present` link should show no speaker notes, and a revoked link should be
  refused.
