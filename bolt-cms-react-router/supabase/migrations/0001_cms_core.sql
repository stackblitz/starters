/*
  # Bolt CMS core schema

  WordPress-shaped content tables for a site imported from WordPress. Table
  and column names mirror the WordPress REST API (wp/v2 endpoints) so an import is
  a near 1:1 mapping, and WordPress ids are preserved as primary keys.

  ## Tables
  - `cms_settings`            key/value, mirrors `wp_options` + `wp/v2/settings`
  - `cms_authors`             `wp/v2/users`
  - `cms_media`               `wp/v2/media` (files are copied into `public/wp-content/uploads`)
  - `cms_posts`               `wp/v2/posts`, `wp/v2/pages`, and any custom post type (`type` column)
  - `cms_post_meta`           post meta (ACF / plugin fields), key -> jsonb
  - `cms_terms`               categories, tags, and custom taxonomies (`taxonomy` column)
  - `cms_term_relationships`  post <-> term
  - `cms_comments`            `wp/v2/comments`
  - `cms_menus` / `cms_menu_items`
  - `cms_redirects`           old path -> new path, so imported permalinks keep working
  - `cms_fields`              admin form metadata: how each column renders (primitive type)

  ## Security
  - RLS enabled everywhere.
  - `anon` may read published content only. All writes go through the Bolt
    host (service role); the only anonymous write is inserting a comment,
    which is forced into `hold` status for moderation.

  ## Conventions
  - Core `cms_` tables and their seeded columns are relied on by the site and
    the admin. Add columns and tables; do not drop or rename these.
  - Ids for rows created after import come from sequences starting at
    1,000,000,000 so they never collide with imported WordPress ids.
*/

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table if not exists cms_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Authors
-- ---------------------------------------------------------------------------
create sequence if not exists cms_authors_id_seq start 1000000000;

create table if not exists cms_authors (
  id bigint primary key default nextval('cms_authors_id_seq'),
  slug text not null unique,
  name text not null,
  email text,
  url text,
  description text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------
create sequence if not exists cms_media_id_seq start 1000000000;

create table if not exists cms_media (
  id bigint primary key default nextval('cms_media_id_seq'),
  slug text,
  title text,
  alt_text text default '',
  caption text default '',
  description text default '',
  mime_type text,
  media_type text default 'image',            -- image | file
  source_url text,                            -- original WordPress URL
  local_path text,                            -- /wp-content/uploads/... inside this project
  width integer,
  height integer,
  sizes jsonb default '{}'::jsonb,            -- WordPress media_details.sizes
  author_id bigint references cms_authors(id) on delete set null,
  date timestamptz not null default now(),
  modified timestamptz not null default now()
);

create index if not exists cms_media_date_idx on cms_media (date desc);

-- ---------------------------------------------------------------------------
-- Posts (posts, pages, custom post types)
-- ---------------------------------------------------------------------------
create sequence if not exists cms_posts_id_seq start 1000000000;

create table if not exists cms_posts (
  id bigint primary key default nextval('cms_posts_id_seq'),
  type text not null default 'post',          -- post | page | <custom>
  status text not null default 'draft',       -- publish | draft | pending | private | future | trash
  slug text not null,
  title text not null default '',
  excerpt text default '',
  content_html text default '',               -- rendered HTML (WordPress `content.rendered`)
  content_json jsonb,                         -- editor document (Tiptap / ProseMirror JSON)
  author_id bigint references cms_authors(id) on delete set null,
  featured_media_id bigint references cms_media(id) on delete set null,
  parent_id bigint references cms_posts(id) on delete set null,
  menu_order integer not null default 0,
  date timestamptz not null default now(),
  modified timestamptz not null default now(),
  comment_status text not null default 'open', -- open | closed
  sticky boolean not null default false,
  format text default 'standard',
  template text default '',
  seo jsonb not null default '{}'::jsonb,     -- { title, description, og_image, canonical, noindex }
  constraint cms_posts_status_check check (status in ('publish','draft','pending','private','future','trash'))
);

create unique index if not exists cms_posts_type_slug_parent_idx
  on cms_posts (type, slug, coalesce(parent_id, 0));
create index if not exists cms_posts_type_status_date_idx on cms_posts (type, status, date desc);
create index if not exists cms_posts_author_idx on cms_posts (author_id);
create index if not exists cms_posts_parent_idx on cms_posts (parent_id);

create table if not exists cms_post_meta (
  post_id bigint not null references cms_posts(id) on delete cascade,
  key text not null,
  value jsonb,
  primary key (post_id, key)
);

-- ---------------------------------------------------------------------------
-- Terms (categories, tags, custom taxonomies)
-- ---------------------------------------------------------------------------
create sequence if not exists cms_terms_id_seq start 1000000000;

create table if not exists cms_terms (
  id bigint primary key default nextval('cms_terms_id_seq'),
  taxonomy text not null default 'category', -- category | post_tag | <custom>
  name text not null,
  slug text not null,
  description text default '',
  parent_id bigint references cms_terms(id) on delete set null,
  count integer not null default 0,
  unique (taxonomy, slug)
);

create index if not exists cms_terms_taxonomy_idx on cms_terms (taxonomy);

create table if not exists cms_term_relationships (
  post_id bigint not null references cms_posts(id) on delete cascade,
  term_id bigint not null references cms_terms(id) on delete cascade,
  term_order integer not null default 0,
  primary key (post_id, term_id)
);

create index if not exists cms_term_relationships_term_idx on cms_term_relationships (term_id);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
create sequence if not exists cms_comments_id_seq start 1000000000;

create table if not exists cms_comments (
  id bigint primary key default nextval('cms_comments_id_seq'),
  post_id bigint not null references cms_posts(id) on delete cascade,
  parent_id bigint references cms_comments(id) on delete set null,
  author_id bigint references cms_authors(id) on delete set null,
  author_name text not null default '',
  author_email text,
  author_url text,
  author_avatar_url text,
  content_html text not null default '',
  status text not null default 'hold',       -- approved | hold | spam | trash
  type text not null default 'comment',
  date timestamptz not null default now(),
  constraint cms_comments_status_check check (status in ('approved','hold','spam','trash'))
);

create index if not exists cms_comments_post_status_idx on cms_comments (post_id, status, date);

-- ---------------------------------------------------------------------------
-- Menus
-- ---------------------------------------------------------------------------
create sequence if not exists cms_menus_id_seq start 1000000000;
create sequence if not exists cms_menu_items_id_seq start 1000000000;

create table if not exists cms_menus (
  id bigint primary key default nextval('cms_menus_id_seq'),
  slug text not null unique,
  name text not null,
  location text                                -- primary | footer | <custom>
);

create table if not exists cms_menu_items (
  id bigint primary key default nextval('cms_menu_items_id_seq'),
  menu_id bigint not null references cms_menus(id) on delete cascade,
  parent_id bigint references cms_menu_items(id) on delete set null,
  position integer not null default 0,
  title text not null,
  url text not null default '/',
  object_type text default 'custom',          -- post | page | category | post_tag | custom
  object_id bigint,
  target text default '',
  classes text default '',
  description text default ''
);

create index if not exists cms_menu_items_menu_idx on cms_menu_items (menu_id, position);

-- ---------------------------------------------------------------------------
-- Redirects
-- ---------------------------------------------------------------------------
create table if not exists cms_redirects (
  from_path text primary key,
  to_path text not null,
  status integer not null default 301
);

-- ---------------------------------------------------------------------------
-- Admin field metadata
-- ---------------------------------------------------------------------------
create table if not exists cms_fields (
  table_name text not null,
  column_name text not null,
  label text not null,
  -- string | text | richtext | number | boolean | date | datetime | image | file
  -- | reference | array | object | slug | select | json
  type text not null,
  options jsonb not null default '{}'::jsonb, -- per-type: { choices, reference: { table, label }, readonly, help }
  group_name text not null default 'main',    -- main | sidebar | seo | advanced
  position integer not null default 0,
  primary key (table_name, column_name)
);

-- ---------------------------------------------------------------------------
-- Discovery views (used by the admin to list post types and taxonomies,
-- including ones added by an import or the agent). `security_invoker` keeps
-- RLS of the querying role in effect.
-- ---------------------------------------------------------------------------
create or replace view cms_post_type_counts with (security_invoker = true) as
  select type, status, count(*)::int as count
  from cms_posts
  group by type, status;

create or replace view cms_taxonomy_counts with (security_invoker = true) as
  select taxonomy, count(*)::int as count
  from cms_terms
  group by taxonomy;

-- ---------------------------------------------------------------------------
-- updated_at / modified maintenance
-- ---------------------------------------------------------------------------
create or replace function cms_touch_modified()
returns trigger
language plpgsql
as $$
begin
  if to_jsonb(new) ? 'modified' then
    new.modified = now();
  end if;
  if to_jsonb(new) ? 'updated_at' then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists cms_posts_touch on cms_posts;
create trigger cms_posts_touch before update on cms_posts
  for each row execute function cms_touch_modified();

drop trigger if exists cms_media_touch on cms_media;
create trigger cms_media_touch before update on cms_media
  for each row execute function cms_touch_modified();

drop trigger if exists cms_settings_touch on cms_settings;
create trigger cms_settings_touch before update on cms_settings
  for each row execute function cms_touch_modified();

-- Keep cms_terms.count in sync with relationships.
create or replace function cms_sync_term_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update cms_terms set count = count + 1 where id = new.term_id;
  elsif tg_op = 'DELETE' then
    update cms_terms set count = greatest(count - 1, 0) where id = old.term_id;
  end if;
  return null;
end;
$$;

drop trigger if exists cms_term_relationships_count on cms_term_relationships;
create trigger cms_term_relationships_count
  after insert or delete on cms_term_relationships
  for each row execute function cms_sync_term_count();

-- Anonymous comments always land in moderation.
create or replace function cms_force_comment_hold()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'anon'
     or current_setting('request.jwt.claim.role', true) = 'anon'
     or coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'anon' then
    new.status = 'hold';
    new.author_id = null;
  end if;
  return new;
end;
$$;

drop trigger if exists cms_comments_force_hold on cms_comments;
create trigger cms_comments_force_hold before insert on cms_comments
  for each row execute function cms_force_comment_hold();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table cms_settings enable row level security;
alter table cms_authors enable row level security;
alter table cms_media enable row level security;
alter table cms_posts enable row level security;
alter table cms_post_meta enable row level security;
alter table cms_terms enable row level security;
alter table cms_term_relationships enable row level security;
alter table cms_comments enable row level security;
alter table cms_menus enable row level security;
alter table cms_menu_items enable row level security;
alter table cms_redirects enable row level security;
alter table cms_fields enable row level security;

-- Public, read-only reference data.
create policy "Public can read settings" on cms_settings
  for select to anon, authenticated using (true);

create policy "Public can read authors" on cms_authors
  for select to anon, authenticated using (true);

create policy "Public can read media" on cms_media
  for select to anon, authenticated using (true);

create policy "Public can read terms" on cms_terms
  for select to anon, authenticated using (true);

create policy "Public can read menus" on cms_menus
  for select to anon, authenticated using (true);

create policy "Public can read menu items" on cms_menu_items
  for select to anon, authenticated using (true);

create policy "Public can read redirects" on cms_redirects
  for select to anon, authenticated using (true);

create policy "Public can read field metadata" on cms_fields
  for select to anon, authenticated using (true);

-- Published content only.
create policy "Public can read published posts" on cms_posts
  for select to anon, authenticated
  using (status = 'publish' and type <> 'revision');

create policy "Public can read meta of published posts" on cms_post_meta
  for select to anon, authenticated
  using (exists (
    select 1 from cms_posts p where p.id = cms_post_meta.post_id and p.status = 'publish'
  ));

create policy "Public can read term relationships of published posts" on cms_term_relationships
  for select to anon, authenticated
  using (exists (
    select 1 from cms_posts p where p.id = cms_term_relationships.post_id and p.status = 'publish'
  ));

create policy "Public can read approved comments" on cms_comments
  for select to anon, authenticated
  using (status = 'approved' and exists (
    select 1 from cms_posts p where p.id = cms_comments.post_id and p.status = 'publish'
  ));

-- The only anonymous write: submit a comment on an open, published post.
-- Comments must land in moderation (the trigger above also forces this).
create policy "Public can submit comments" on cms_comments
  for insert to anon, authenticated
  with check (
    status = 'hold'
    and author_id is null
    and exists (
      select 1 from cms_posts p
      where p.id = cms_comments.post_id
        and p.status = 'publish'
        and p.comment_status = 'open'
    )
    and coalesce((select (value)::boolean from cms_settings where key = 'comments_enabled'), false)
  );
