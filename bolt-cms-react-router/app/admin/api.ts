/**
 * Typed data access for the admin, built on the bridge client. Every function
 * here maps to one or more `CmsOp`s; nothing talks to Supabase directly.
 */
import type {
  Author,
  Comment,
  CommentStatus,
  FieldDef,
  Media,
  Menu,
  MenuItem,
  Post,
  PostStatus,
  SiteSettings,
  Term,
} from '@/lib/cms/types';
import { settingsFromRows } from '@/lib/cms/types';

import { cms, type CmsResult } from './bridge/client';
import type { Filter, Order, Row } from './bridge/protocol';

/* ------------------------------------------------------------------------ */
/* Generic rows                                                              */
/* ------------------------------------------------------------------------ */

export interface ListOptions {
  columns?: string;
  filters?: Filter[];
  order?: Order[];
  page?: number;
  perPage?: number;
  count?: boolean;
}

export async function listRows<T = Row>(
  table: string,
  options: ListOptions = {}
): Promise<CmsResult<T[]>> {
  const perPage = options.perPage ?? 20;
  const page = Math.max(1, options.page ?? 1);
  const range = options.perPage
    ? { from: (page - 1) * perPage, to: page * perPage - 1 }
    : undefined;
  return cms.request<T[]>({
    kind: 'select',
    table,
    columns: options.columns,
    filters: options.filters,
    order: options.order,
    range,
    count: options.count,
  });
}

export async function getRow<T = Row>(
  table: string,
  id: number | string,
  columns = '*'
): Promise<T | null> {
  const { data } = await cms.request<T | null>({
    kind: 'select',
    table,
    columns,
    filters: [{ column: 'id', op: 'eq', value: id }],
    single: true,
  });
  return data;
}

export async function insertRow<T = Row>(
  table: string,
  values: Row
): Promise<T> {
  const { data } = await cms.request<T[]>({ kind: 'insert', table, values });
  return data[0];
}

export async function updateRow<T = Row>(
  table: string,
  id: number | string,
  values: Row
): Promise<T> {
  const { data } = await cms.request<T[]>({
    kind: 'update',
    table,
    values,
    filters: [{ column: 'id', op: 'eq', value: id }],
  });
  return data[0];
}

export async function deleteRow(
  table: string,
  id: number | string
): Promise<void> {
  await cms.request({
    kind: 'delete',
    table,
    filters: [{ column: 'id', op: 'eq', value: id }],
  });
}

export async function hello(): Promise<{ host: string; version: number }> {
  const { data } = await cms.request<{ host: string; version: number }>({
    kind: 'hello',
  });
  return data;
}

/* ------------------------------------------------------------------------ */
/* Fields                                                                    */
/* ------------------------------------------------------------------------ */

export async function getFields(table: string): Promise<FieldDef[]> {
  const { data } = await listRows<FieldDef>('cms_fields', {
    filters: [{ column: 'table_name', op: 'eq', value: table }],
    order: [{ column: 'position' }],
  });
  return data;
}

/* ------------------------------------------------------------------------ */
/* Content (cms_posts)                                                       */
/* ------------------------------------------------------------------------ */

export const POST_ADMIN_SELECT =
  '*, author:cms_authors(id, name), featured_media:cms_media(id, local_path, source_url, alt_text)';

export type AdminPost = Post & {
  author: Pick<Author, 'id' | 'name'> | null;
  featured_media: Pick<
    Media,
    'id' | 'local_path' | 'source_url' | 'alt_text'
  > | null;
};

export interface ListContentOptions {
  type: string;
  status?: PostStatus | 'all';
  search?: string;
  page?: number;
  perPage?: number;
}

export async function listContent(
  options: ListContentOptions
): Promise<CmsResult<AdminPost[]>> {
  const filters: Filter[] = [{ column: 'type', op: 'eq', value: options.type }];
  if (options.status && options.status !== 'all')
    filters.push({ column: 'status', op: 'eq', value: options.status });
  else filters.push({ column: 'status', op: 'neq', value: 'trash' });
  if (options.search)
    filters.push({
      column: 'title',
      op: 'ilike',
      value: `%${options.search}%`,
    });

  return listRows<AdminPost>('cms_posts', {
    columns: POST_ADMIN_SELECT,
    filters,
    order: [{ column: 'date', ascending: false }],
    page: options.page,
    perPage: options.perPage ?? 20,
    count: true,
  });
}

export async function getPost(id: number): Promise<Post | null> {
  return getRow<Post>('cms_posts', id);
}

export async function savePost(
  values: Partial<Post> & { type: string },
  id?: number
): Promise<Post> {
  const row: Row = { ...values };
  delete row.id;
  if (id) return updateRow<Post>('cms_posts', id, row);
  return insertRow<Post>('cms_posts', row);
}

export async function setPostStatus(
  id: number,
  status: PostStatus
): Promise<void> {
  await updateRow('cms_posts', id, { status });
}

export async function deletePostPermanently(id: number): Promise<void> {
  await deleteRow('cms_posts', id);
}

export interface PostTypeCount {
  type: string;
  status: PostStatus;
  count: number;
}

export async function getPostTypeCounts(): Promise<PostTypeCount[]> {
  const { data } = await listRows<PostTypeCount>('cms_post_type_counts');
  return data;
}

export function summarizeTypes(
  counts: PostTypeCount[]
): Array<{ type: string; total: number; byStatus: Record<string, number> }> {
  const map = new Map<
    string,
    { type: string; total: number; byStatus: Record<string, number> }
  >();
  for (const c of counts) {
    const entry = map.get(c.type) ?? { type: c.type, total: 0, byStatus: {} };
    entry.byStatus[c.status] = (entry.byStatus[c.status] ?? 0) + c.count;
    if (c.status !== 'trash') entry.total += c.count;
    map.set(c.type, entry);
  }
  // Posts, then pages, then everything else alphabetically.
  const order = (t: string) => (t === 'post' ? 0 : t === 'page' ? 1 : 2);
  return Array.from(map.values()).sort(
    (a, b) => order(a.type) - order(b.type) || a.type.localeCompare(b.type)
  );
}

/* ------------------------------------------------------------------------ */
/* Terms                                                                     */
/* ------------------------------------------------------------------------ */

export async function listTerms(taxonomy: string): Promise<Term[]> {
  const { data } = await listRows<Term>('cms_terms', {
    filters: [{ column: 'taxonomy', op: 'eq', value: taxonomy }],
    order: [{ column: 'name' }],
  });
  return data;
}

export async function getTaxonomies(): Promise<
  Array<{ taxonomy: string; count: number }>
> {
  const { data } = await listRows<{ taxonomy: string; count: number }>(
    'cms_taxonomy_counts'
  );
  const order = (t: string) =>
    t === 'category' ? 0 : t === 'post_tag' ? 1 : 2;
  return data.sort(
    (a, b) =>
      order(a.taxonomy) - order(b.taxonomy) ||
      a.taxonomy.localeCompare(b.taxonomy)
  );
}

export async function getPostTermIds(postId: number): Promise<number[]> {
  const { data } = await listRows<{ term_id: number }>(
    'cms_term_relationships',
    {
      columns: 'term_id',
      filters: [{ column: 'post_id', op: 'eq', value: postId }],
    }
  );
  return data.map((r) => r.term_id);
}

/** Replace a post's terms within the given taxonomy's term ids. */
export async function setPostTerms(
  postId: number,
  taxonomyTermIds: number[],
  nextIds: number[]
): Promise<void> {
  const current = await getPostTermIds(postId);
  const inTaxonomy = new Set(taxonomyTermIds);
  const currentInTax = current.filter((id) => inTaxonomy.has(id));
  const toRemove = currentInTax.filter((id) => !nextIds.includes(id));
  const toAdd = nextIds.filter((id) => !currentInTax.includes(id));

  if (toRemove.length) {
    await cms.request({
      kind: 'delete',
      table: 'cms_term_relationships',
      filters: [
        { column: 'post_id', op: 'eq', value: postId },
        { column: 'term_id', op: 'in', value: toRemove },
      ],
    });
  }
  if (toAdd.length) {
    await cms.request({
      kind: 'insert',
      table: 'cms_term_relationships',
      values: toAdd.map((term_id) => ({ post_id: postId, term_id })),
    });
  }
}

export async function saveTerm(
  values: Partial<Term> & { taxonomy: string },
  id?: number
): Promise<Term> {
  const row: Row = { ...values };
  delete row.id;
  delete row.count;
  if (id) return updateRow<Term>('cms_terms', id, row);
  return insertRow<Term>('cms_terms', row);
}

/* ------------------------------------------------------------------------ */
/* Media                                                                     */
/* ------------------------------------------------------------------------ */

export async function listMedia(
  options: { page?: number; perPage?: number; search?: string } = {}
): Promise<CmsResult<Media[]>> {
  const filters: Filter[] = [];
  if (options.search)
    filters.push({
      column: 'title',
      op: 'ilike',
      value: `%${options.search}%`,
    });
  return listRows<Media>('cms_media', {
    filters,
    order: [{ column: 'date', ascending: false }],
    page: options.page,
    perPage: options.perPage ?? 40,
    count: true,
  });
}

export async function uploadMedia(file: File): Promise<Media> {
  const dataBase64 = await fileToBase64(file);
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const path = `${yyyy}/${mm}/${Date.now().toString(36)}-${safeName}`;

  const { data } = await cms.request<{ url: string }>({
    kind: 'upload',
    path,
    contentType: file.type,
    dataBase64,
  });

  const dims = file.type.startsWith('image/')
    ? await imageDimensions(file)
    : null;

  return insertRow<Media>('cms_media', {
    slug: safeName.replace(/\.[^.]+$/, '').toLowerCase(),
    title: file.name.replace(/\.[^.]+$/, ''),
    mime_type: file.type,
    media_type: file.type.startsWith('image/') ? 'image' : 'file',
    local_path: data.url,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function imageDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/* ------------------------------------------------------------------------ */
/* Comments                                                                  */
/* ------------------------------------------------------------------------ */

export type AdminComment = Comment & {
  post: Pick<Post, 'id' | 'title' | 'slug'> | null;
};

export async function listComments(
  options: {
    status?: CommentStatus | 'all';
    page?: number;
    perPage?: number;
  } = {}
) {
  const filters: Filter[] = [];
  if (options.status && options.status !== 'all')
    filters.push({ column: 'status', op: 'eq', value: options.status });
  return listRows<AdminComment>('cms_comments', {
    columns: '*, post:cms_posts(id, title, slug)',
    filters,
    order: [{ column: 'date', ascending: false }],
    page: options.page,
    perPage: options.perPage ?? 20,
    count: true,
  });
}

export async function getCommentCounts(): Promise<Record<string, number>> {
  const { data } = await listRows<{ status: CommentStatus }>('cms_comments', {
    columns: 'status',
  });
  const counts: Record<string, number> = {};
  for (const c of data) counts[c.status] = (counts[c.status] ?? 0) + 1;
  return counts;
}

/* ------------------------------------------------------------------------ */
/* Menus                                                                     */
/* ------------------------------------------------------------------------ */

export async function listMenus(): Promise<Menu[]> {
  const { data } = await listRows<Menu>('cms_menus', {
    order: [{ column: 'name' }],
  });
  return data;
}

export async function listMenuItems(menuId: number): Promise<MenuItem[]> {
  const { data } = await listRows<MenuItem>('cms_menu_items', {
    filters: [{ column: 'menu_id', op: 'eq', value: menuId }],
    order: [{ column: 'position' }],
  });
  return data;
}

export async function saveMenuItems(items: MenuItem[]): Promise<void> {
  if (!items.length) return;
  await cms.request({
    kind: 'upsert',
    table: 'cms_menu_items',
    values: items.map((i) => ({ ...i })),
    onConflict: 'id',
  });
}

/* ------------------------------------------------------------------------ */
/* Settings                                                                  */
/* ------------------------------------------------------------------------ */

export async function getAdminSettings(): Promise<SiteSettings> {
  const { data } = await listRows<{ key: string; value: unknown }>(
    'cms_settings',
    { columns: 'key, value' }
  );
  return settingsFromRows(data);
}

export async function saveSettings(
  values: Partial<Record<keyof SiteSettings, unknown>>
): Promise<void> {
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: value ?? null,
  }));
  if (!rows.length) return;
  await cms.request({
    kind: 'upsert',
    table: 'cms_settings',
    values: rows,
    onConflict: 'key',
  });
}

/* ------------------------------------------------------------------------ */
/* Authors                                                                   */
/* ------------------------------------------------------------------------ */

export async function listAuthors(): Promise<Author[]> {
  const { data } = await listRows<Author>('cms_authors', {
    order: [{ column: 'name' }],
  });
  return data;
}
