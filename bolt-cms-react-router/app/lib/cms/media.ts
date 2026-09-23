import type { Media } from './types';

/**
 * Public URL for a media row. Imported files are copied into
 * `public/wp-content/uploads/...` (mirroring the WordPress path so URLs inside
 * post HTML resolve unchanged); fall back to the original source URL.
 */
export function mediaUrl(
  media: Media | null | undefined,
  size?: string
): string | null {
  if (!media) return null;
  if (size && media.sizes?.[size]?.source_url) {
    const sized = media.sizes[size].source_url!;
    return media.local_path ? rewriteToLocal(sized, media) : sized;
  }
  return media.local_path || media.source_url || null;
}

function rewriteToLocal(url: string, media: Media): string {
  // `sizes.*.source_url` is absolute on the old host; keep the file name,
  // swap in the local directory.
  try {
    const file = new URL(url).pathname.split('/').pop();
    const dir = (media.local_path ?? '').split('/').slice(0, -1).join('/');
    return file && dir ? `${dir}/${file}` : url;
  } catch {
    return url;
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
