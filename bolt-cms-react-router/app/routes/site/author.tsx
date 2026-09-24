import { data } from 'react-router';

import { ArchiveHeader } from '@/components/site/ArchiveHeader';
import { PostList } from '@/components/site/PostList';
import {
  getAuthorBySlug,
  getSettings,
  listPosts,
  pageTitleMeta,
} from '@/lib/cms';

import type { Route } from './+types/author';
import { settingsFromMatches } from './layout';

export async function clientLoader({
  params,
  request,
}: Route.ClientLoaderArgs) {
  const [settings, author] = await Promise.all([
    getSettings(),
    getAuthorBySlug(params.slug),
  ]);
  if (!author) throw data('Author not found', { status: 404 });
  const page =
    Number(new URL(request.url).searchParams.get('page') ?? '1') || 1;
  const result = await listPosts({
    authorId: author.id,
    page,
    perPage: settings.posts_per_page,
  });
  return { author, ...result };
}

export function meta({ loaderData, matches }: Route.MetaArgs) {
  return pageTitleMeta(
    loaderData ? `Posts by ${loaderData.author.name}` : 'Author',
    settingsFromMatches(matches)
  );
}

export default function Author({ loaderData }: Route.ComponentProps) {
  const { author } = loaderData;
  return (
    <>
      <ArchiveHeader
        kicker="Author"
        title={author.name}
        description={author.bio}
      />
      <PostList
        posts={loaderData.posts}
        page={loaderData.page}
        pages={loaderData.pages}
      />
    </>
  );
}
