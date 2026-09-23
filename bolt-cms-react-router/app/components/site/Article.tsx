import { Link } from 'react-router';

import {
  assetUrl,
  postHtml,
  type Comment,
  type PostWithRelations,
} from '@/lib/cms';

import { Comments } from './Comments';
import { PostContent } from './PostContent';
import { PostMeta } from './PostMeta';

/** Single post or page. */
export function Article({
  kind,
  post,
  comments,
}: {
  kind: 'post' | 'page';
  post: PostWithRelations;
  comments: Comment[];
}) {
  const isPost = kind === 'post';
  const asset = post.featuredAsset;
  const hero = assetUrl(asset);

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
            alt={asset?.alt ?? ''}
            className="w-full rounded-site-lg object-cover"
            width={asset?.width ?? undefined}
            height={asset?.height ?? undefined}
          />
          {asset?.caption && (
            <figcaption className="mt-2 text-center text-sm text-site-muted">
              {asset.caption.replace(/<[^>]+>/g, '')}
            </figcaption>
          )}
        </figure>
      )}

      <div className="site-measure mt-10">
        <PostContent html={postHtml(post)} />
      </div>

      {isPost && post.tagTerms.length > 0 && (
        <footer className="site-measure mt-10 flex flex-wrap gap-2 text-sm">
          {post.tagTerms.map((t) => (
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

      <Comments comments={comments} />
    </article>
  );
}
