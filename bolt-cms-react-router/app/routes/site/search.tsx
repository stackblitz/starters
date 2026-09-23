import { ArchiveHeader } from '@/components/site/ArchiveHeader';
import { PostList } from '@/components/site/PostList';
import { getSettings, listPosts, pageTitleMeta } from '@/lib/cms';

import type { Route } from './+types/search';
import { settingsFromMatches } from './layout';

/** WordPress uses `?s=` for search; keep it so imported links work. */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const query = (
    url.searchParams.get('s') ??
    url.searchParams.get('q') ??
    ''
  ).trim();
  if (!query) return { query, posts: [], total: 0, page: 1, pages: 0 };
  const settings = await getSettings();
  const page = Number(url.searchParams.get('page') ?? '1') || 1;
  const result = await listPosts({
    search: query,
    page,
    perPage: settings.posts_per_page,
  });
  return { query, ...result };
}

export function meta({ loaderData, matches }: Route.MetaArgs) {
  return pageTitleMeta(
    loaderData?.query ? `Search: ${loaderData.query}` : 'Search',
    settingsFromMatches(matches)
  );
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { query, total } = loaderData;
  return (
    <>
      <ArchiveHeader
        kicker="Search"
        title={query ? `Results for “${query}”` : 'Search'}
        description={
          query
            ? `${total} ${total === 1 ? 'result' : 'results'}`
            : 'Type something in the search box above.'
        }
      />
      <PostList
        posts={loaderData.posts}
        page={loaderData.page}
        pages={loaderData.pages}
        emptyMessage={query ? 'Nothing matched. Try a different search.' : ''}
      />
    </>
  );
}
