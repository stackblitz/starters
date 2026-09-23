import { data, redirect } from 'react-router';

import { Article } from '@/components/site/Article';
import {
  getComments,
  postMeta,
  resolvePath,
  type Comment,
  type PostWithRelations,
} from '@/lib/cms';

import type { Route } from './+types/catch-all';
import { settingsFromMatches } from './layout';

/**
 * Everything not matched by an explicit route lands here and is resolved the
 * way WordPress resolves permalinks: redirects, then pages (hierarchical),
 * then posts by slug. Date-prefixed permalinks (`/2024/05/hello-world/`) are
 * handled by matching the final segment.
 */
export async function clientLoader({
  params,
}: Route.ClientLoaderArgs): Promise<{
  kind: 'post' | 'page';
  post: PostWithRelations;
  comments: Comment[];
}> {
  const resolved = await resolvePath(params['*'] ?? '');

  if (resolved.kind === 'redirect')
    throw redirect(resolved.to, resolved.status);
  if (resolved.kind === 'not-found') throw data('Not found', { status: 404 });

  const comments = await getComments(resolved.post.id);
  return { kind: resolved.kind, post: resolved.post, comments };
}

export function meta({ loaderData, matches }: Route.MetaArgs) {
  const settings = settingsFromMatches(matches);
  return loaderData
    ? postMeta(loaderData.post, settings, loaderData.kind)
    : [{ title: settings.site_title }];
}

export default function CatchAll({ loaderData }: Route.ComponentProps) {
  return (
    <Article
      kind={loaderData.kind}
      post={loaderData.post}
      comments={loaderData.comments}
    />
  );
}
