/**
 * Resolve an arbitrary site path the way WordPress' rewrite engine does:
 *
 *   1. explicit redirect (`cms_redirects`)
 *   2. hierarchical page path (`/about/team`)
 *   3. post slug, tolerant of date-based permalinks (`/2024/05/hello-world`)
 *   4. not found
 *
 * Used by the catch-all route so imported permalinks keep working regardless
 * of the source site's permalink structure.
 */
import { getPageByPath, getPostBySlug, getRedirect } from './queries';
import type { PostWithRelations } from './types';

export type Resolved =
  | { kind: 'redirect'; to: string; status: number }
  | { kind: 'page'; post: PostWithRelations }
  | { kind: 'post'; post: PostWithRelations }
  | { kind: 'not-found' };

export function splitPath(path: string): string[] {
  return path
    .split('/')
    .map((s) => decodeURIComponent(s.trim()))
    .filter(Boolean);
}

export async function resolvePath(path: string): Promise<Resolved> {
  const redirect = await getRedirect(path);
  if (redirect)
    return { kind: 'redirect', to: redirect.to_path, status: redirect.status };

  const segments = splitPath(path);
  if (segments.length === 0) return { kind: 'not-found' };

  const page = await getPageByPath(segments);
  if (page) return { kind: 'page', post: page };

  // Last segment is the post slug; leading segments may be a date prefix
  // (`/%year%/%monthnum%/%postname%/`) or a category base.
  const post = await getPostBySlug(segments[segments.length - 1]);
  if (post) return { kind: 'post', post };

  return { kind: 'not-found' };
}
