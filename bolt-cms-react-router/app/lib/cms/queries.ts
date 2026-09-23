/**
 * Public read queries for the site. Everything here runs against the anon
 * Supabase client, so RLS already restricts results to published content.
 */
import { getSupabase } from '@/lib/supabase';

import {
  settingsFromRows,
  type Author,
  type Comment,
  type Menu,
  type MenuItem,
  type MenuItemNode,
  type Post,
  type PostWithRelations,
  type Redirect,
  type SiteSettings,
  type Term,
} from './types';

const POST_SELECT = `
  *,
  author:cms_authors(*),
  featured_media:cms_media(*),
  term_links:cms_term_relationships(term:cms_terms(*))
`;

type RawPost = Post & {
  author: Author | null;
  featured_media: unknown;
  term_links: Array<{ term: Term | null }> | null;
};

function normalizePost(raw: RawPost): PostWithRelations {
  const { term_links, featured_media, ...rest } = raw;
  return {
    ...rest,
    featured_media:
      (featured_media as PostWithRelations['featured_media']) ?? null,
    terms: (term_links ?? [])
      .map((l) => l.term)
      .filter((t): t is Term => Boolean(t)),
  };
}

let settingsCache: { at: number; promise: Promise<SiteSettings> } | null = null;
const SETTINGS_TTL_MS = 15_000;

/** Settings are read by the layout and most routes; memoize briefly per navigation burst. */
export function getSettings(): Promise<SiteSettings> {
  const now = Date.now();
  if (settingsCache && now - settingsCache.at < SETTINGS_TTL_MS)
    return settingsCache.promise;
  const promise = (async () => {
    const { data, error } = await getSupabase()
      .from('cms_settings')
      .select('key, value');
    if (error) throw error;
    return settingsFromRows(data ?? []);
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
    .maybeSingle();
  if (!menu) return { menu: null, items: [] };

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

export interface ListPostsOptions {
  type?: string;
  page?: number;
  perPage?: number;
  termId?: number;
  authorId?: number;
  search?: string;
  sticky?: 'first' | 'ignore';
}

export async function listPosts(options: ListPostsOptions = {}): Promise<{
  posts: PostWithRelations[];
  total: number;
  page: number;
  pages: number;
}> {
  const supabase = getSupabase();
  const page = Math.max(1, options.page ?? 1);
  const perPage = options.perPage ?? 10;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let postIds: number[] | undefined;
  if (options.termId) {
    const { data: links } = await supabase
      .from('cms_term_relationships')
      .select('post_id')
      .eq('term_id', options.termId);
    postIds = (links ?? []).map((l) => l.post_id as number);
    if (postIds.length === 0) return { posts: [], total: 0, page, pages: 0 };
  }

  let query = supabase
    .from('cms_posts')
    .select(POST_SELECT, { count: 'exact' })
    .eq('type', options.type ?? 'post')
    .eq('status', 'publish');

  if (postIds) query = query.in('id', postIds);
  if (options.authorId) query = query.eq('author_id', options.authorId);
  if (options.search) {
    const s = options.search.replace(/[%_]/g, '');
    query = query.or(
      `title.ilike.%${s}%,content_html.ilike.%${s}%,excerpt.ilike.%${s}%`
    );
  }
  if (options.sticky === 'first')
    query = query.order('sticky', { ascending: false });

  const { data, error, count } = await query
    .order('date', { ascending: false })
    .range(from, to);
  if (error) throw error;

  const total = count ?? 0;
  return {
    posts: ((data ?? []) as unknown as RawPost[]).map(normalizePost),
    total,
    page,
    pages: Math.ceil(total / perPage),
  };
}

export async function getPostBySlug(
  type: string,
  slug: string
): Promise<PostWithRelations | null> {
  const { data, error } = await getSupabase()
    .from('cms_posts')
    .select(POST_SELECT)
    .eq('type', type)
    .eq('slug', slug)
    .eq('status', 'publish')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizePost(data as unknown as RawPost) : null;
}

export async function getPostById(
  id: number
): Promise<PostWithRelations | null> {
  const { data, error } = await getSupabase()
    .from('cms_posts')
    .select(POST_SELECT)
    .eq('id', id)
    .eq('status', 'publish')
    .maybeSingle();
  if (error) throw error;
  return data ? normalizePost(data as unknown as RawPost) : null;
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
  let parentId: number | null = null;
  let current: RawPost | null = null;

  for (const slug of segments) {
    let q = supabase
      .from('cms_posts')
      .select(POST_SELECT)
      .eq('type', 'page')
      .eq('slug', slug)
      .eq('status', 'publish');
    q =
      parentId === null ? q.is('parent_id', null) : q.eq('parent_id', parentId);
    const { data } = await q.limit(1).maybeSingle();
    if (!data) return null;
    current = data as unknown as RawPost;
    parentId = current.id;
  }

  return current ? normalizePost(current) : null;
}

export async function getTermBySlug(
  taxonomy: string,
  slug: string
): Promise<Term | null> {
  const { data } = await getSupabase()
    .from('cms_terms')
    .select('*')
    .eq('taxonomy', taxonomy)
    .eq('slug', slug)
    .maybeSingle();
  return (data as Term | null) ?? null;
}

export async function listTerms(taxonomy: string): Promise<Term[]> {
  const { data } = await getSupabase()
    .from('cms_terms')
    .select('*')
    .eq('taxonomy', taxonomy)
    .gt('count', 0)
    .order('name');
  return (data as Term[]) ?? [];
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  const { data } = await getSupabase()
    .from('cms_authors')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return (data as Author | null) ?? null;
}

export async function getComments(postId: number): Promise<Comment[]> {
  const { data } = await getSupabase()
    .from('cms_comments')
    .select('*')
    .eq('post_id', postId)
    .eq('status', 'approved')
    .order('date', { ascending: true });
  return (data as Comment[]) ?? [];
}

export async function submitComment(input: {
  post_id: number;
  parent_id?: number | null;
  author_name: string;
  author_email?: string;
  author_url?: string;
  content: string;
}): Promise<void> {
  const html = `<p>${escapeHtml(input.content)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br />')}</p>`;
  const { error } = await getSupabase()
    .from('cms_comments')
    .insert({
      post_id: input.post_id,
      parent_id: input.parent_id ?? null,
      author_name: input.author_name,
      author_email: input.author_email ?? null,
      author_url: input.author_url ?? null,
      content_html: html,
      status: 'hold',
    });
  if (error) throw error;
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
