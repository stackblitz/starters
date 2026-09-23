import type { PostWithRelations } from '@/lib/cms';

import { Pagination } from './Pagination';
import { PostCard } from './PostCard';

export function PostList({
  posts,
  page,
  pages,
  featureFirst = false,
  emptyMessage = 'Nothing here yet.',
}: {
  posts: PostWithRelations[];
  page: number;
  pages: number;
  featureFirst?: boolean;
  emptyMessage?: string;
}) {
  if (posts.length === 0) {
    return <p className="py-16 text-center text-site-muted">{emptyMessage}</p>;
  }

  const [first, ...rest] = posts;
  const showFeatured = featureFirst && page === 1;

  return (
    <>
      {showFeatured && (
        <div className="mb-14 border-b border-site-border pb-14">
          <PostCard post={first} featured />
        </div>
      )}
      <div className="grid gap-12 md:grid-cols-2 lg:gap-x-10">
        {(showFeatured ? rest : posts).map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      <Pagination page={page} pages={pages} />
    </>
  );
}
