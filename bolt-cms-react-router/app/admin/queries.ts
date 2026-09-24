/**
 * Every SQL statement the admin may run, by name. Bolt only runs queries
 * declared in `.bolt/admin.json`, which is generated from this file by
 * `npm run manifest` — never edit the JSON by hand.
 *
 * Values always travel as `$n` parameters; the only interpolation is the
 * table name in `contentQueries`.
 */
export interface AdminQuery {
  sql: string;
  readOnly?: false;
  confirm?: true;
  preview?: string;
  description?: string;
}

/** trims and collapses whitespace so SQL can be written as indented template literals */
export function sql(
  strings: TemplateStringsArray,
  ...values: string[]
): string {
  return String.raw(strings, ...values)
    .replace(/\s+/g, ' ')
    .trim();
}

export function contentQueries(
  table: 'cms_posts' | 'cms_pages',
  word: 'post' | 'page'
) {
  return {
    list: {
      sql: sql`
        select id, title, slug, status, author, featured_image, published_at, modified_at
        from public.${table}
        where (($1::text = 'all' and status is distinct from 'trash') or status = $1::text)
          and ($2::text = '' or title ilike '%' || $2::text || '%')
        order by published_at desc nulls last, id desc
        limit $3::int offset $4::int`,
    },
    count: {
      sql: sql`select coalesce(status, 'publish') as status, count(*)::int as count from public.${table} group by 1`,
    },
    get: { sql: sql`select * from public.${table} where id = $1::bigint` },
    options: {
      sql: sql`select id, title from public.${table} where status is distinct from 'trash' order by title limit 500`,
    },
    insert: {
      readOnly: false,
      // ponytail: max(id)+1, single-writer admin; switch to a sequence if two editors ever collide
      sql: sql`
        insert into public.${table} (id, title, slug, excerpt, body, content_html, status, author, featured_image,
          categories, tags, parent, menu_order, published_at, modified_at)
        values ((select coalesce(max(id), 0) + 1 from public.${table}), $1::text, $2::text, $3::text, $4::jsonb,
          $5::text, $6::text, $7::bigint, $8::text, $9::bigint[], $10::bigint[], $11::bigint, $12::bigint,
          coalesce($13::timestamptz, now()), now())
        returning *`,
    },
    update: {
      readOnly: false,
      sql: sql`
        update public.${table} set title = $2::text, slug = $3::text, excerpt = $4::text, body = $5::jsonb,
          content_html = $6::text, status = $7::text, author = $8::bigint, featured_image = $9::text,
          categories = $10::bigint[], tags = $11::bigint[], parent = $12::bigint, menu_order = $13::bigint,
          published_at = coalesce($14::timestamptz, published_at, now()), modified_at = now()
        where id = $1::bigint
        returning *`,
    },
    setStatus: {
      readOnly: false,
      sql: sql`update public.${table} set status = $2::text, modified_at = now() where id = $1::bigint returning id, status`,
    },
    remove: {
      readOnly: false,
      confirm: true,
      preview: sql`select title from public.${table} where id = $1::bigint`,
      description: `Permanently delete the ${word} "{title}"`,
      sql: sql`delete from public.${table} where id = $1::bigint returning id`,
    },
  } satisfies Record<string, AdminQuery>;
}

const posts = contentQueries('cms_posts', 'post');
const pages = contentQueries('cms_pages', 'page');

const ASSET_COLUMNS =
  'id, kind, mime_type, filename, title, alt, caption, width, height, original_url, public_url, upload_error';

export const ADMIN_QUERIES = {
  listPosts: posts.list,
  countPosts: posts.count,
  getPost: posts.get,
  listPostOptions: posts.options,
  insertPost: posts.insert,
  updatePost: posts.update,
  setPostStatus: posts.setStatus,
  deletePost: posts.remove,

  listPages: pages.list,
  countPages: pages.count,
  getPage: pages.get,
  listPageOptions: pages.options,
  insertPage: pages.insert,
  updatePage: pages.update,
  setPageStatus: pages.setStatus,
  deletePage: pages.remove,

  listAuthors: {
    sql: sql`select id, name, slug, bio, avatar_url, url from public.cms_authors order by name limit 500`,
  },
  insertAuthor: {
    readOnly: false,
    sql: sql`
      insert into public.cms_authors (id, name, slug, bio, avatar_url, url)
      values ((select coalesce(max(id), 0) + 1 from public.cms_authors), $1::text, $2::text, $3::text, $4::text, $5::text)
      returning *`,
  },
  updateAuthor: {
    readOnly: false,
    sql: sql`
      update public.cms_authors set name = $2::text, slug = $3::text, bio = $4::text, avatar_url = $5::text, url = $6::text
      where id = $1::bigint returning *`,
  },
  deleteAuthor: {
    readOnly: false,
    confirm: true,
    preview: sql`select name from public.cms_authors where id = $1::bigint`,
    description:
      'Delete the author "{name}" (their posts stay, without an author)',
    sql: sql`delete from public.cms_authors where id = $1::bigint returning id`,
  },

  listCategories: {
    sql: sql`select id, name, slug, description, parent from public.cms_categories order by name limit 500`,
  },
  insertCategory: {
    readOnly: false,
    sql: sql`
      insert into public.cms_categories (id, name, slug, description, parent)
      values ((select coalesce(max(id), 0) + 1 from public.cms_categories), $1::text, $2::text, $3::text, $4::bigint)
      returning *`,
  },
  updateCategory: {
    readOnly: false,
    sql: sql`
      update public.cms_categories set name = $2::text, slug = $3::text, description = $4::text, parent = $5::bigint
      where id = $1::bigint returning *`,
  },
  deleteCategory: {
    readOnly: false,
    confirm: true,
    preview: sql`select name from public.cms_categories where id = $1::bigint`,
    description:
      'Delete the category "{name}" (posts keep their other categories)',
    sql: sql`delete from public.cms_categories where id = $1::bigint returning id`,
  },

  listTags: {
    sql: sql`select id, name, slug, description from public.cms_tags order by name limit 500`,
  },
  insertTag: {
    readOnly: false,
    sql: sql`
      insert into public.cms_tags (id, name, slug, description)
      values ((select coalesce(max(id), 0) + 1 from public.cms_tags), $1::text, $2::text, $3::text)
      returning *`,
  },
  updateTag: {
    readOnly: false,
    sql: sql`
      update public.cms_tags set name = $2::text, slug = $3::text, description = $4::text
      where id = $1::bigint returning *`,
  },
  deleteTag: {
    readOnly: false,
    confirm: true,
    preview: sql`select name from public.cms_tags where id = $1::bigint`,
    description: 'Delete the tag "{name}" (posts keep their other tags)',
    sql: sql`delete from public.cms_tags where id = $1::bigint returning id`,
  },

  listComments: {
    sql: sql`
      select c.id, c.post, c.parent, c.author_name, c.body, c.created_at,
        coalesce(p.title, g.title) as post_title, coalesce(p.slug, g.slug) as post_slug
      from public.cms_comments c
      left join public.cms_posts p on p.id = c.post
      left join public.cms_pages g on g.id = c.post
      order by c.created_at desc nulls last, c.id desc
      limit $1::int offset $2::int`,
  },
  countComments: {
    sql: sql`select count(*)::int as count from public.cms_comments`,
  },
  deleteComment: {
    readOnly: false,
    confirm: true,
    preview: sql`select coalesce(author_name, 'an anonymous visitor') as author_name from public.cms_comments where id = $1::bigint`,
    description: 'Delete the comment by {author_name}',
    sql: sql`delete from public.cms_comments where id = $1::bigint returning id`,
  },

  listAssets: {
    sql: sql`
      select ${ASSET_COLUMNS} from public.cms_assets
      where $1::text = '' or filename ilike '%' || $1::text || '%' or title ilike '%' || $1::text || '%'
      order by imported_at desc, id
      limit $2::int offset $3::int`,
  },
  countAssets: {
    sql: sql`
      select count(*)::int as count from public.cms_assets
      where $1::text = '' or filename ilike '%' || $1::text || '%' or title ilike '%' || $1::text || '%'`,
  },
  getAsset: {
    sql: sql`select ${ASSET_COLUMNS} from public.cms_assets where id = $1::text`,
  },
  updateAsset: {
    readOnly: false,
    sql: sql`update public.cms_assets set title = $2::text, alt = $3::text, caption = $4::text where id = $1::text returning id`,
  },

  listSettings: { sql: sql`select key, value from public.cms_settings` },
  getSite: {
    sql: sql`select name, description, url, home_url, source from public.cms_site where id = 1`,
  },
  upsertSetting: {
    readOnly: false,
    sql: sql`
      insert into public.cms_settings (key, value) values ($1::text, $2::jsonb)
      on conflict (key) do update set value = excluded.value, updated_at = now()
      returning key`,
  },

  listMenus: {
    sql: sql`select id, slug, name, location from public.cms_menus order by name`,
  },
  insertMenu: {
    readOnly: false,
    sql: sql`insert into public.cms_menus (name, slug, location) values ($1::text, $2::text, $3::text) returning *`,
  },
  updateMenuLocation: {
    readOnly: false,
    sql: sql`update public.cms_menus set location = $2::text where id = $1::bigint returning *`,
  },
  deleteMenu: {
    readOnly: false,
    confirm: true,
    preview: sql`select name from public.cms_menus where id = $1::bigint`,
    description: 'Delete the "{name}" menu and all its links',
    sql: sql`delete from public.cms_menus where id = $1::bigint returning id`,
  },
  listMenuItems: {
    sql: sql`select * from public.cms_menu_items where menu_id = $1::bigint order by position, id`,
  },
  insertMenuItem: {
    readOnly: false,
    sql: sql`
      insert into public.cms_menu_items (menu_id, parent_id, position, title, url, object_type, object_id, target, classes, description)
      values ($1::bigint, $2::bigint, $3::int, $4::text, $5::text, $6::text, $7::bigint, $8::text, $9::text, $10::text)
      returning *`,
  },
  updateMenuItem: {
    readOnly: false,
    sql: sql`
      update public.cms_menu_items set parent_id = $2::bigint, position = $3::int, title = $4::text, url = $5::text,
        object_type = $6::text, object_id = $7::bigint, target = $8::text, classes = $9::text, description = $10::text
      where id = $1::bigint returning *`,
  },
  // no confirm: routine menu saves delete and recreate items
  deleteMenuItem: {
    readOnly: false,
    sql: sql`delete from public.cms_menu_items where id = $1::bigint returning id`,
  },

  listFields: {
    sql: sql`
      select type_name, name, title, primitive, column_name, required, description, options, position
      from public.cms_fields where type_name = $1::text order by position`,
  },
} satisfies Record<string, AdminQuery>;

export type AdminQueryName = keyof typeof ADMIN_QUERIES;
