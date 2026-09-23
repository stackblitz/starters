import { data } from 'react-router';

import { ArchiveHeader } from '@/components/site/ArchiveHeader';
import { PostList } from '@/components/site/PostList';
import {
  getSettings,
  getTermBySlug,
  listPosts,
  pageTitleMeta,
} from '@/lib/cms';

import type { Route } from './+types/category';
import { settingsFromMatches } from './layout';

export async function clientLoader({
  params,
  request,
}: Route.ClientLoaderArgs) {
  const [settings, term] = await Promise.all([
    getSettings(),
    getTermBySlug('category', params.slug),
  ]);
  if (!term) throw data('Category not found', { status: 404 });
  const page =
    Number(new URL(request.url).searchParams.get('page') ?? '1') || 1;
  const result = await listPosts({
    type: 'post',
    termId: term.id,
    page,
    perPage: settings.posts_per_page,
  });
  return { term, ...result };
}

export function meta({ loaderData, matches }: Route.MetaArgs) {
  return pageTitleMeta(
    loaderData ? `Category: ${loaderData.term.name}` : 'Category',
    settingsFromMatches(matches)
  );
}

export default function Category({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <ArchiveHeader
        kicker="Category"
        title={loaderData.term.name}
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
