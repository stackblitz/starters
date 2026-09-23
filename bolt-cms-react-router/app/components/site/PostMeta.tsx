import { Link } from 'react-router';

import { formatDate, type PostWithRelations } from '@/lib/cms';

export function PostMeta({
  post,
  compact = false,
}: {
  post: PostWithRelations;
  compact?: boolean;
}) {
  const categories = post.categoryTerms;

  return (
    <p
      className={`m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-site-muted ${
        compact ? 'text-xs uppercase tracking-wide' : 'text-sm'
      }`}
    >
      {post.published_at && (
        <time dateTime={post.published_at}>
          {formatDate(post.published_at)}
        </time>
      )}
      {post.authorRow && (
        <>
          <span aria-hidden>·</span>
          <Link to={`/author/${post.authorRow.slug}`} className="no-underline">
            {post.authorRow.name}
          </Link>
        </>
      )}
      {categories.length > 0 && (
        <>
          <span aria-hidden>·</span>
          {categories.map((c, i) => (
            <span key={c.id}>
              <Link to={`/category/${c.slug}`} className="no-underline">
                {c.name}
              </Link>
              {i < categories.length - 1 && ', '}
            </span>
          ))}
        </>
      )}
    </p>
  );
}
