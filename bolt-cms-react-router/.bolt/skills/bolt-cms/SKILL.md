---
name: bolt-cms
description: >-
  Work on a Bolt CMS site: a WordPress-shaped React Router + Supabase
  website with a built-in /admin. Use this whenever the user asks about
  their imported WordPress content, posts, pages, categories, tags,
  comments, menus, media, site settings, the admin, or the database
  behind the site.
---

# Bolt CMS — a WordPress-shaped site on React Router + Supabase

This project is the landing place for a WordPress import. The schema,
URLs, and admin screens intentionally mirror WordPress so content maps
1:1. Keep that shape unless the user asks to change it.

## Map

```
supabase/migrations/0001_cms_core.sql   tables, views, triggers, RLS
supabase/migrations/0002_cms_seed.sql   WordPress fresh-install defaults + cms_fields
app/lib/cms/                            typed reads for the public site (anon key)
app/routes/site/                        public routes (home, blog, category, tag, author, search, catch-all)
app/components/site/                    public UI (header, footer, post list, article, comments)
app/theme/                              theme contract + classic / editorial / minimal
app/routes/admin/ + app/admin/          /admin (only renders inside Bolt or `npm run dev`)
app/admin/bridge/                       postMessage protocol to the Bolt host
dev/cms-dev-server.ts                   local stand-in for the host: /__cms and /__host
bolt-cms.json                           `boltCmsVersion` marker used for starter upgrades
```

## Data model (WordPress → tables)

| WordPress            | Table                    | Notes                                                |
| -------------------- | ------------------------ | ---------------------------------------------------- |
| options              | `cms_settings`           | key → jsonb value (`site_title`, `theme`, `seo`, …)  |
| users                | `cms_authors`            |                                                      |
| media                | `cms_media`              | `local_path` under `public/wp-content/uploads/`      |
| posts / pages / CPTs | `cms_posts`              | `type` column: `post`, `page`, or a custom type      |
| post meta            | `cms_post_meta`          | key/value, jsonb                                     |
| categories / tags    | `cms_terms`              | `taxonomy` column: `category`, `post_tag`, or custom |
| term relationships   | `cms_term_relationships` | trigger keeps `cms_terms.count` in sync              |
| comments             | `cms_comments`           | anon inserts are forced to `hold`                    |
| nav menus            | `cms_menus`, `cms_menu_items` | `location` = `primary`, `footer`, …             |
| redirects            | `cms_redirects`          | old WordPress paths → new paths                      |
| (admin form config)  | `cms_fields`             | drives the admin editor; see bolt-cms-extend         |

WordPress ids are preserved as primary keys. Sequences start at
1,000,000,000 so new rows never collide with imported ids. `cms_posts`
slugs are unique per `(type, slug, parent)` like WordPress.

Discovery views: `cms_post_type_counts` and `cms_taxonomy_counts`. The
admin sidebar lists whatever types and taxonomies actually exist, so a
new `type` value shows up without code changes.

## Security model

- The browser only ever has the **anon** key. RLS lets anon read
  published posts, approved comments, terms, menus, media, settings,
  and insert a comment (always stored as `hold`, gated by
  `comments_enabled` and the post's `comment_status`).
- All writes from `/admin` go through the Bolt host bridge
  (`app/admin/bridge/`), which executes them with elevated privileges
  on the host side. Locally, `npm run dev` provides the same bridge via
  `dev/cms-dev-server.ts` using `SUPABASE_SERVICE_ROLE_KEY` from `.env`
  (server-only; never `VITE_`-prefixed).
- Never put the service role key in `VITE_*` env or in app code.

## Working with content

- Read content in the site with the helpers in `app/lib/cms/queries.ts`
  (`listPosts`, `getPostBySlug`, `getPageByPath`, `getTermBySlug`,
  `getMenu`, `getSettings`, …). They already filter to published rows.
- Render post HTML with `<PostContent html={...} />`, which sanitizes
  with DOMPurify and applies `.entry-content` block styles. Do not
  `dangerouslySetInnerHTML` raw content elsewhere.
- Post bodies keep both `content_html` (WordPress HTML, what the site
  renders) and `content_json` (Tiptap/ProseMirror JSON the editor
  prefers). If you edit `content_html` programmatically, set
  `content_json` to `null` so the editor re-derives it from HTML.
- URLs follow WordPress: `/:slug` for posts, `/parent/child` for
  hierarchical pages, `/category/:slug`, `/tag/:slug`, `/author/:slug`,
  `/?s=` or `/search?s=`, `/blog` when `show_on_front = 'page'`. The
  catch-all route resolves redirects → page path → post slug.

## Schema changes

Bolt applies migrations with the `apply_migration` tool. Add a new file
in `supabase/migrations/` (next number, snake_case name) instead of
editing `0001`/`0002` after they have been applied. Prefix new tables
with `cms_` so the admin bridge and the dev server will accept them,
enable RLS, and add a public read policy only for what the site needs.

## Settings

`cms_settings` rows are jsonb. `app/lib/cms/types.ts#SiteSettings` is
the typed view; `settingsFromRows` fills in `DEFAULT_SETTINGS` for
missing keys. Reading settings on the site is `getSettings()` (cached
15 s). The admin writes them via `saveSettings()`.

## Don'ts

- Don't rename `cms_*` tables or columns that mirror WordPress; the
  importer depends on them.
- Don't make the admin visible on the published site; `isAdminShell()`
  gates it and must stay.
- Don't bypass `cms_fields` when adding editable columns — the admin
  won't render them otherwise.
