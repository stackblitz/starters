import { redirect } from 'react-router';

import { Article } from '@/components/site/Article';
import { PostList } from '@/components/site/PostList';
import {
  getComments,
  getPageById,
  getSettings,
  listPosts,
  postMeta,
  siteMeta,
  type Comment,
  type PostWithRelations,
} from '@/lib/cms';
import { hasSupabaseConfig } from '@/lib/supabase';

import type { Route } from './+types/home';
import { settingsFromMatches } from './layout';

type HomeData =
  | { kind: 'posts'; posts: PostWithRelations[]; page: number; pages: number }
  | { kind: 'page'; post: PostWithRelations; comments: Comment[] }
  | { kind: 'empty' };

export async function clientLoader({
  request,
}: Route.ClientLoaderArgs): Promise<HomeData> {
  const url = new URL(request.url);

  // WordPress search URL: /?s=term
  const s = url.searchParams.get('s');
  if (s !== null) throw redirect(`/search?s=${encodeURIComponent(s)}`);

  if (!hasSupabaseConfig()) return { kind: 'empty' };

  const settings = await getSettings();

  // WordPress "Your homepage displays: A static page".
  if (settings.show_on_front === 'page' && settings.page_on_front) {
    const post = await getPageById(settings.page_on_front);
    if (post)
      return { kind: 'page', post, comments: await getComments(post.id) };
  }

  const page = Number(url.searchParams.get('page') ?? '1') || 1;
  const result = await listPosts({ page, perPage: settings.posts_per_page });
  return { kind: 'posts', ...result };
}

export function meta({ loaderData, matches }: Route.MetaArgs) {
  const settings = settingsFromMatches(matches);
  if (loaderData?.kind === 'page')
    return postMeta(loaderData.post, settings, 'page');
  return siteMeta(settings);
}

export default function Home({ loaderData }: Route.ComponentProps) {
  if (loaderData.kind === 'page') {
    return (
      <Article
        kind="page"
        post={loaderData.post}
        comments={loaderData.comments}
      />
    );
  }

  if (loaderData.kind === 'empty') {
    return (
      <p className="py-16 text-center text-site-muted">
        Connect Supabase to see your content here.
      </p>
    );
  }

  return (
    <PostList
      posts={loaderData.posts}
      page={loaderData.page}
      pages={loaderData.pages}
      featureFirst
      emptyMessage="No posts yet. Publish your first post from the Admin tab in Bolt."
    />
  );
}
