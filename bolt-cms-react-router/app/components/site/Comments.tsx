import { useState } from 'react';

import {
  formatDate,
  submitComment,
  type Comment,
  type PostWithRelations,
} from '@/lib/cms';
import { sanitizeHtml } from '@/lib/sanitize';

export function Comments({
  post,
  comments,
  enabled,
}: {
  post: PostWithRelations;
  comments: Comment[];
  enabled: boolean;
}) {
  const open = enabled && post.comment_status === 'open';
  if (!open && comments.length === 0) return null;

  const tree = buildTree(comments);

  return (
    <section
      id="comments"
      className="site-measure mt-16 border-t border-site-border pt-10"
    >
      <h2 className="text-2xl">
        {comments.length === 0
          ? 'Leave a comment'
          : `${comments.length} ${
              comments.length === 1 ? 'comment' : 'comments'
            }`}
      </h2>

      {tree.length > 0 && (
        <ol className="mt-8 list-none space-y-8 p-0">
          {tree.map((c) => (
            <CommentItem key={c.id} comment={c} />
          ))}
        </ol>
      )}

      {open ? (
        <CommentForm postId={post.id} />
      ) : (
        <p className="mt-6 text-sm text-site-muted">Comments are closed.</p>
      )}
    </section>
  );
}

type CommentNode = Comment & { children: CommentNode[] };

function buildTree(comments: Comment[]): CommentNode[] {
  const byId = new Map<number, CommentNode>();
  comments.forEach((c) => byId.set(c.id, { ...c, children: [] }));
  const roots: CommentNode[] = [];
  byId.forEach((node) => {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function CommentItem({ comment }: { comment: CommentNode }) {
  return (
    <li>
      <article className="flex gap-4">
        <Avatar name={comment.author_name} url={comment.author_avatar_url} />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm">
            <span className="font-semibold">
              {comment.author_url ? (
                <a
                  href={comment.author_url}
                  rel="nofollow noreferrer"
                  className="no-underline"
                >
                  {comment.author_name}
                </a>
              ) : (
                comment.author_name
              )}
            </span>
            <span className="text-site-muted">
              {' '}
              · {formatDate(comment.date)}
            </span>
          </p>
          <div
            className="entry-content mt-1 text-[0.95em]"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(comment.content_html),
            }}
          />
        </div>
      </article>
      {comment.children.length > 0 && (
        <ol className="mt-6 list-none space-y-6 border-l border-site-border pl-6">
          {comment.children.map((c) => (
            <CommentItem key={c.id} comment={c} />
          ))}
        </ol>
      )}
    </li>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url)
    return (
      <img
        src={url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-site-bg-alt text-sm font-semibold text-site-muted">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function CommentForm({ postId }: { postId: number }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  );
  const [message, setMessage] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState('sending');
    try {
      await submitComment({
        post_id: postId,
        author_name: String(data.get('author') ?? ''),
        author_email: String(data.get('email') ?? '') || undefined,
        author_url: String(data.get('url') ?? '') || undefined,
        content: String(data.get('comment') ?? ''),
      });
      form.reset();
      setState('sent');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not submit your comment.'
      );
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <p className="mt-8 rounded-site border border-site-border bg-site-bg-alt p-4 text-sm">
        Thanks! Your comment is awaiting moderation.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 grid gap-4">
      <h3 className="text-lg">Leave a reply</h3>
      <label className="grid gap-1 text-sm">
        Comment
        <textarea name="comment" required rows={5} className={inputClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          Name
          <input name="author" required className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          Email
          <input name="email" type="email" className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          Website
          <input name="url" type="url" className={inputClass} />
        </label>
      </div>
      {state === 'error' && (
        <p className="m-0 text-sm text-red-700">{message}</p>
      )}
      <div>
        <button
          type="submit"
          disabled={state === 'sending'}
          className="rounded-site bg-site-accent px-5 py-2.5 text-sm font-semibold text-site-accent-fg disabled:opacity-60"
        >
          {state === 'sending' ? 'Posting…' : 'Post comment'}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  'rounded-site border border-site-border bg-site-bg px-3 py-2 text-site-fg outline-none focus:border-site-accent';
