/**
 * Typed data access for the admin. Every function runs one named query from
 * `./queries.ts` through Bolt's bridge; nothing talks to Supabase directly.
 *
 * Parameter conventions: scalars as-is (`null` allowed), `bigint[]` via
 * `pgArray`, `jsonb` via `JSON.stringify`, timestamps as ISO strings.
 */
import type { PortableTextBlock } from '@/lib/cms/portable-text';
import {
  mergeSettings,
  type Asset,
  type Author,
  type Comment,
  type ContentTable,
  type FieldDef,
  type Menu,
  type MenuItem,
  type Post,
  type SiteRow,
  type SiteSettings,
  type Term,
} from '@/lib/cms/types';

import { pgArray, runQuery } from './bridge/client';
import type { AdminQueryName } from './queries';

/* ------------------------------------------------------------------------ */
/* Posts and pages                                                           */
/* ------------------------------------------------------------------------ */

export type ContentType = 'post' | 'page';

type ContentQuery = 'list' | 'count' | 'get' | 'insert' | 'update' | 'setStatus' | 'remove' | 'options';

export const CONTENT_TYPES: Record<
  ContentType,
  { label: string; singular: string; table: ContentTable; queries: Record<ContentQuery, AdminQueryName> }
> = {
  post: {
    label: 'Posts',
    singular: 'post',
    table: 'cms_posts',
    queries: {
      list: 'listPosts',
      count: 'countPosts',
      get: 'getPost',
      insert: 'insertPost',
      update: 'updatePost',
      setStatus: 'setPostStatus',
      remove: 'deletePost',
      options: 'listPostOptions',
    },
  },
  page: {
    label: 'Pages',
    singular: 'page',
    table: 'cms_pages',
    queries: {
      list: 'listPages',
      count: 'countPages',
      get: 'getPage',
      insert: 'insertPage',
      update: 'updatePage',
      setStatus: 'setPageStatus',
      remove: 'deletePage',
      options: 'listPageOptions',
    },
  },
};

export function isContentType(value: string | undefined): value is ContentType {
  return value === 'post' || value === 'page';
}

/** Bolt stores the WordPress status as free text; imported rows are `publish`. */
export const STATUSES = ['publish', 'draft', 'trash'] as const;

export interface ContentInput {
  title: string;
  slug: string;
  excerpt: string | null;
  body: PortableTextBlock[] | null;
  content_html: string | null;
  status: string;
  author: number | null;
  featured_image: string | null;
  categories: number[];
  tags: number[];
  parent: number | null;
  menu_order: number | null;
  published_at: string | null;
}

export type ContentListRow = Pick<
  Post,
  'id' | 'title' | 'slug' | 'status' | 'author' | 'featured_image' | 'published_at' | 'modified_at'
>;

export interface ContentOption {
  id: number;
  title: string;
}

/** imported rows may carry null arrays */
function normalizePost(row: Post): Post {
  return { ...row, categories: row.categories ?? [], tags: row.tags ?? [] };
}

function contentParams(input: ContentInput) {
  return [
    input.title,
    input.slug,
    input.excerpt,
    input.body === null ? null : JSON.stringify(input.body),
    input.content_html,
    input.status,
    input.author,
    input.featured_image,
    pgArray(input.categories),
    pgArray(input.tags),
    input.parent,
    input.menu_order,
    input.published_at,
  ];
}

export function listContent(
  type: ContentType,
  { status = 'all', search = '', page = 1, perPage = 20 }: { status?: string; search?: string; page?: number; perPage?: number } = {}
) {
  return runQuery<ContentListRow>(CONTENT_TYPES[type].queries.list, [status, search, perPage, (page - 1) * perPage]);
}

export async function countContent(type: ContentType): Promise<Record<string, number>> {
  const rows = await runQuery<{ status: string; count: number }>(CONTENT_TYPES[type].queries.count);
  return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}

export async function getContent(type: ContentType, id: number): Promise<Post | null> {
  const [row] = await runQuery<Post>(CONTENT_TYPES[type].queries.get, [id]);
  return row ? normalizePost(row) : null;
}

export async function insertContent(type: ContentType, input: ContentInput): Promise<Post> {
  const [row] = await runQuery<Post>(CONTENT_TYPES[type].queries.insert, contentParams(input));
  return normalizePost(row);
}

export async function updateContent(type: ContentType, id: number, input: ContentInput): Promise<Post> {
  const [row] = await runQuery<Post>(CONTENT_TYPES[type].queries.update, [id, ...contentParams(input)]);
  return normalizePost(row);
}

export function setContentStatus(type: ContentType, id: number, status: string) {
  return runQuery<{ id: number; status: string }>(CONTENT_TYPES[type].queries.setStatus, [id, status]);
}

export function deleteContent(type: ContentType, id: number) {
  return runQuery<{ id: number }>(CONTENT_TYPES[type].queries.remove, [id]);
}

export function listContentOptions(type: ContentType) {
  return runQuery<ContentOption>(CONTENT_TYPES[type].queries.options);
}

/* ------------------------------------------------------------------------ */
/* Authors, categories, tags                                                 */
/* ------------------------------------------------------------------------ */

export type CollectionKind = 'author' | 'category' | 'tag';

export const COLLECTIONS: Record<
  CollectionKind,
  {
    label: string;
    singular: string;
    typeName: string;
    hierarchical: boolean;
    columns: string[];
    queries: Record<'list' | 'insert' | 'update' | 'remove', AdminQueryName>;
  }
> = {
  author: {
    label: 'Authors',
    singular: 'author',
    typeName: 'author',
    hierarchical: false,
    columns: ['name', 'slug', 'bio', 'avatar_url', 'url'],
    queries: { list: 'listAuthors', insert: 'insertAuthor', update: 'updateAuthor', remove: 'deleteAuthor' },
  },
  category: {
    label: 'Categories',
    singular: 'category',
    typeName: 'category',
    hierarchical: true,
    columns: ['name', 'slug', 'description', 'parent'],
    queries: { list: 'listCategories', insert: 'insertCategory', update: 'updateCategory', remove: 'deleteCategory' },
  },
  tag: {
    label: 'Tags',
    singular: 'tag',
    typeName: 'tag',
    hierarchical: false,
    columns: ['name', 'slug', 'description'],
    queries: { list: 'listTags', insert: 'insertTag', update: 'updateTag', remove: 'deleteTag' },
  },
};

export function isCollectionKind(value: string | undefined): value is CollectionKind {
  return value === 'author' || value === 'category' || value === 'tag';
}

export type CollectionRow<K extends CollectionKind> = K extends 'author' ? Author : Term;

export type CollectionValues = Record<string, unknown>;

const collectionParams = (kind: CollectionKind, values: CollectionValues) =>
  COLLECTIONS[kind].columns.map((column) => values[column] ?? null);

export function listCollection<K extends CollectionKind>(kind: K) {
  return runQuery<CollectionRow<K>>(COLLECTIONS[kind].queries.list);
}

export async function insertCollection<K extends CollectionKind>(kind: K, values: CollectionValues) {
  const [row] = await runQuery<CollectionRow<K>>(COLLECTIONS[kind].queries.insert, collectionParams(kind, values));
  return row;
}

export async function updateCollection<K extends CollectionKind>(kind: K, id: number, values: CollectionValues) {
  const [row] = await runQuery<CollectionRow<K>>(COLLECTIONS[kind].queries.update, [
    id,
    ...collectionParams(kind, values),
  ]);
  return row;
}

export function deleteCollection(kind: CollectionKind, id: number) {
  return runQuery<{ id: number }>(COLLECTIONS[kind].queries.remove, [id]);
}

/* ------------------------------------------------------------------------ */
/* Comments (read-only + delete)                                             */
/* ------------------------------------------------------------------------ */

export interface AdminComment extends Omit<Comment, 'link'> {
  post_title: string | null;
  post_slug: string | null;
}

export function listComments({ page = 1, perPage = 20 }: { page?: number; perPage?: number } = {}) {
  return runQuery<AdminComment>('listComments', [perPage, (page - 1) * perPage]);
}

export async function countComments(): Promise<number> {
  const [row] = await runQuery<{ count: number }>('countComments');
  return row?.count ?? 0;
}

export function deleteComment(id: number) {
  return runQuery<{ id: number }>('deleteComment', [id]);
}

/* ------------------------------------------------------------------------ */
/* Media (`cms_assets`: read + metadata only)                                */
/* ------------------------------------------------------------------------ */

export function listAssets({ search = '', page = 1, perPage = 40 }: { search?: string; page?: number; perPage?: number } = {}) {
  return runQuery<Asset>('listAssets', [search, perPage, (page - 1) * perPage]);
}

export async function countAssets(search = ''): Promise<number> {
  const [row] = await runQuery<{ count: number }>('countAssets', [search]);
  return row?.count ?? 0;
}

export async function getAsset(id: string): Promise<Asset | null> {
  const [row] = await runQuery<Asset>('getAsset', [id]);
  return row ?? null;
}

export function updateAsset(id: string, values: { title: string | null; alt: string | null; caption: string | null }) {
  return runQuery<{ id: string }>('updateAsset', [id, values.title, values.alt, values.caption]);
}

/* ------------------------------------------------------------------------ */
/* Settings                                                                  */
/* ------------------------------------------------------------------------ */

export async function getAdminSettings(): Promise<SiteSettings> {
  const [rows, [site]] = await Promise.all([
    runQuery<{ key: string; value: unknown }>('listSettings'),
    runQuery<SiteRow>('getSite'),
  ]);
  return mergeSettings(rows, site ?? null);
}

export async function saveSettings(values: Partial<SiteSettings>) {
  for (const [key, value] of Object.entries(values)) {
    await runQuery('upsertSetting', [key, JSON.stringify(value ?? null)]);
  }
}

/* ------------------------------------------------------------------------ */
/* Menus                                                                     */
/* ------------------------------------------------------------------------ */

export function listMenus() {
  return runQuery<Menu>('listMenus');
}

export async function insertMenu(menu: { name: string; slug: string; location: string | null }): Promise<Menu> {
  const [row] = await runQuery<Menu>('insertMenu', [menu.name, menu.slug, menu.location]);
  return row;
}

export function updateMenuLocation(id: number, location: string | null) {
  return runQuery<Menu>('updateMenuLocation', [id, location]);
}

export function deleteMenu(id: number) {
  return runQuery<{ id: number }>('deleteMenu', [id]);
}

export function listMenuItems(menuId: number) {
  return runQuery<MenuItem>('listMenuItems', [menuId]);
}

const menuItemParams = (item: Omit<MenuItem, 'id' | 'menu_id'>) => [
  item.parent_id,
  item.position,
  item.title,
  item.url,
  item.object_type,
  item.object_id,
  item.target,
  item.classes,
  item.description,
];

export async function insertMenuItem(item: Omit<MenuItem, 'id'>): Promise<MenuItem> {
  const [row] = await runQuery<MenuItem>('insertMenuItem', [item.menu_id, ...menuItemParams(item)]);
  return row;
}

export async function updateMenuItem(item: MenuItem): Promise<MenuItem> {
  const [row] = await runQuery<MenuItem>('updateMenuItem', [item.id, ...menuItemParams(item)]);
  return row;
}

export function deleteMenuItem(id: number) {
  return runQuery<{ id: number }>('deleteMenuItem', [id]);
}

/* ------------------------------------------------------------------------ */
/* Field registry                                                            */
/* ------------------------------------------------------------------------ */

export function getFields(typeName: string) {
  return runQuery<FieldDef>('listFields', [typeName]);
}
