-- Generated from Bolt's WordPress importer schema (core tables + author,
-- category, tag, post, page, comment). Idempotent: the importer creates the
-- same objects. Do not edit by hand.

create table if not exists public.cms_site (
  id smallint primary key default 1 check (id = 1),
  name text not null,
  description text,
  url text not null,
  home_url text,
  source text not null default 'wordpress',
  imported_at timestamptz not null default now()
);

create table if not exists public.cms_types (
  name text primary key,
  title text not null,
  table_name text not null unique,
  source jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_fields (
  type_name text not null references public.cms_types (name) on delete cascade,
  name text not null,
  title text not null,
  primitive text not null check (primitive in ('string', 'number', 'boolean', 'date', 'datetime', 'image', 'file', 'reference', 'array', 'object', 'block', 'slug')),
  column_name text not null,
  required boolean not null default false,
  description text,
  options jsonb not null default '{}'::jsonb,
  position integer not null,
  primary key (type_name, name)
);

create table if not exists public.cms_assets (
  id text primary key,
  kind text not null check (kind in ('image', 'file')),
  mime_type text,
  filename text not null,
  title text,
  alt text,
  caption text,
  width integer,
  height integer,
  size_bytes bigint,
  original_url text not null,
  url_keys text[] not null default '{}',
  storage_path text not null,
  public_url text not null,
  uploaded_at timestamptz,
  upload_error text,
  imported_at timestamptz not null default now()
);

create index if not exists cms_assets_url_keys_idx on public.cms_assets using gin (url_keys);


alter table public."cms_site" enable row level security;
grant select on public."cms_site" to anon, authenticated;
do $policy$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cms_site' and policyname = 'cms_site_public_read'
  ) then
    create policy "cms_site_public_read" on public."cms_site" for select to anon, authenticated using (true);
  end if;
end
$policy$;

alter table public."cms_types" enable row level security;
grant select on public."cms_types" to anon, authenticated;
do $policy$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cms_types' and policyname = 'cms_types_public_read'
  ) then
    create policy "cms_types_public_read" on public."cms_types" for select to anon, authenticated using (true);
  end if;
end
$policy$;

alter table public."cms_fields" enable row level security;
grant select on public."cms_fields" to anon, authenticated;
do $policy$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cms_fields' and policyname = 'cms_fields_public_read'
  ) then
    create policy "cms_fields_public_read" on public."cms_fields" for select to anon, authenticated using (true);
  end if;
end
$policy$;

alter table public."cms_assets" enable row level security;
grant select on public."cms_assets" to anon, authenticated;
do $policy$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cms_assets' and policyname = 'cms_assets_public_read'
  ) then
    create policy "cms_assets_public_read" on public."cms_assets" for select to anon, authenticated using (true);
  end if;
end
$policy$;

create table if not exists public."cms_authors" (
  id bigint primary key,
  raw jsonb,
  imported_at timestamptz not null default now()
);
alter table public."cms_authors"
  add column if not exists "name" text,
  add column if not exists "slug" text,
  add column if not exists "bio" text,
  add column if not exists "avatar_url" text,
  add column if not exists "url" text;
create index if not exists "cms_authors_slug_idx" on public."cms_authors" ("slug");
comment on table public."cms_authors" is 'Bolt CMS: Authors';
comment on column public."cms_authors"."name" is 'Name (string)';
comment on column public."cms_authors"."slug" is 'Slug (slug)';
comment on column public."cms_authors"."bio" is 'Bio (string)';
comment on column public."cms_authors"."avatar_url" is 'Avatar URL (string)';
comment on column public."cms_authors"."url" is 'Profile URL (string)';

alter table public."cms_authors" enable row level security;
grant select on public."cms_authors" to anon, authenticated;
do $policy$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cms_authors' and policyname = 'cms_authors_public_read'
  ) then
    create policy "cms_authors_public_read" on public."cms_authors" for select to anon, authenticated using (true);
  end if;
end
$policy$;

create table if not exists public."cms_categories" (
  id bigint primary key,
  raw jsonb,
  imported_at timestamptz not null default now()
);
alter table public."cms_categories"
  add column if not exists "name" text,
  add column if not exists "slug" text,
  add column if not exists "description" text,
  add column if not exists "parent" bigint,
  add column if not exists "post_count" bigint;
create index if not exists "cms_categories_slug_idx" on public."cms_categories" ("slug");
create index if not exists "cms_categories_parent_idx" on public."cms_categories" ("parent");
comment on table public."cms_categories" is 'Bolt CMS: Categories';
comment on column public."cms_categories"."name" is 'Name (string)';
comment on column public."cms_categories"."slug" is 'Slug (slug)';
comment on column public."cms_categories"."description" is 'Description (string)';
comment on column public."cms_categories"."parent" is 'Parent category (reference to category)';
comment on column public."cms_categories"."post_count" is 'Post count (number)';

alter table public."cms_categories" enable row level security;
grant select on public."cms_categories" to anon, authenticated;
do $policy$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cms_categories' and policyname = 'cms_categories_public_read'
  ) then
    create policy "cms_categories_public_read" on public."cms_categories" for select to anon, authenticated using (true);
  end if;
end
$policy$;

create table if not exists public."cms_tags" (
  id bigint primary key,
  raw jsonb,
  imported_at timestamptz not null default now()
);
alter table public."cms_tags"
  add column if not exists "name" text,
  add column if not exists "slug" text,
  add column if not exists "description" text,
  add column if not exists "post_count" bigint;
create index if not exists "cms_tags_slug_idx" on public."cms_tags" ("slug");
comment on table public."cms_tags" is 'Bolt CMS: Tags';
comment on column public."cms_tags"."name" is 'Name (string)';
comment on column public."cms_tags"."slug" is 'Slug (slug)';
comment on column public."cms_tags"."description" is 'Description (string)';
comment on column public."cms_tags"."post_count" is 'Post count (number)';

alter table public."cms_tags" enable row level security;
grant select on public."cms_tags" to anon, authenticated;
do $policy$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cms_tags' and policyname = 'cms_tags_public_read'
  ) then
    create policy "cms_tags_public_read" on public."cms_tags" for select to anon, authenticated using (true);
  end if;
end
$policy$;

create table if not exists public."cms_posts" (
  id bigint primary key,
  raw jsonb,
  imported_at timestamptz not null default now()
);
alter table public."cms_posts"
  add column if not exists "title" text,
  add column if not exists "slug" text,
  add column if not exists "excerpt" text,
  add column if not exists "body" jsonb,
  add column if not exists "content_html" text,
  add column if not exists "status" text,
  add column if not exists "author" bigint,
  add column if not exists "featured_image" text,
  add column if not exists "categories" bigint[],
  add column if not exists "tags" bigint[],
  add column if not exists "parent" bigint,
  add column if not exists "menu_order" bigint,
  add column if not exists "link" text,
  add column if not exists "published_at" timestamptz,
  add column if not exists "modified_at" timestamptz;
create index if not exists "cms_posts_slug_idx" on public."cms_posts" ("slug");
create index if not exists "cms_posts_author_idx" on public."cms_posts" ("author");
create index if not exists "cms_posts_categories_idx" on public."cms_posts" using gin ("categories");
create index if not exists "cms_posts_tags_idx" on public."cms_posts" using gin ("tags");
create index if not exists "cms_posts_parent_idx" on public."cms_posts" ("parent");
create index if not exists "cms_posts_published_at_idx" on public."cms_posts" ("published_at");
create index if not exists "cms_posts_modified_at_idx" on public."cms_posts" ("modified_at");
comment on table public."cms_posts" is 'Bolt CMS: Posts';
comment on column public."cms_posts"."title" is 'Title (string)';
comment on column public."cms_posts"."slug" is 'Slug (slug)';
comment on column public."cms_posts"."excerpt" is 'Excerpt (string)';
comment on column public."cms_posts"."body" is 'Body (array of Portable Text block)';
comment on column public."cms_posts"."content_html" is 'Original HTML (string)';
comment on column public."cms_posts"."status" is 'Status (string)';
comment on column public."cms_posts"."author" is 'Author (reference to author)';
comment on column public."cms_posts"."featured_image" is 'Featured image (image: cms_assets.id)';
comment on column public."cms_posts"."categories" is 'Categories (array of reference to category)';
comment on column public."cms_posts"."tags" is 'Tags (array of reference to tag)';
comment on column public."cms_posts"."parent" is 'Parent (reference to post)';
comment on column public."cms_posts"."menu_order" is 'Menu order (number)';
comment on column public."cms_posts"."link" is 'Original URL (string)';
comment on column public."cms_posts"."published_at" is 'Published at (datetime)';
comment on column public."cms_posts"."modified_at" is 'Modified at (datetime)';

alter table public."cms_posts" enable row level security;
grant select on public."cms_posts" to anon, authenticated;
do $policy$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cms_posts' and policyname = 'cms_posts_public_read'
  ) then
    create policy "cms_posts_public_read" on public."cms_posts" for select to anon, authenticated using (true);
  end if;
end
$policy$;

create table if not exists public."cms_pages" (
  id bigint primary key,
  raw jsonb,
  imported_at timestamptz not null default now()
);
alter table public."cms_pages"
  add column if not exists "title" text,
  add column if not exists "slug" text,
  add column if not exists "excerpt" text,
  add column if not exists "body" jsonb,
  add column if not exists "content_html" text,
  add column if not exists "status" text,
  add column if not exists "author" bigint,
  add column if not exists "featured_image" text,
  add column if not exists "categories" bigint[],
  add column if not exists "tags" bigint[],
  add column if not exists "parent" bigint,
  add column if not exists "menu_order" bigint,
  add column if not exists "link" text,
  add column if not exists "published_at" timestamptz,
  add column if not exists "modified_at" timestamptz;
create index if not exists "cms_pages_slug_idx" on public."cms_pages" ("slug");
create index if not exists "cms_pages_author_idx" on public."cms_pages" ("author");
create index if not exists "cms_pages_categories_idx" on public."cms_pages" using gin ("categories");
create index if not exists "cms_pages_tags_idx" on public."cms_pages" using gin ("tags");
create index if not exists "cms_pages_parent_idx" on public."cms_pages" ("parent");
create index if not exists "cms_pages_published_at_idx" on public."cms_pages" ("published_at");
create index if not exists "cms_pages_modified_at_idx" on public."cms_pages" ("modified_at");
comment on table public."cms_pages" is 'Bolt CMS: Pages';
comment on column public."cms_pages"."title" is 'Title (string)';
comment on column public."cms_pages"."slug" is 'Slug (slug)';
comment on column public."cms_pages"."excerpt" is 'Excerpt (string)';
comment on column public."cms_pages"."body" is 'Body (array of Portable Text block)';
comment on column public."cms_pages"."content_html" is 'Original HTML (string)';
comment on column public."cms_pages"."status" is 'Status (string)';
comment on column public."cms_pages"."author" is 'Author (reference to author)';
comment on column public."cms_pages"."featured_image" is 'Featured image (image: cms_assets.id)';
comment on column public."cms_pages"."categories" is 'Categories (array of reference to category)';
comment on column public."cms_pages"."tags" is 'Tags (array of reference to tag)';
comment on column public."cms_pages"."parent" is 'Parent (reference to page)';
comment on column public."cms_pages"."menu_order" is 'Menu order (number)';
comment on column public."cms_pages"."link" is 'Original URL (string)';
comment on column public."cms_pages"."published_at" is 'Published at (datetime)';
comment on column public."cms_pages"."modified_at" is 'Modified at (datetime)';

alter table public."cms_pages" enable row level security;
grant select on public."cms_pages" to anon, authenticated;
do $policy$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cms_pages' and policyname = 'cms_pages_public_read'
  ) then
    create policy "cms_pages_public_read" on public."cms_pages" for select to anon, authenticated using (true);
  end if;
end
$policy$;

create table if not exists public."cms_comments" (
  id bigint primary key,
  raw jsonb,
  imported_at timestamptz not null default now()
);
alter table public."cms_comments"
  add column if not exists "post" bigint,
  add column if not exists "parent" bigint,
  add column if not exists "author_name" text,
  add column if not exists "body" jsonb,
  add column if not exists "created_at" timestamptz,
  add column if not exists "link" text;
create index if not exists "cms_comments_post_idx" on public."cms_comments" ("post");
create index if not exists "cms_comments_parent_idx" on public."cms_comments" ("parent");
create index if not exists "cms_comments_created_at_idx" on public."cms_comments" ("created_at");
comment on table public."cms_comments" is 'Bolt CMS: Comments';
comment on column public."cms_comments"."post" is 'Post (reference to post | page)';
comment on column public."cms_comments"."parent" is 'Reply to (reference to comment)';
comment on column public."cms_comments"."author_name" is 'Author name (string)';
comment on column public."cms_comments"."body" is 'Body (array of Portable Text block)';
comment on column public."cms_comments"."created_at" is 'Created at (datetime)';
comment on column public."cms_comments"."link" is 'Original URL (string)';

alter table public."cms_comments" enable row level security;
grant select on public."cms_comments" to anon, authenticated;
do $policy$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cms_comments' and policyname = 'cms_comments_public_read'
  ) then
    create policy "cms_comments_public_read" on public."cms_comments" for select to anon, authenticated using (true);
  end if;
end
$policy$;

insert into public."cms_types" ("name", "title", "table_name", "source")
select "name", "title", "table_name", "source" from jsonb_populate_recordset(null::public."cms_types", $cms_b477d0c39ff3$[{"name":"author","title":"Authors","table_name":"cms_authors","source":{"route":"wp/v2/users"}},{"name":"category","title":"Categories","table_name":"cms_categories","source":{"route":"wp/v2/categories"}},{"name":"tag","title":"Tags","table_name":"cms_tags","source":{"route":"wp/v2/tags"}},{"name":"post","title":"Posts","table_name":"cms_posts","source":{"postType":"post","route":"wp/v2/posts"}},{"name":"page","title":"Pages","table_name":"cms_pages","source":{"postType":"page","route":"wp/v2/pages"}},{"name":"comment","title":"Comments","table_name":"cms_comments","source":{"route":"wp/v2/comments"}}]$cms_b477d0c39ff3$::jsonb)
on conflict ("name") do update set "title" = excluded."title", "table_name" = excluded."table_name", "source" = excluded."source", "updated_at" = now();

insert into public."cms_fields" ("type_name", "name", "title", "primitive", "column_name", "required", "description", "options", "position")
select "type_name", "name", "title", "primitive", "column_name", "required", "description", "options", "position" from jsonb_populate_recordset(null::public."cms_fields", $cms_8e50a3fda6a4$[{"type_name":"author","name":"name","title":"Name","primitive":"string","column_name":"name","required":true,"description":null,"options":{},"position":0},{"type_name":"author","name":"slug","title":"Slug","primitive":"slug","column_name":"slug","required":true,"description":null,"options":{},"position":1},{"type_name":"author","name":"bio","title":"Bio","primitive":"string","column_name":"bio","required":false,"description":null,"options":{},"position":2},{"type_name":"author","name":"avatar_url","title":"Avatar URL","primitive":"string","column_name":"avatar_url","required":false,"description":null,"options":{},"position":3},{"type_name":"author","name":"url","title":"Profile URL","primitive":"string","column_name":"url","required":false,"description":null,"options":{},"position":4},{"type_name":"category","name":"name","title":"Name","primitive":"string","column_name":"name","required":true,"description":null,"options":{},"position":0},{"type_name":"category","name":"slug","title":"Slug","primitive":"slug","column_name":"slug","required":true,"description":null,"options":{},"position":1},{"type_name":"category","name":"description","title":"Description","primitive":"string","column_name":"description","required":false,"description":null,"options":{},"position":2},{"type_name":"category","name":"parent","title":"Parent category","primitive":"reference","column_name":"parent","required":false,"description":null,"options":{"to":["category"]},"position":3},{"type_name":"category","name":"post_count","title":"Post count","primitive":"number","column_name":"post_count","required":false,"description":null,"options":{"integer":true},"position":4},{"type_name":"tag","name":"name","title":"Name","primitive":"string","column_name":"name","required":true,"description":null,"options":{},"position":0},{"type_name":"tag","name":"slug","title":"Slug","primitive":"slug","column_name":"slug","required":true,"description":null,"options":{},"position":1},{"type_name":"tag","name":"description","title":"Description","primitive":"string","column_name":"description","required":false,"description":null,"options":{},"position":2},{"type_name":"tag","name":"post_count","title":"Post count","primitive":"number","column_name":"post_count","required":false,"description":null,"options":{"integer":true},"position":3},{"type_name":"post","name":"title","title":"Title","primitive":"string","column_name":"title","required":true,"description":null,"options":{},"position":0},{"type_name":"post","name":"slug","title":"Slug","primitive":"slug","column_name":"slug","required":true,"description":null,"options":{},"position":1},{"type_name":"post","name":"excerpt","title":"Excerpt","primitive":"string","column_name":"excerpt","required":false,"description":null,"options":{},"position":2},{"type_name":"post","name":"body","title":"Body","primitive":"array","column_name":"body","required":false,"description":null,"options":{"of":{"primitive":"block"}},"position":3},{"type_name":"post","name":"content_html","title":"Original HTML","primitive":"string","column_name":"content_html","required":false,"description":"The rendered WordPress HTML, kept as a fallback","options":{},"position":4},{"type_name":"post","name":"status","title":"Status","primitive":"string","column_name":"status","required":false,"description":null,"options":{},"position":5},{"type_name":"post","name":"author","title":"Author","primitive":"reference","column_name":"author","required":false,"description":null,"options":{"to":["author"]},"position":6},{"type_name":"post","name":"featured_image","title":"Featured image","primitive":"image","column_name":"featured_image","required":false,"description":null,"options":{},"position":7},{"type_name":"post","name":"categories","title":"Categories","primitive":"array","column_name":"categories","required":false,"description":null,"options":{"of":{"primitive":"reference","to":["category"]}},"position":8},{"type_name":"post","name":"tags","title":"Tags","primitive":"array","column_name":"tags","required":false,"description":null,"options":{"of":{"primitive":"reference","to":["tag"]}},"position":9},{"type_name":"post","name":"parent","title":"Parent","primitive":"reference","column_name":"parent","required":false,"description":null,"options":{"to":["post"]},"position":10},{"type_name":"post","name":"menu_order","title":"Menu order","primitive":"number","column_name":"menu_order","required":false,"description":null,"options":{"integer":true},"position":11},{"type_name":"post","name":"link","title":"Original URL","primitive":"string","column_name":"link","required":false,"description":null,"options":{},"position":12},{"type_name":"post","name":"published_at","title":"Published at","primitive":"datetime","column_name":"published_at","required":false,"description":null,"options":{},"position":13},{"type_name":"post","name":"modified_at","title":"Modified at","primitive":"datetime","column_name":"modified_at","required":false,"description":null,"options":{},"position":14},{"type_name":"page","name":"title","title":"Title","primitive":"string","column_name":"title","required":true,"description":null,"options":{},"position":0},{"type_name":"page","name":"slug","title":"Slug","primitive":"slug","column_name":"slug","required":true,"description":null,"options":{},"position":1},{"type_name":"page","name":"excerpt","title":"Excerpt","primitive":"string","column_name":"excerpt","required":false,"description":null,"options":{},"position":2},{"type_name":"page","name":"body","title":"Body","primitive":"array","column_name":"body","required":false,"description":null,"options":{"of":{"primitive":"block"}},"position":3},{"type_name":"page","name":"content_html","title":"Original HTML","primitive":"string","column_name":"content_html","required":false,"description":"The rendered WordPress HTML, kept as a fallback","options":{},"position":4},{"type_name":"page","name":"status","title":"Status","primitive":"string","column_name":"status","required":false,"description":null,"options":{},"position":5},{"type_name":"page","name":"author","title":"Author","primitive":"reference","column_name":"author","required":false,"description":null,"options":{"to":["author"]},"position":6},{"type_name":"page","name":"featured_image","title":"Featured image","primitive":"image","column_name":"featured_image","required":false,"description":null,"options":{},"position":7},{"type_name":"page","name":"categories","title":"Categories","primitive":"array","column_name":"categories","required":false,"description":null,"options":{"of":{"primitive":"reference","to":["category"]}},"position":8},{"type_name":"page","name":"tags","title":"Tags","primitive":"array","column_name":"tags","required":false,"description":null,"options":{"of":{"primitive":"reference","to":["tag"]}},"position":9},{"type_name":"page","name":"parent","title":"Parent","primitive":"reference","column_name":"parent","required":false,"description":null,"options":{"to":["page"]},"position":10},{"type_name":"page","name":"menu_order","title":"Menu order","primitive":"number","column_name":"menu_order","required":false,"description":null,"options":{"integer":true},"position":11},{"type_name":"page","name":"link","title":"Original URL","primitive":"string","column_name":"link","required":false,"description":null,"options":{},"position":12},{"type_name":"page","name":"published_at","title":"Published at","primitive":"datetime","column_name":"published_at","required":false,"description":null,"options":{},"position":13},{"type_name":"page","name":"modified_at","title":"Modified at","primitive":"datetime","column_name":"modified_at","required":false,"description":null,"options":{},"position":14},{"type_name":"comment","name":"post","title":"Post","primitive":"reference","column_name":"post","required":true,"description":null,"options":{"to":["post","page"]},"position":0},{"type_name":"comment","name":"parent","title":"Reply to","primitive":"reference","column_name":"parent","required":false,"description":null,"options":{"to":["comment"]},"position":1},{"type_name":"comment","name":"author_name","title":"Author name","primitive":"string","column_name":"author_name","required":false,"description":null,"options":{},"position":2},{"type_name":"comment","name":"body","title":"Body","primitive":"array","column_name":"body","required":false,"description":null,"options":{"of":{"primitive":"block"}},"position":3},{"type_name":"comment","name":"created_at","title":"Created at","primitive":"datetime","column_name":"created_at","required":false,"description":null,"options":{},"position":4},{"type_name":"comment","name":"link","title":"Original URL","primitive":"string","column_name":"link","required":false,"description":null,"options":{},"position":5}]$cms_8e50a3fda6a4$::jsonb)
on conflict ("type_name", "name") do update set "title" = excluded."title", "primitive" = excluded."primitive", "column_name" = excluded."column_name", "required" = excluded."required", "description" = excluded."description", "options" = excluded."options", "position" = excluded."position";
