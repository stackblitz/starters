import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { countComments, deleteComment, listComments } from '@/admin/api';
import {
  Button,
  EmptyState,
  ErrorNote,
  PageHeader,
  Pager,
  Spinner,
  Table,
  Td,
  Th,
  useToast,
} from '@/admin/components/ui';
import { errorMessage, isRejectedByUser, useAsync, useCanEdit } from '@/admin/hooks';
import { formatDateTime, portableTextToHtml } from '@/lib/cms';
import { sanitizeHtml } from '@/lib/sanitize';

const PER_PAGE = 20;

/** Imported comments: read-only list with delete. */
export default function Comments() {
  const [page, setPage] = useState(1);
  const toast = useToast();
  const canEdit = useCanEdit();

  const list = useAsync(
    () => Promise.all([listComments({ page, perPage: PER_PAGE }), countComments()]),
    [page]
  );
  const comments = list.data?.[0] ?? [];
  const total = list.data?.[1] ?? 0;

  async function destroy(id: number) {
    try {
      await deleteComment(id);
      toast('Deleted');
      await list.refetch();
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    }
  }

  return (
    <>
      <PageHeader title="Comments" description="Comments imported from WordPress. They are shown read-only on the site." />
      {list.error && <ErrorNote message={list.error} />}
      {list.loading && !list.data ? (
        <Spinner />
      ) : !comments.length ? (
        <EmptyState title="No comments" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th className="w-44">Author</Th>
                <Th>Comment</Th>
                <Th className="w-48">In response to</Th>
                <Th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {comments.map((comment) => (
                <tr key={comment.id} className="group hover:bg-bolt-ds-bgHover">
                  <Td>
                    <p className="m-0 font-medium">{comment.author_name ?? 'Anonymous'}</p>
                  </Td>
                  <Td>
                    <p className="m-0 text-xs text-bolt-ds-textTertiary">{formatDateTime(comment.created_at)}</p>
                    <div
                      className="entry-content mt-1 line-clamp-3 text-sm [&_p]:m-0"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(portableTextToHtml(comment.body ?? [])) }}
                    />
                  </Td>
                  <Td>
                    {comment.post_slug ? (
                      <a
                        href={`/${comment.post_slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="no-underline hover:text-bolt-ds-brand"
                      >
                        {comment.post_title || comment.post_slug}
                      </a>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 size={14} />}
                        title="Delete permanently"
                        disabled={!canEdit}
                        onClick={() => destroy(comment.id)}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager
            page={page}
            pages={Math.max(1, Math.ceil(total / PER_PAGE))}
            total={total}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}
