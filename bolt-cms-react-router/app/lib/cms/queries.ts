/**
 * Public read queries for the site. Everything here runs against the anon
 * Supabase client, so RLS already restricts results to what may be public.
 * Content tables have no foreign keys, so references (author, featured image,
 * categories, tags) are hydrated with `in()` lookups in `attachRelations`.
 */
import { getSupabase } from '@/lib/supabase';

import {
  mergeSettings,
  TERM_TABLE,
  type Asset,
  type Author,
  type Comment,
  type ContentTable,
  type Menu,
  type MenuItem,
  type MenuItemNode,
  type Post,
  type PostWithRelations,
  type Redirect,
  type SiteRow,
  type SiteSettings,
  type Term,
  type TermKind,
} from './types';

let settingsCache: { at: number; promise: Promise<SiteSettings> } | null = null;
const SETTINGS_TTL_MS = 15_000;

/** Settings are read by the layout and most routes; memoize briefly per navigation burst. */
export function getSettings(): Promise<SiteSettings> {
  const now = Date.now();
  if (settingsCache && now - settingsCache.at < SETTINGS_TTL_MS)
    return settingsCache.promise;
  const promise = (async () => {
    const supabase = getSupabase();
    const [settings, site] = await Promise.all([
      supabase.from('cms_settings').select('key, value'),
      supabase
        .from('cms_site')
        .select('name, description, url, home_url, source')
        .eq('id', 1)
        .maybeSingle(),
    ]);
    if (settings.error) throw settings.error;
    if (site.error) throw site.error;
    return mergeSettings(settings.data ?? [], site.data as SiteRow | null);
  })();
  settingsCache = { at: now, promise };
  promise.catch(() => {
    settingsCache = null;
  });
  return promise;
}

export function invalidateSettings() {
  settingsCache = null;
}

export async function getMenu(location: string): Promise<{
  menu: Menu | null;
  items: MenuItemNode[];
}> {
  const supabase = getSupabase();
  const { data: menu } = await supabase
    .from('cms_menus')
    .select('*')
    .eq('location', location)
    .limit(1)
    .maybeSingle();
  if (!menu) {
    if (location !== 'primary') return { menu: null, items: [] };
    // No primary menu yet: behave like WordPress' page-list fallback.
    const pages = await listTopLevelPages();
    return {
      menu: null,
      items: pages.map((p, i) => ({
        id: p.id,
        menu_id: 0,
        parent_id: null,
        position: i,
        title: p.title,
        url: `/${p.slug}`,
        object_type: 'page',
        object_id: p.id,
        target: '',
        classes: '',
        description: '',
        children: [],
      })),
    };
  }

  const { data: items } = await supabase
    .from('cms_menu_items')
    .select('*')
    .eq('menu_id', menu.id)
    .order('position', { ascending: true });

  return { menu, items: buildMenuTree(items ?? []) };
}

export function buildMenuTree(items: MenuItem[]): MenuItemNode[] {
  const byId = new Map<number, MenuItemNode>();
  for (const item of items) byId.set(item.id, { ...item, children: [] });
  const roots: MenuItemNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (nodes: MenuItemNode[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

async function byId<T extends { id: number | string }>(
  table: string,
  ids: Array<number | string>
): Promise<Map<number | string, T>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await getSupabase()
    .from(table)
    .select('*')
    .in('id', ids);
  if (error) throw error;
  return new Map(((data ?? []) as T[]).map((row) => [row.id, row]));
}

/** Resolve author, featured image and terms for a batch of posts/pages. Missing ids are dropped. */
export async function attachRelations(
  rows: Post[]
): Promise<PostWithRelations[]> {
  const posts = rows.map((p) => ({
    ...p,
    categories: p.categories ?? [],
    tags: p.tags ?? [],
  }));
  const distinct = <V>(pick: (p: Post) => V[]) => [
    ...new Set(posts.flatMap(pick)),
  ];
  const [authors, assets, categories, tags] = await Promise.all([
    byId<Author>(
      'cms_authors',
      distinct((p) => (p.author ? [p.author] : []))
    ),
    byId<Asset>(
      'cms_assets',
      distinct((p) => (p.featured_image ? [p.featured_image] : []))
    ),
    byId<Term>(
      TERM_TABLE.category,
      distinct((p) => p.categories)
    ),
    byId<Term>(
      TERM_TABLE.tag,
      distinct((p) => p.tags)
    ),
  ]);
  return posts.map((p) => ({
    ...p,
    authorRow: (p.author && authors.get(p.author)) || null,
    featuredAsset: (p.featured_image && assets.get(p.featured_image)) || null,
    categoryTerms: p.categories.flatMap((id) => categories.get(id) ?? []),
    tagTerms: p.tags.flatMap((id) => tags.get(id) ?? []),
  }));
}

export interface ListPostsOptions {
  table?: ContentTable;
  categoryId?: number;
  tagId?: number;
  authorId?: number;
  search?: string;
  page?: number;
  perPage?: number;
}

export async function listPosts(options: ListPostsOptions = {}): Promise<{
  posts: PostWithRelations[];
  total: number;
  page: number;
  pages: number;
}> {
  const page = Math.max(1, options.page ?? 1);
  const perPage = options.perPage ?? 10;
  const from = (page - 1) * perPage;

  let query = getSupabase()
    .from(options.table ?? 'cms_posts')
    .select('*', { count: 'exact' })
    .eq('status', 'publish');
  if (options.categoryId)
    query = query.contains('categories', [options.categoryId]);
  if (options.tagId) query = query.contains('tags', [options.tagId]);
  if (options.authorId) query = query.eq('author', options.authorId);
  if (options.search) {
    // strip LIKE wildcards and PostgREST `or()` syntax characters
    const s = options.search.replace(/[%_,()]/g, '');
    query = query.or(
      `title.ilike.%${s}%,excerpt.ilike.%${s}%,content_html.ilike.%${s}%`
    );
  }

  const { data, error, count } = await query
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(from, from + perPage - 1);
  if (error) throw error;

  const total = count ?? 0;
  return {
    posts: await attachRelations((data ?? []) as Post[]),
    total,
    page,
    pages: Math.ceil(total / perPage),
  };
}

async function getPublished(
  table: ContentTable,
  column: 'id' | 'slug',
  value: number | string
): Promise<PostWithRelations | null> {
  const { data, error } = await getSupabase()
    .from(table)
    .select('*')
    .eq(column, value)
    .eq('status', 'publish')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (await attachRelations([data as Post]))[0] : null;
}

export function getPostBySlug(slug: string) {
  return getPublished('cms_posts', 'slug', slug);
}

export function getPostById(id: number) {
  return getPublished('cms_posts', 'id', id);
}

export function getPageById(id: number) {
  return getPublished('cms_pages', 'id', id);
}

/**
 * Resolve a hierarchical page path (`about/team`) the way WordPress does:
 * each segment is a slug whose parent is the previous segment's page.
 */
export async function getPageByPath(
  segments: string[]
): Promise<PostWithRelations | null> {
  if (segments.length === 0) return null;
  const supabase = getSupabase();
  let current: Post | null = null;

  for (const slug of segments) {
    let q = supabase
      .from('cms_pages')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'publish');
    q = current ? q.eq('parent', current.id) : q.is('parent', null);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    current = data as Post;
  }

  return current ? (await attachRelations([current]))[0] : null;
}

export async function listTopLevelPages(): Promise<
  Array<Pick<Post, 'id' | 'title' | 'slug'>>
> {
  const { data, error } = await getSupabase()
    .from('cms_pages')
    .select('id, title, slug')
    .eq('status', 'publish')
    .is('parent', null)
    .order('menu_order', { ascending: true, nullsFirst: false })
    .order('title')
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function getTermBySlug(
  kind: TermKind,
  slug: string
): Promise<Term | null> {
  const { data } = await getSupabase()
    .from(TERM_TABLE[kind])
    .select('*')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle();
  return (data as Term | null) ?? null;
}

/** `post_count` is a stale import figure; never display it. */
export async function listTerms(kind: TermKind): Promise<Term[]> {
  const { data } = await getSupabase()
    .from(TERM_TABLE[kind])
    .select('*')
    .order('name');
  return (data as Term[]) ?? [];
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  const { data } = await getSupabase()
    .from('cms_authors')
    .select('*')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle();
  return (data as Author | null) ?? null;
}

export async function getComments(postId: number): Promise<Comment[]> {
  const { data } = await getSupabase()
    .from('cms_comments')
    .select('*')
    .eq('post', postId)
    .order('created_at', { ascending: true });
  return (data as Comment[]) ?? [];
}

export async function getRedirect(path: string): Promise<Redirect | null> {
  const { data } = await getSupabase()
    .from('cms_redirects')
    .select('*')
    .in('from_path', uniquePathVariants(path))
    .limit(1)
    .maybeSingle();
  return (data as Redirect | null) ?? null;
}

/** `/a/b/`, `/a/b` and `a/b` should all match the same redirect row. */
export function uniquePathVariants(path: string): string[] {
  const trimmed = '/' + path.replace(/^\/+|\/+$/g, '');
  return Array.from(
    new Set([trimmed, trimmed + '/', trimmed.replace(/^\//, '')])
  );
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
