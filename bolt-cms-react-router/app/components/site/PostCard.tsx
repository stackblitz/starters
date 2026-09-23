import { Link } from 'react-router';

import {
  formatDate,
  mediaUrl,
  stripHtml,
  truncate,
  type PostWithRelations,
} from '@/lib/cms';

import { PostMeta } from './PostMeta';

export function PostCard({
  post,
  featured = false,
}: {
  post: PostWithRelations;
  featured?: boolean;
}) {
  const href = `/${post.slug}`;
  const image =
    mediaUrl(post.featured_media, 'large') ?? mediaUrl(post.featured_media);
  const excerpt = truncate(
    stripHtml(post.excerpt || post.content_html),
    featured ? 260 : 180
  );

  return (
    <article
      className={`post-card ${
        featured ? 'md:grid md:grid-cols-5 md:gap-8' : ''
      }`}
    >
      {image && (
        <Link
          to={href}
          className={`block ${featured ? 'md:col-span-3' : ''}`}
          tabIndex={-1}
          aria-hidden
        >
          <img
            src={image}
            alt={post.featured_media?.alt_text ?? ''}
            className="aspect-[16/9] w-full rounded-site-lg object-cover"
            loading="lazy"
          />
        </Link>
      )}
      <div
        className={`${image ? 'mt-4' : ''} ${
          featured ? 'md:col-span-2 md:mt-0' : ''
        }`}
      >
        <PostMeta post={post} compact />
        <h2
          className={`post-card-title mt-2 ${
            featured ? 'text-3xl' : 'text-2xl'
          }`}
        >
          <Link to={href} className="no-underline hover:text-site-accent">
            {post.title || '(no title)'}
          </Link>
        </h2>
        {excerpt && <p className="mt-3 text-site-muted">{excerpt}</p>}
        <p className="mt-3 text-sm">
          <Link
            to={href}
            className="font-semibold no-underline text-site-accent"
          >
            Continue reading →
          </Link>
        </p>
      </div>
      <time className="sr-only" dateTime={post.date}>
        {formatDate(post.date)}
      </time>
    </article>
  );
}
