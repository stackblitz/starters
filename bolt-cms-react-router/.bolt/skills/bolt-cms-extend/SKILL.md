---
name: bolt-cms-extend
description: >-
  Extend a Bolt CMS site's content model: add a custom post type,
  custom taxonomy, editable field, or a new table imported from a
  WordPress plugin (e.g. WooCommerce products). Use whenever the user
  wants the admin to edit something it does not yet show.
---

# Extending the content model

The admin is data-driven. Types and taxonomies are discovered from the
data; editor forms are described by rows in `cms_fields`. Most
extensions are SQL only.

## Custom post type (WordPress CPT)

Custom types share `cms_posts`; the `type` column is free text.

1. Insert or import rows with `type = 'portfolio'` (any slug-safe
   name). The admin sidebar shows **Portfolio** as soon as one row
   exists (via `cms_post_type_counts`).
2. Optional public route: add
   `route('portfolio/:slug', 'routes/site/portfolio.tsx')` in
   `app/routes.ts` and load with `getPostBySlug('portfolio', slug)`.
   Without a route, the catch-all resolves `/:slug` for `post` only.
3. Optional taxonomy: see below. Taxonomies named
   `<type>_<something>` (e.g. `portfolio_category`) automatically appear
   in that type's editor; so do non-core taxonomies with no prefix.

## Custom taxonomy

Insert `cms_terms` rows with `taxonomy = 'genre'`. The admin lists it
under **Taxonomies**. Hierarchical behavior follows whether any term
has a `parent_id`; `category`-style checklists and `post_tag`-style
chips are chosen by `taxonomiesForType()` in `app/admin/labels.ts`
(edit it to force one mode).

## Editable field

The editor renders one input per `cms_fields` row for the table:

```sql
insert into cms_fields (table_name, column_name, label, type, options, group_name, position)
values ('cms_posts', 'subtitle', 'Subtitle', 'string', '{}', 'main', 3);
```

Field `type` is one of: `string`, `text`, `richtext`, `number`,
`boolean`, `date`, `datetime`, `image`, `file`, `reference`, `array`,
`object`, `slug`, `select`, `json`. `group_name` is `main`, `sidebar`,
`seo`, or `advanced`. `position` orders within the group.

`options` by type:

- `string`/`text`: `{"required": true, "rows": 3, "readonly": true}`
- `slug`: `{"from": "title"}` — auto-fills from that column
- `richtext`: `{"json_column": "content_json"}` — where editor JSON is stored
- `select`: `{"choices": ["a", "b"]}` or `{"choices": [{"value": "a", "label": "A"}]}`
- `reference`: `{"table": "cms_authors", "label": "name", "same_type": true}`
- `image`/`file`: `{"value": "id"}` (default, stores `cms_media.id`) or `{"value": "url"}`
- `object`: `{"fields": [{"key": "title", "label": "Title", "type": "string"}, …]}`
- `array`: `{"item": {"type": "string"}}`

Real columns need a migration:

```sql
alter table cms_posts add column if not exists subtitle text;
```

For per-post extras without a column, use `cms_post_meta`
(`post_id, key, value jsonb`) and read it with
`getPostBySlug(...)?.meta`.

## Plugin data (e.g. WooCommerce)

Plugin tables get their own `cms_` table so imports stay deterministic:

1. Migration: `create table cms_products (id bigint primary key, …)`
   mirroring the plugin's REST shape (`wc/v3/products` → `name`,
   `slug`, `price`, `images jsonb`, …). Enable RLS; add a public read
   policy for the published/visible subset.
2. `cms_fields` rows for `cms_products` so the admin can edit it. The
   generic admin list/edit screens work for any `cms_` table that has
   `id`, `title`-like and `status`-like columns; otherwise add a route
   under `app/routes/admin/` following `content-list.tsx`.
3. Public routes in `app/routes.ts` plus a query helper in
   `app/lib/cms/`.

## Rules

- Tables must start with `cms_`; the host bridge rejects others.
- Always `enable row level security` and grant anon only what the
  public site reads.
- Preserve WordPress ids when importing; sequences start at 1e9.
- New migrations go in a new numbered file; do not edit applied ones.
