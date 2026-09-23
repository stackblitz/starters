/*
  Starter-owned tables, defaults and a default seed.

  Runs after 0001_bolt_cms_schema.sql. Every statement is a no-op on a database
  the WordPress importer already filled: tables are created if missing, settings
  rows only fill gaps, and default content is inserted only into empty tables.
*/

-- ---------------------------------------------------------------------------
-- Extra tables (not part of the importer schema)
-- ---------------------------------------------------------------------------
create table if not exists public.cms_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);

-- explicit ids below 1,000,000,000 are free for seeds and imports
create sequence if not exists public.cms_menus_id_seq start 1000000000;
create sequence if not exists public.cms_menu_items_id_seq start 1000000000;

create table if not exists public.cms_menus (
  id bigint primary key default nextval('public.cms_menus_id_seq'),
  slug text not null unique,
  name text not null,
  location text                                -- primary | footer | <custom>
);

create table if not exists public.cms_menu_items (
  id bigint primary key default nextval('public.cms_menu_items_id_seq'),
  menu_id bigint not null references public.cms_menus(id) on delete cascade,
  parent_id bigint references public.cms_menu_items(id) on delete set null,
  position integer not null default 0,
  title text not null,
  url text not null default '/',
  object_type text default 'custom',          -- post | page | category | tag | custom
  object_id bigint,
  target text default '',
  classes text default '',
  description text default ''
);

create index if not exists cms_menu_items_menu_idx on public.cms_menu_items (menu_id, position);

create table if not exists public.cms_redirects (
  from_path text primary key,
  to_path text not null,
  status integer not null default 301
);

-- ---------------------------------------------------------------------------
-- Public read access (there is no `create policy if not exists`)
-- ---------------------------------------------------------------------------
alter table public.cms_settings enable row level security;
alter table public.cms_menus enable row level security;
alter table public.cms_menu_items enable row level security;
alter table public.cms_redirects enable row level security;

do $policy$
declare
  t text;
begin
  foreach t in array array['cms_settings', 'cms_menus', 'cms_menu_items', 'cms_redirects'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_public_read'
    ) then
      execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
    end if;
  end loop;
end
$policy$;

-- ---------------------------------------------------------------------------
-- Defaults (fill gaps only; cms_settings rows override cms_site in the app)
-- ---------------------------------------------------------------------------
insert into public.cms_site (id, name, description, url, home_url, source)
  values (1, 'My Site', 'Just another site', '', null, 'starter')
  on conflict (id) do nothing;

insert into public.cms_settings (key, value) values
  ('theme', '"classic"'),
  ('show_on_front', '"posts"'),
  ('page_on_front', 'null'),
  ('page_for_posts', 'null'),
  ('posts_per_page', '10'),
  ('language', '"en-US"'),
  ('timezone', '"UTC"'),
  ('date_format', '"F j, Y"'),
  ('seo', '{"title_template":"%title% | %site_title%","description":"","og_image":null,"twitter":"","noindex":false}')
  on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Default content (only into empty tables, so an imported site is untouched)
-- ---------------------------------------------------------------------------
insert into public.cms_authors (id, name, slug, bio)
  select 1, 'Admin', 'admin', null
  where not exists (select 1 from public.cms_authors);

insert into public.cms_categories (id, name, slug, description, post_count)
  select 1, 'Uncategorized', 'uncategorized', '', 1
  where not exists (select 1 from public.cms_categories);

insert into public.cms_posts (id, title, slug, excerpt, body, content_html, status, author, categories, tags, menu_order, published_at, modified_at)
  select 1, 'Hello world!', 'hello-world', 'Welcome to your new site.',
    '[{"_type":"block","_key":"k0","style":"normal","markDefs":[],"children":[{"_type":"span","_key":"k1","text":"Welcome to your new site. This is your first post. Edit or delete it, then start writing!","marks":[]}]}]'::jsonb,
    '<p>Welcome to your new site. This is your first post. Edit or delete it, then start writing!</p>',
    'publish', 1, '{1}', '{}', 0, now(), now()
  where not exists (select 1 from public.cms_posts);

insert into public.cms_pages (id, title, slug, body, content_html, status, author, categories, tags, menu_order, published_at, modified_at)
  select 2, 'Sample Page', 'sample-page',
    '[{"_type":"block","_key":"k0","style":"normal","markDefs":[],"children":[{"_type":"span","_key":"k1","text":"This is an example page. Edit it in the Admin tab.","marks":[]}]}]'::jsonb,
    '<p>This is an example page. Edit it in the Admin tab.</p>',
    'publish', 1, '{}', '{}', 0, now(), now()
  where not exists (select 1 from public.cms_pages);

insert into public.cms_menus (id, slug, name, location)
  select 1, 'primary', 'Primary', 'primary'
  where not exists (select 1 from public.cms_menus);

insert into public.cms_menu_items (id, menu_id, position, title, url, object_type, object_id)
  select * from (values
    (1::bigint, 1::bigint, 0, 'Home', '/', 'custom', null::bigint),
    (2::bigint, 1::bigint, 1, 'Sample Page', '/sample-page', 'page', 2::bigint)
  ) v
  where not exists (select 1 from public.cms_menu_items)
    and exists (select 1 from public.cms_menus where id = 1);
