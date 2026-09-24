import { portableTextToHtml, type PortableTextBlock } from './portable-text';

/** Rendered body: Portable Text when present, else the imported WordPress HTML. */
export function postHtml(post: {
  body: PortableTextBlock[] | null;
  content_html: string | null;
}): string {
  return post.body && post.body.length > 0
    ? portableTextToHtml(post.body)
    : post.content_html ?? '';
}

/** Date helpers. WordPress' default `F j, Y` is "September 23, 2026". */
export function formatDate(
  iso: string | null | undefined,
  locale = 'en-US'
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(
  iso: string | null | undefined,
  locale = 'en-US'
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
