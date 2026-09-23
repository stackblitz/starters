import { redirect } from 'react-router';

import { Article } from '@/components/site/Article';
import { PostList } from '@/components/site/PostList';
import {
  getComments,
  getPostById,
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
    const post = await getPostById(settings.page_on_front);
    if (post) {
      const comments =
        post.comment_status === 'open' ? await getComments(post.id) : [];
      return { kind: 'page', post, comments };
    }
  }

  const page = Number(url.searchParams.get('page') ?? '1') || 1;
  const result = await listPosts({
    type: 'post',
    page,
    perPage: settings.posts_per_page,
    sticky: 'first',
  });
  return { kind: 'posts', ...result };
}

export function meta({ loaderData, matches }: Route.MetaArgs) {
  const settings = settingsFromMatches(matches);
  if (loaderData?.kind === 'page') return postMeta(loaderData.post, settings);
  return siteMeta(settings);
}

export default function Home({ loaderData, matches }: Route.ComponentProps) {
  const settings = settingsFromMatches(matches);

  if (loaderData.kind === 'page') {
    return (
      <Article
        post={loaderData.post}
        comments={loaderData.comments}
        commentsEnabled={settings.comments_enabled}
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
      emptyMessage="No posts yet. Publish your first post from the Bolt CMS admin."
    />
  );
}
