---
name: bolt-cms
description: >-
  Work on a Bolt CMS site: a WordPress-shaped React Router + Supabase
  website with a built-in /bolt-admin edited through Bolt's Admin tab.
  Use this whenever the user asks about their imported WordPress
  content, posts, pages, authors, categories, tags, comments, menus,
  media, site settings, the admin, or the database behind the site.
---

# Bolt CMS — a WordPress-shaped site on React Router + Supabase

This project renders the schema Bolt's WordPress importer writes. URLs
and admin screens mirror WordPress so an imported site keeps working.
Keep that shape unless the user asks to change it.

## Map

```
supabase/migrations/0001_bolt_cms_schema.sql  importer schema (generated, never hand-edited)
supabase/migrations/0002_starter.sql          starter tables, default settings, seed for empty tables
app/lib/cms/                                  public-site reads (anon key), types, Portable Text, SEO
app/lib/cms/portable-text.ts                  Portable Text types, portableTextToHtml, proseMirrorToPortableText
app/routes/site/ + app/components/site/       public routes and UI
app/theme/                                    theme contract + classic / editorial / minimal
app/routes/admin/ + app/admin/                /bolt-admin (renders only inside Bolt's Admin tab)
app/admin/queries.ts                          every admin SQL statement, by name (source of truth)
.bolt/admin.json                              generated from queries.ts by `npm run manifest`
app/admin/bridge/client.ts                    bolt.hello / db.run over postMessage
app/admin/api.ts                              typed admin data access (one named query per call)
bolt-cms.json                                 `boltCmsVersion` marker used for starter upgrades
```

## Data model

| Table                                  | Owner    | Notes                                                                 |
| -------------------------------------- | -------- | --------------------------------------------------------------------- |
| `cms_site`                             | importer | single row `id = 1`: site name, description, url, home_url, `source` |
| `cms_types`, `cms_fields`              | importer | registry: one row per content type / per field (`primitive`, `options`) |
| `cms_assets`                           | importer | media; files live in the public Storage bucket `cms-media`           |
| `cms_posts`, `cms_pages`               | importer | one table per content type, same columns                              |
| `cms_authors`, `cms_categories`, `cms_tags` | importer | flat collections; `cms_categories.parent` for hierarchy         |
| `cms_comments`                         | importer | approved comments only; read-only on the site                        |
| `cms_settings`                         | starter  | key → jsonb (`theme`, `show_on_front`, `seo`, …)                      |
| `cms_menus`, `cms_menu_items`          | starter  | `location` = `primary`, `footer`, …                                   |
| `cms_redirects`                        | starter  | old WordPress paths → new paths                                       |

Column conventions on content tables:

- `id bigint` has no default (WordPress ids are kept). Admin insert
  queries use `(select coalesce(max(id), 0) + 1 from …)`.
- `body` is Portable Text `jsonb`; `content_html` is the imported
  WordPress HTML, used only when `body` is empty.
- `categories` / `tags` are `bigint[]` of `cms_categories` / `cms_tags`
  ids; `author` is a `cms_authors` id; `featured_image` is a
  `cms_assets.id` (text).
- `status` is free text: `publish`, `draft`, `trash`. Imported rows are
  `publish`; the site shows nothing else.
- There are no foreign keys between content tables; relations are
  resolved in code (`attachRelations` in `app/lib/cms/queries.ts`).
- `cms_categories.post_count` / `cms_tags.post_count` are stale import
  figures — never display them.
- `cms_products` / `cms_product_categories` (shops only) are neither
  rendered nor edited by this starter.

## Security model

- The browser only has the **anon** key; there is no server and no
  secret in the project. RLS grants anon `select` on every `cms_` table
  (`using (true)`), so drafts are readable too — the site filters to
  `status = 'publish'` in its queries. Don't store anything private in
  `cms_` tables.
- `cms_*` tables follow the safety rules in Bolt's `bolt-database`
  skill. They exist because the WordPress importer owns these tables and
  may re-run against them. One exception to that skill's "use foreign
  key constraints" advice: don't add foreign keys between importer
  tables — the importer writes rows (and parent references) in batches
  that assume none.

## Admin (`/bolt-admin`)

The admin is built on Bolt's `bolt-admin-dashboard` skill: the bridge,
the manifest rules (`readOnly`, `confirm`, `preview`, `description`),
error codes and deploy-before-use all apply as written there. This
project differs in three ways, and these take precedence:

1. **The admin already exists.** Extend it (`bolt-cms-extend`); never
   build a second dashboard or a new `/bolt-admin` route.
2. **Queries are authored in `app/admin/queries.ts`**, not in
   `.bolt/admin.json`. Apply the skill's manifest rules to the entries
   there, then run `npm run manifest` to regenerate the JSON (it also
   validates those rules; `npm run typecheck` fails when the JSON is
   stale).
3. **The client already exists** at `app/admin/bridge/client.ts` (the
   skill's client, with `runQuery` typed by `AdminQueryName` and errors
   as `BoltBridgeError`). Don't create `src/lib/bolt-admin.ts`. Screens
   read `useCanEdit()` and treat `isRejectedByUser(e)` as a cancel
   (`app/admin/hooks.ts`); all data goes through `app/admin/api.ts`.

## Working with content

- Read on the site with `app/lib/cms/queries.ts`: `listPosts`,
  `getPostBySlug`, `getPostById`, `getPageById`, `getPageByPath`,
  `listTopLevelPages`, `getTermBySlug`, `listTerms`, `getAuthorBySlug`,
  `getComments`, `getMenu`, `getSettings`. They filter to published
  rows and return `PostWithRelations` (`authorRow`, `featuredAsset`,
  `categoryTerms`, `tagTerms`).
- Render bodies with `<PostContent html={postHtml(post)} />`
  (`app/lib/cms/format.ts`): Portable Text when `body` is non-empty,
  else `content_html`; sanitized with DOMPurify. Don't
  `dangerouslySetInnerHTML` content elsewhere. If you rewrite
  `content_html` by SQL, also update or null `body`, which wins.
- Image URLs: `assetUrl(asset)` (`app/lib/cms/media.ts`) returns the
  `cms-media` `public_url`, or `original_url` when the importer could
  not copy the file (`upload_error` is set).
- URLs follow WordPress: `/:slug` for posts (date permalinks like
  `/2024/01/hello-world/` resolve by the last segment), `/parent/child`
  for pages, `/category/:slug`, `/tag/:slug`, `/author/:slug`,
  `/search?s=`, `/blog` when `show_on_front = 'page'`. The catch-all
  resolves redirects → page path → post slug. Without a `primary` menu
  the header lists top-level pages.

## Schema changes

Apply them as the `bolt-database` skill says. The two files in
`supabase/migrations/` were applied when the Bolt Database was created;
don't add more files there. New tables start with `cms_`, enable RLS,
and get a public read policy only if the site reads them. See
`bolt-cms-extend` for making a new column editable.

## Settings

`SiteSettings` (`app/lib/cms/types.ts`) merges `cms_site` (title,
tagline, url) with `cms_settings` rows; `cms_settings` wins. The site
reads it with `getSettings()` (cached 15 s, `invalidateSettings()` to
clear); the admin writes one row per key with the `upsertSetting` query
(`saveSettings()` in `app/admin/api.ts`).

## Don'ts

- Don't hand-edit `.bolt/admin.json` or `0001_bolt_cms_schema.sql`;
  both are generated.
