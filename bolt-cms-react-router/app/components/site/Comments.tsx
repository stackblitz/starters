import { formatDate, portableTextToHtml, type Comment } from '@/lib/cms';
import { sanitizeHtml } from '@/lib/sanitize';

/** Read-only: comments are imported from WordPress; the starter has no comment form. */
export function Comments({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) return null;

  return (
    <section
      id="comments"
      className="site-measure mt-16 border-t border-site-border pt-10"
    >
      <h2 className="text-2xl">
        {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
      </h2>
      <ol className="mt-8 list-none space-y-8 p-0">
        {buildTree(comments).map((c) => (
          <CommentItem key={c.id} comment={c} />
        ))}
      </ol>
    </section>
  );
}

type CommentNode = Comment & { children: CommentNode[] };

function buildTree(comments: Comment[]): CommentNode[] {
  const byId = new Map<number, CommentNode>();
  comments.forEach((c) => byId.set(c.id, { ...c, children: [] }));
  const roots: CommentNode[] = [];
  byId.forEach((node) => {
    const parent = node.parent ? byId.get(node.parent) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function CommentItem({ comment }: { comment: CommentNode }) {
  const name = comment.author_name ?? 'Anonymous';
  return (
    <li>
      <article className="flex gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-site-bg-alt text-sm font-semibold text-site-muted">
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm">
            <span className="font-semibold">{name}</span>
            {comment.created_at && (
              <span className="text-site-muted">
                {' '}
                · {formatDate(comment.created_at)}
              </span>
            )}
          </p>
          <div
            className="entry-content mt-1 text-[0.95em]"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(portableTextToHtml(comment.body ?? [])),
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
