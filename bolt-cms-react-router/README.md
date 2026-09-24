# Bolt CMS (React Router)

The starter a WordPress site lands in when it is imported into
[Bolt](https://bolt.new). A static React Router 8 site backed by
Supabase that renders the schema Bolt's WordPress importer writes, with
three switchable themes and a built-in `/bolt-admin` that Bolt shows in
its Admin tab.

The agent skills in `.bolt/skills/` cover day-to-day work: `bolt-cms`
(content, schema, security), `bolt-cms-theme` (visuals), and
`bolt-cms-extend` (new fields, editable custom post types, site tables).

## Quick start

```bash
cp .env.example .env   # fill in your Supabase project values
npm install
npm run dev            # public site at http://localhost:5173
npm run build          # static output in build/client
```

`/bolt-admin` only works inside Bolt's Admin tab; opened directly it
shows "Open this page from the Admin tab in Bolt."

### Environment

| Key                      | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL                            |
| `VITE_SUPABASE_ANON_KEY` | anon key; RLS limits it to reading `cms_` tables |

There is no server and no secret. Without these keys the site renders a
setup notice instead of content.

## What's inside

```
app/routes/site/        public routes: /, /blog, /category/:slug, /tag/:slug,
                        /author/:slug, /search, and a WordPress-style catch-all
app/components/site/    header, footer, post list, article, comments
app/lib/cms/            typed Supabase reads, Portable Text, path resolution, SEO meta
app/theme/              token contract + classic / editorial / minimal themes
app/routes/admin/       dashboard, posts, pages, authors, categories, tags,
                        comments, media, menus, appearance, settings
app/admin/              admin UI kit, field inputs, Tiptap editor, bridge client,
                        queries.ts (every admin SQL statement)
.bolt/admin.json        admin query manifest, generated from app/admin/queries.ts
scripts/                build-admin-manifest.ts
supabase/migrations/    importer schema (0001) and starter tables + seed (0002)
bolt-cms.json           starter version marker (boltCmsVersion)
```

## Architecture

### Public site

Routes use `clientLoader` and the anon key. URLs follow WordPress:
`/:slug` for posts (date permalinks resolve by their last segment),
`/parent/child` for hierarchical pages, `/search?s=term` for search.
Redirects in `cms_redirects` are honored by the catch-all so old
WordPress paths keep working. Post bodies are Portable Text (`body`),
falling back to the imported `content_html`; the HTML is sanitized with
DOMPurify and WordPress block classes are styled in
`app/theme/tokens.css`. Comments are read-only. Products
(`cms_products`) are neither rendered nor edited.

### Admin

Bolt iframes `<deployed-site>/bolt-admin`. The page talks to Bolt over
`postMessage` (`app/admin/bridge/client.ts`) and may call only two
methods:

- `bolt.hello` — protocol version and the user's permissions
  (`canEdit`; read-only users get disabled write buttons).
- `db.run { name, parameters }` — runs a query declared by name in
  `.bolt/admin.json`, as the signed-in Bolt user.

Queries are authored in `app/admin/queries.ts` (`ADMIN_QUERIES`; the
`sql` tag collapses whitespace; `contentQueries(table, word)` builds the
eight list/count/get/options/insert/update/setStatus/remove queries for
`cms_posts` and `cms_pages`). `npm run manifest` validates them and
writes `.bolt/admin.json`; never edit the JSON by hand. Deletes carry
`confirm: true`, so Bolt asks the user before running them. Bolt reads
the manifest from the deployed revision, so query changes need a
publish. There is no local stand-in for the host.

### Themes

`app/theme/tokens.css` defines the `--theme-*` contract; each theme in
`app/theme/themes/` sets those variables under
`html[data-site-theme='<name>']`. The active theme is the
`cms_settings` key `theme`, picked in Admin → Appearance. See the
`bolt-cms-theme` skill for adding one.

## Schema

Bolt applies `supabase/migrations/*.sql` when it creates the project's
Bolt Database. Both files are idempotent and leave an imported database
untouched:

- `0001_bolt_cms_schema.sql` — generated from Bolt's WordPress importer
  (`cms_site`, `cms_types`, `cms_fields`, `cms_assets`, `cms_authors`,
  `cms_categories`, `cms_tags`, `cms_posts`, `cms_pages`,
  `cms_comments`, their public-read RLS policies, and the
  `cms_types`/`cms_fields` registry rows). Never hand-edit it.
- `0002_starter.sql` — starter-owned tables (`cms_settings`,
  `cms_menus`, `cms_menu_items`, `cms_redirects`) with public-read RLS,
  default `cms_site`/`cms_settings` rows that only fill gaps, and a seed
  inserted only into empty tables: author "Admin", category
  "Uncategorized", post "Hello world!", page "Sample Page", and a
  primary menu (Home, Sample Page).

`0001` is regenerated by Bolt maintainers when the importer's schema
changes.

Later schema changes go through the `apply_migration` Supabase tool,
not new migration files.

## Media

Media rows live in `cms_assets`; files live in the public Supabase
Storage bucket `cms-media`, both written by the WordPress importer. The
admin library is read-only apart from title, alt text, and caption; it
cannot add or delete files. To add one, put it in the `cms-media` bucket
of the Bolt Database and insert a `cms_assets` row.

## Verification

```bash
npm run typecheck && npm run check && npm run build
```

- `typecheck` runs route typegen, `tsc`, and `npm run manifest -- --check`,
  which fails when `.bolt/admin.json` is stale.
- `check` runs the Portable Text converter asserts
  (`app/lib/cms/portable-text.check.ts`).
- `build` outputs `build/client` (SPA; Bolt hosting falls back to
  `index.html`).

The starter version is `boltCmsVersion` in `bolt-cms.json`; bump it when
the schema or admin queries change so projects can be upgraded.
