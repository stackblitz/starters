import { ArchiveHeader } from '@/components/site/ArchiveHeader';
import { PostList } from '@/components/site/PostList';
import {
  getPostById,
  getSettings,
  listPosts,
  pageTitleMeta,
  type PostWithRelations,
} from '@/lib/cms';

import type { Route } from './+types/blog';
import { settingsFromMatches } from './layout';

/**
 * Posts archive. When WordPress' "Posts page" setting points at a page, that
 * page's title/content head the archive, mirroring WP behavior.
 */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const settings = await getSettings();
  const page =
    Number(new URL(request.url).searchParams.get('page') ?? '1') || 1;
  const [result, postsPage] = await Promise.all([
    listPosts({ type: 'post', page, perPage: settings.posts_per_page }),
    settings.page_for_posts
      ? getPostById(settings.page_for_posts)
      : Promise.resolve<PostWithRelations | null>(null),
  ]);
  return { ...result, postsPage };
}

export function meta({ loaderData, matches }: Route.MetaArgs) {
  return pageTitleMeta(
    loaderData?.postsPage?.title || 'Blog',
    settingsFromMatches(matches)
  );
}

export default function Blog({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <ArchiveHeader
        title={loaderData.postsPage?.title || 'Blog'}
        description={loaderData.postsPage?.excerpt}
      />
      <PostList
        posts={loaderData.posts}
        page={loaderData.page}
        pages={loaderData.pages}
      />
    </>
  );
}
