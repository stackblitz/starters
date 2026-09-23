/**
 * Row types for the Bolt CMS schema (`supabase/migrations/0001_bolt_cms_schema.sql`,
 * generated from Bolt's WordPress importer) and the starter's own tables
 * (`0002_starter.sql`).
 */
import type { PortableTextBlock } from './portable-text';

export interface Author {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  avatar_url: string | null;
  url: string | null;
}

export interface Term {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent?: number | null;
}

export interface Asset {
  id: string;
  kind: 'image' | 'file';
  mime_type: string | null;
  filename: string;
  title: string | null;
  alt: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  original_url: string;
  public_url: string;
  upload_error: string | null;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  body: PortableTextBlock[] | null;
  content_html: string | null;
  status: string | null;
  author: number | null;
  featured_image: string | null;
  categories: number[];
  tags: number[];
  parent: number | null;
  menu_order: number | null;
  link: string | null;
  published_at: string | null;
  modified_at: string | null;
}

/** A post with its references resolved (see `attachRelations`). */
export interface PostWithRelations extends Post {
  authorRow: Author | null;
  featuredAsset: Asset | null;
  categoryTerms: Term[];
  tagTerms: Term[];
}

export interface Comment {
  id: number;
  post: number;
  parent: number | null;
  author_name: string | null;
  body: PortableTextBlock[] | null;
  created_at: string | null;
  link: string | null;
}

export type ContentTable = 'cms_posts' | 'cms_pages';

export type TermKind = 'category' | 'tag';

export const TERM_TABLE: Record<TermKind, 'cms_categories' | 'cms_tags'> = {
  category: 'cms_categories',
  tag: 'cms_tags',
};

/** A `cms_fields` registry row. */
export interface FieldDef {
  type_name: string;
  name: string;
  title: string;
  primitive:
    | 'string'
    | 'number'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'image'
    | 'file'
    | 'reference'
    | 'array'
    | 'object'
    | 'block'
    | 'slug';
  column_name: string;
  required: boolean;
  description: string | null;
  options: Record<string, unknown>;
  position: number;
}

export interface Menu {
  id: number;
  slug: string;
  name: string;
  location: string | null;
}

export interface MenuItem {
  id: number;
  menu_id: number;
  parent_id: number | null;
  position: number;
  title: string;
  url: string;
  object_type: string | null;
  object_id: number | null;
  target: string | null;
  classes: string | null;
  description: string | null;
}

export interface MenuItemNode extends MenuItem {
  children: MenuItemNode[];
}

export interface Redirect {
  from_path: string;
  to_path: string;
  status: number;
}

export type ThemeName = 'classic' | 'editorial' | 'minimal';

/** Typed view over `cms_site` + `cms_settings` key/value rows. */
export interface SiteSettings {
  site_title: string;
  tagline: string;
  site_url: string;
  language: string;
  timezone: string;
  date_format: string;
  show_on_front: 'posts' | 'page';
  page_on_front: number | null;
  page_for_posts: number | null;
  posts_per_page: number;
  theme: ThemeName;
  seo: {
    title_template: string;
    description: string;
    og_image: string | null;
    twitter: string;
    noindex: boolean;
  };
  imported_from: string | null;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  site_title: 'My Site',
  tagline: '',
  site_url: '',
  language: 'en-US',
  timezone: 'UTC',
  date_format: 'F j, Y',
  show_on_front: 'posts',
  page_on_front: null,
  page_for_posts: null,
  posts_per_page: 10,
  theme: 'classic',
  seo: {
    title_template: '%title% | %site_title%',
    description: '',
    og_image: null,
    twitter: '',
    noindex: false,
  },
  imported_from: null,
};

export interface SiteRow {
  name: string;
  description: string | null;
  url: string;
  home_url: string | null;
  source: string;
}

/** `cms_settings` rows win over `cms_site`, which wins over the defaults. */
export function mergeSettings(
  rows: Array<{ key: string; value: unknown }>,
  site: SiteRow | null
): SiteSettings {
  const merged: Record<string, unknown> = {
    ...DEFAULT_SETTINGS,
    site_title: site?.name ?? DEFAULT_SETTINGS.site_title,
    tagline: site?.description ?? '',
    site_url: site?.home_url ?? site?.url ?? '',
    imported_from: site?.source === 'wordpress' ? site.url : null,
  };
  for (const row of rows) {
    if (row.value !== null && row.value !== undefined) merged[row.key] = row.value;
  }
  return merged as unknown as SiteSettings;
}
