import type { Asset } from './types';

/**
 * Public URL for a `cms_assets` row: the copy in the `cms-media` bucket, or the
 * original WordPress URL when the importer could not upload it.
 */
export function assetUrl(asset: Asset | null | undefined): string | null {
  if (!asset) return null;
  return asset.upload_error ? asset.original_url : asset.public_url;
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
