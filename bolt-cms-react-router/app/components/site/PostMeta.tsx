import { Link } from 'react-router';

import { formatDate, type PostWithRelations } from '@/lib/cms';

export function PostMeta({
  post,
  compact = false,
}: {
  post: PostWithRelations;
  compact?: boolean;
}) {
  const categories = post.terms.filter((t) => t.taxonomy === 'category');

  return (
    <p
      className={`m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-site-muted ${
        compact ? 'text-xs uppercase tracking-wide' : 'text-sm'
      }`}
    >
      <time dateTime={post.date}>{formatDate(post.date)}</time>
      {post.author && (
        <>
          <span aria-hidden>·</span>
          <Link to={`/author/${post.author.slug}`} className="no-underline">
            {post.author.name}
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
