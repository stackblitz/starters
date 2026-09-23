import type { MetaDescriptor } from 'react-router';

import type { PostWithRelations, SiteSettings } from './types';
import { mediaUrl } from './media';

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

export function postMeta(
  post: PostWithRelations,
  settings: SiteSettings
): MetaDescriptor[] {
  const seo = post.seo ?? {};
  const description =
    seo.description || truncate(stripHtml(post.excerpt || post.content_html));
  const image =
    seo.og_image || mediaUrl(post.featured_media) || settings.seo.og_image;

  const meta = baseMeta({
    title: applyTitleTemplate(seo.title || post.title, settings),
    description,
    image,
    noindex: Boolean(seo.noindex) || settings.seo.noindex,
    twitter: settings.seo.twitter,
    type: post.type === 'post' ? 'article' : 'website',
  });

  if (seo.canonical)
    meta.push({ tagName: 'link', rel: 'canonical', href: seo.canonical });
  if (post.type === 'post') {
    meta.push({ property: 'article:published_time', content: post.date });
    meta.push({ property: 'article:modified_time', content: post.modified });
    if (post.author?.name)
      meta.push({ property: 'article:author', content: post.author.name });
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
