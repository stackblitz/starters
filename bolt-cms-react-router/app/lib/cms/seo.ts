import type { MetaDescriptor } from 'react-router';

import type { PostWithRelations, SiteSettings } from './types';
import { assetUrl } from './media';

export function stripHtml(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ')).trim() + '…';
}

export function applyTitleTemplate(
  title: string | null | undefined,
  settings: SiteSettings
): string {
  if (!title) return settings.site_title;
  return settings.seo.title_template
    .replace('%title%', title)
    .replace('%site_title%', settings.site_title)
    .replace('%tagline%', settings.tagline);
}

export function siteMeta(settings: SiteSettings): MetaDescriptor[] {
  const title = settings.tagline
    ? `${settings.site_title} – ${settings.tagline}`
    : settings.site_title;
  return baseMeta({
    title,
    description: settings.seo.description,
    image: settings.seo.og_image,
    noindex: settings.seo.noindex,
    twitter: settings.seo.twitter,
    type: 'website',
  });
}

/** Meta for a single post (`article`) or page (`website`). */
export function postMeta(
  post: PostWithRelations,
  settings: SiteSettings,
  kind: 'post' | 'page' = 'post'
): MetaDescriptor[] {
  const meta = baseMeta({
    title: applyTitleTemplate(post.title, settings),
    description: truncate(stripHtml(post.excerpt)) || settings.seo.description,
    image: assetUrl(post.featuredAsset) || settings.seo.og_image,
    noindex: settings.seo.noindex,
    twitter: settings.seo.twitter,
    type: kind === 'post' ? 'article' : 'website',
  });

  if (kind === 'post') {
    if (post.published_at)
      meta.push({ property: 'article:published_time', content: post.published_at });
    if (post.modified_at)
      meta.push({ property: 'article:modified_time', content: post.modified_at });
    if (post.authorRow)
      meta.push({ property: 'article:author', content: post.authorRow.name });
  }
  return meta;
}

export function pageTitleMeta(
  title: string,
  settings: SiteSettings
): MetaDescriptor[] {
  return baseMeta({
    title: applyTitleTemplate(title, settings),
    description: settings.seo.description,
    image: settings.seo.og_image,
    noindex: settings.seo.noindex,
    twitter: settings.seo.twitter,
    type: 'website',
  });
}

function baseMeta(input: {
  title: string;
  description?: string | null;
  image?: string | null;
  noindex?: boolean | null;
  twitter?: string | null;
  type: 'website' | 'article';
}): MetaDescriptor[] {
  const meta: MetaDescriptor[] = [
    { title: input.title },
    { property: 'og:title', content: input.title },
    { property: 'og:type', content: input.type },
    {
      name: 'twitter:card',
      content: input.image ? 'summary_large_image' : 'summary',
    },
  ];
  if (input.description) {
    meta.push({ name: 'description', content: input.description });
    meta.push({ property: 'og:description', content: input.description });
  }
  if (input.image) {
    meta.push({ property: 'og:image', content: input.image });
    meta.push({ name: 'twitter:image', content: input.image });
  }
  if (input.twitter)
    meta.push({ name: 'twitter:site', content: input.twitter });
  if (input.noindex)
    meta.push({ name: 'robots', content: 'noindex, nofollow' });
  return meta;
}
