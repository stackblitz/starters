import { Link } from 'react-router';

import { mediaUrl, type Comment, type PostWithRelations } from '@/lib/cms';

import { Comments } from './Comments';
import { PostContent } from './PostContent';
import { PostMeta } from './PostMeta';

/** Single post or page. */
export function Article({
  post,
  comments,
  commentsEnabled,
}: {
  post: PostWithRelations;
  comments: Comment[];
  commentsEnabled: boolean;
}) {
  const isPost = post.type === 'post';
  const hero =
    mediaUrl(post.featured_media, 'large') ?? mediaUrl(post.featured_media);
  const tags = post.terms.filter((t) => t.taxonomy === 'post_tag');

  return (
    <article>
      <header className="site-measure">
        {isPost && <PostMeta post={post} />}
        <h1 className="mt-3 text-4xl md:text-5xl">
          {post.title || '(no title)'}
        </h1>
      </header>

      {hero && (
        <figure className="mx-auto mt-8 max-w-[var(--theme-wide)]">
          <img
            src={hero}
            alt={post.featured_media?.alt_text ?? ''}
            className="w-full rounded-site-lg object-cover"
            width={post.featured_media?.width ?? undefined}
            height={post.featured_media?.height ?? undefined}
          />
          {post.featured_media?.caption && (
            <figcaption className="mt-2 text-center text-sm text-site-muted">
              {post.featured_media.caption.replace(/<[^>]+>/g, '')}
            </figcaption>
          )}
        </figure>
      )}

      <div className="site-measure mt-10">
        <PostContent html={post.content_html} />
      </div>

      {isPost && tags.length > 0 && (
        <footer className="site-measure mt-10 flex flex-wrap gap-2 text-sm">
          {tags.map((t) => (
            <Link
              key={t.id}
              to={`/tag/${t.slug}`}
              className="rounded-full border border-site-border px-3 py-1 no-underline hover:border-site-accent"
            >
              #{t.name}
            </Link>
          ))}
        </footer>
      )}

      <Comments post={post} comments={comments} enabled={commentsEnabled} />
    </article>
  );
}
