---
name: bolt-cms-extend
description: >-
  Extend a Bolt CMS site's content model: add an editable field to posts
  or pages, make an imported custom post type editable in the admin, or
  add a site-specific table. Use whenever the user wants the admin to
  edit something it does not yet show.
---

# Extending the content model

Three places describe a field; all three must agree:

1. **The column** on the content table (`cms_posts`, `cms_pages`, …).
2. **The registry row** in `cms_fields` — the admin editor picks the
   input from its `primitive` and `options`.
3. **The admin queries** in `app/admin/queries.ts` — Bolt only runs SQL
   declared in `.bolt/admin.json`, which `npm run manifest` generates
   from that file.

Apply schema changes as Bolt's `bolt-database` skill says, and write
queries by the manifest rules of its `bolt-admin-dashboard` skill — but
in `app/admin/queries.ts`, never in `.bolt/admin.json` (generated;
`npm run typecheck` fails with "`.bolt/admin.json` is stale — run
`npm run manifest`" when it doesn't match `queries.ts`).

## Add a field to posts (or pages)

1. Migration (idempotent):

   ```sql
   alter table public.cms_posts add column if not exists subtitle text;
   insert into public.cms_fields (type_name, name, title, primitive, column_name, required, description, options, position)
   values ('post', 'subtitle', 'Subtitle', 'string', 'subtitle', false, null, '{}', 20)
   on conflict (type_name, name) do nothing;
   ```

   Repeat for `cms_pages` / `type_name = 'page'` if pages need it.
2. `app/admin/queries.ts` → `contentQueries(table, word)`: add the
   column to `insert` (next `$n`, e.g. `$14::text`) and `update` (e.g.
   `$15::text`). Both post and page queries come from this one function,
   so the column must exist on both tables — otherwise give the new
   column its own query instead.
3. `app/admin/api.ts`: add the property to `ContentInput` and append it
   to `contentParams` in the same `$n` order.
4. `app/routes/admin/content-edit.tsx`: add the field name to
   `FIELD_LAYOUT.main` or `FIELD_LAYOUT.sidebar`, and include it when
   building the `ContentInput` on save.
5. `npm run manifest`, then publish — Bolt reads `.bolt/admin.json` from
   the deployed revision.
6. To show it on the site, read it from the `Post` row (add it to the
   `Post` interface in `app/lib/cms/types.ts`).

### `primitive` and `options`

`FieldInput` (`app/admin/components/fields/FieldInput.tsx`) renders:

| `primitive`          | Input                                   | `options`                                   |
| -------------------- | --------------------------------------- | ------------------------------------------- |
| `string`             | text (textarea for `excerpt`, `bio`, `description`) | —                              |
| `slug`               | slug input that follows `title`/`name`  | —                                           |
| `number`             | number input, empty → `null`            | `{"integer": true}`                         |
| `boolean`            | checkbox                                | —                                           |
| `date` / `datetime`  | date / datetime-local (stored ISO)      | —                                           |
| `image` / `file`     | media picker storing `cms_assets.id`    | —                                           |
| `reference`          | select over another type                | `{"to": ["author"]}` (`author`, `category`, `tag`, `post`, `page`) |
| `array` of reference | checklist (`bigint[]` column)           | `{"of": {"primitive": "reference", "to": ["category"]}}` |
| `array` of block     | rich-text editor (Portable Text `jsonb`) | `{"of": {"primitive": "block"}}`           |
| other `array`/`object` | JSON input                            | —                                           |

Parameter casts in the SQL follow the client's conventions: scalars as
`$n::text|bigint|int|boolean`, `bigint[]` via `pgArray(ids)` →
`$n::bigint[]`, `jsonb` via `JSON.stringify(value)` → `$n::jsonb`,
timestamps as ISO strings → `$n::timestamptz`.

## Make an imported custom post type editable

The importer writes custom post types (e.g. `portfolio`) to their own
table (`select name, table_name from public.cms_types`) with
`cms_fields` rows; the site and admin ignore them until you wire them
up. For a table with the same columns as `cms_posts`:

1. `app/admin/queries.ts`: widen the `contentQueries` table/word
   unions, then spread it into `ADMIN_QUERIES` under new keys:

   ```ts
   const portfolio = contentQueries('cms_portfolio', 'project');
   // in ADMIN_QUERIES:
   listPortfolio: portfolio.list, countPortfolio: portfolio.count, getPortfolio: portfolio.get,
   listPortfolioOptions: portfolio.options, insertPortfolio: portfolio.insert, updatePortfolio: portfolio.update,
   setPortfolioStatus: portfolio.setStatus, deletePortfolio: portfolio.remove,
   ```
2. `app/admin/api.ts`: add the type to `ContentType`, `isContentType`,
   and `CONTENT_TYPES` (label, singular, table, the eight query names);
   add the table to `ContentTable` in `app/lib/cms/types.ts`.
3. Add a sidebar link to `content/<type>` in
   `app/routes/admin/layout.tsx`.
4. Optional public route in `app/routes.ts` plus a read helper in
   `app/lib/cms/queries.ts`.
5. `npm run manifest`, publish.

Different columns → write its eight queries by hand following the
`contentQueries` shape.

## Site-specific tables

- Prefix with `cms_`, create with `if not exists`, `enable row level
  security`, and add a public read policy only if the site reads it
  (wrap `create policy` in a `do $$ … if not exists (select 1 from
  pg_policies …) … $$` block, as `0002_starter.sql` does).
- For admin editing, add named queries to `app/admin/queries.ts`
  following the `bolt-admin-dashboard` manifest rules, then
  `npm run manifest`, publish.
- `cms_*` tables the importer owns follow the `bolt-database` safety
  rules.
