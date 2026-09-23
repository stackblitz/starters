/**
 * Row types for the `cms_*` tables. Keep in sync with
 * `supabase/migrations/0001_cms_core.sql`.
 */

export type PostStatus =
  | 'publish'
  | 'draft'
  | 'pending'
  | 'private'
  | 'future'
  | 'trash';

export type CommentStatus = 'approved' | 'hold' | 'spam' | 'trash';

export interface SeoFields {
  title?: string | null;
  description?: string | null;
  og_image?: string | null;
  canonical?: string | null;
  noindex?: boolean | null;
}

export interface Author {
  id: number;
  slug: string;
  name: string;
  email: string | null;
  url: string | null;
  description: string | null;
  avatar_url: string | null;
}

export interface Media {
  id: number;
  slug: string | null;
  title: string | null;
  alt_text: string | null;
  caption: string | null;
  description: string | null;
  mime_type: string | null;
  media_type: string | null;
  source_url: string | null;
  local_path: string | null;
  width: number | null;
  height: number | null;
  sizes: Record<
    string,
    { source_url?: string; width?: number; height?: number }
  >;
  author_id: number | null;
  date: string;
  modified: string;
}

export interface Post {
  id: number;
  type: string;
  status: PostStatus;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string | null;
  content_json: unknown | null;
  author_id: number | null;
  featured_media_id: number | null;
  parent_id: number | null;
  menu_order: number;
  date: string;
  modified: string;
  comment_status: 'open' | 'closed';
  sticky: boolean;
  format: string | null;
  template: string | null;
  seo: SeoFields;
}

/** A post with its usual joins resolved. */
export interface PostWithRelations extends Post {
  author: Author | null;
  featured_media: Media | null;
  terms: Term[];
}

export interface Term {
  id: number;
  taxonomy: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  count: number;
}

export interface Comment {
  id: number;
  post_id: number;
  parent_id: number | null;
  author_id: number | null;
  author_name: string;
  author_email: string | null;
  author_url: string | null;
  author_avatar_url: string | null;
  content_html: string;
  status: CommentStatus;
  type: string;
  date: string;
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

export type FieldType =
  | 'string'
  | 'text'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'image'
  | 'file'
  | 'reference'
  | 'array'
  | 'object'
  | 'slug'
  | 'select'
  | 'json';

export interface FieldDef {
  table_name: string;
  column_name: string;
  label: string;
  type: FieldType;
  options: Record<string, unknown>;
  group_name: string;
  position: number;
}

export type ThemeName = 'classic' | 'editorial' | 'minimal';

/** Typed view over `cms_settings` key/value rows. */
export interface SiteSettings {
  site_title: string;
  tagline: string;
  site_url: string;
  language: string;
  timezone: string;
  date_format: string;
  permalink_structure: string;
  show_on_front: 'posts' | 'page';
  page_on_front: number | null;
  page_for_posts: number | null;
  posts_per_page: number;
  theme: ThemeName;
  comments_enabled: boolean;
  default_comment_status: 'open' | 'closed';
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
  site_title: 'My WordPress Site',
  tagline: 'Just another WordPress site',
  site_url: '',
  language: 'en-US',
  timezone: 'UTC',
  date_format: 'F j, Y',
  permalink_structure: '/%postname%/',
  show_on_front: 'posts',
  page_on_front: null,
  page_for_posts: null,
  posts_per_page: 10,
  theme: 'classic',
  comments_enabled: true,
  default_comment_status: 'open',
  seo: {
    title_template: '%title% | %site_title%',
    description: '',
    og_image: null,
    twitter: '',
    noindex: false,
  },
  imported_from: null,
};

export function settingsFromRows(
  rows: Array<{ key: string; value: unknown }>
): SiteSettings {
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.value !== null && row.value !== undefined) {
      merged[row.key] = row.value;
    }
  }
  return merged as unknown as SiteSettings;
}
