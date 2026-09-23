import { data } from 'react-router';

import { ArchiveHeader } from '@/components/site/ArchiveHeader';
import { PostList } from '@/components/site/PostList';
import {
  getSettings,
  getTermBySlug,
  listPosts,
  pageTitleMeta,
} from '@/lib/cms';

import type { Route } from './+types/tag';
import { settingsFromMatches } from './layout';

export async function clientLoader({
  params,
  request,
}: Route.ClientLoaderArgs) {
  const [settings, term] = await Promise.all([
    getSettings(),
    getTermBySlug('tag', params.slug),
  ]);
  if (!term) throw data('Tag not found', { status: 404 });
  const page =
    Number(new URL(request.url).searchParams.get('page') ?? '1') || 1;
  const result = await listPosts({
    tagId: term.id,
    page,
    perPage: settings.posts_per_page,
  });
  return { term, ...result };
}

export function meta({ loaderData, matches }: Route.MetaArgs) {
  return pageTitleMeta(
    loaderData ? `Tag: ${loaderData.term.name}` : 'Tag',
    settingsFromMatches(matches)
  );
}

export default function Tag({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <ArchiveHeader
        kicker="Tag"
        title={`#${loaderData.term.name}`}
        description={loaderData.term.description}
      />
      <PostList
        posts={loaderData.posts}
        page={loaderData.page}
        pages={loaderData.pages}
      />
    </>
  );
}
