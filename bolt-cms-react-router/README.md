# Bolt CMS (React Router)

The starter a WordPress site lands in when it is imported into
[Bolt](https://bolt.new). A static React Router 8 site backed by
Supabase, with a WordPress-shaped schema so imported content maps 1:1,
three switchable themes, and a built-in `/admin` that only renders
inside Bolt.

The agent skills in `.bolt/skills/` cover day-to-day work: `bolt-cms`
(content, schema, security), `bolt-cms-theme` (visuals), and
`bolt-cms-extend` (custom types, taxonomies, fields, plugin data).

## Quick start

```bash
cp .env.example .env   # fill in your Supabase project values
npm install
npm run dev            # site at http://localhost:5173, admin at /admin
npm run lint
npm run typecheck
npm run build          # static output in build/client
```

Apply `supabase/migrations/0001_cms_core.sql` then
`0002_cms_seed.sql` to the Supabase project (in Bolt the agent does
this with `apply_migration`). The seed is a WordPress fresh install:
"Hello world!", "Sample Page", the Uncategorized category, one comment,
and a primary menu.

### Environment

| Key                         | Where              | Purpose                                   |
| --------------------------- | ------------------ | ----------------------------------------- |
| `VITE_SUPABASE_URL`         | client             | Supabase project URL                      |
| `VITE_SUPABASE_ANON_KEY`    | client             | anon key; RLS limits it to published data |
| `SUPABASE_URL`              | dev only           | used by the local admin bridge            |
| `SUPABASE_SERVICE_ROLE_KEY` | dev only           | used by the local admin bridge; never shipped |

Without the `VITE_*` keys the site renders a setup notice instead of
content.

## What's inside

```
app/routes/site/        public routes: /, /blog, /category/:slug, /tag/:slug,
                        /author/:slug, /search, and a WordPress-style catch-all
app/components/site/    header, footer, post list, article, comments
app/lib/cms/            typed Supabase reads, path resolution, SEO meta
app/theme/              token contract + classic / editorial / minimal themes
app/routes/admin/       dashboard, content, media, comments, terms, menus,
                        appearance, settings
app/admin/              admin UI kit (Bolt design-system tokens), field
                        renderers, Tiptap editor, host bridge
dev/cms-dev-server.ts   local stand-in for the Bolt host bridge
supabase/migrations/    schema (0001) and WordPress defaults (0002)
public/wp-content/      imported uploads are copied here
bolt-cms.json           starter version marker (boltCmsVersion)
```

### Public site

Routes use `clientLoader` and the anon key. URLs follow WordPress:
`/:slug` for posts, `/parent/child` for hierarchical pages,
`/?s=term` for search. Redirects in `cms_redirects` are honored by the
catch-all so old WordPress paths keep working. Post HTML is sanitized
with DOMPurify and WordPress block classes are styled in
`app/theme/tokens.css`.

### Schema

Tables are prefixed `cms_` and mirror the WordPress REST API:
`cms_settings`, `cms_authors`, `cms_media`, `cms_posts` (posts, pages,
and custom types via `type`), `cms_post_meta`, `cms_terms` (categories,
tags, custom taxonomies via `taxonomy`), `cms_term_relationships`,
`cms_comments`, `cms_menus`, `cms_menu_items`, `cms_redirects`, plus
`cms_fields`, which describes the admin editor forms. WordPress ids are
preserved; new rows get ids from 1,000,000,000 up.

RLS gives the anon key read access to published content and a single
write: submitting a comment, which is always stored as `hold`.

### Admin

`/admin` is part of the app but only renders when the page is framed by
Bolt (or during `npm run dev`); on the published site it is blank. It
talks to the host over `postMessage` using a small PostgREST-shaped
protocol (`app/admin/bridge/protocol.ts`): select / insert / upsert /
update / delete / upload against `cms_*` tables. The host executes the
operations with elevated privileges; the browser never holds a
privileged key.

Locally, `dev/cms-dev-server.ts` plays the host: `POST /__cms` runs
operations with the service role key from `.env`, and `GET /__host`
serves a page that frames `/admin` the way Bolt does, so the framed
gate and the postMessage transport can be exercised without Bolt.

Content is edited with Tiptap. Posts keep both `content_html` (what
the site renders, WordPress-compatible) and `content_json` (editor
state).

### Themes

`app/theme/tokens.css` defines the `--theme-*` contract; each theme in
`app/theme/themes/` sets those variables under
`html[data-site-theme='<name>']`. The active theme is
`cms_settings.theme`, picked in Admin → Appearance. See the
`bolt-cms-theme` skill for adding one.

## Notes for the Bolt side

- Build: `npm run build`, output `build/client` (SPA; Bolt hosting
  falls back to `index.html`).
- Stretch: React Router `prerender` can emit static HTML for known
  paths at build time if SEO becomes a priority; that needs the
  loaders to be runnable at build time (a `loader` alongside
  `clientLoader`).
- The starter version is `boltCmsVersion` in `bolt-cms.json`; bump it
  when the schema or admin protocol changes so projects can be
  upgraded.
