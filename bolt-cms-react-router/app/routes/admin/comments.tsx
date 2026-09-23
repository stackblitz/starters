import { Check, ShieldAlert, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  deleteRow,
  getCommentCounts,
  listComments,
  updateRow,
} from '@/admin/api';
import {
  Badge,
  Button,
  confirmAction,
  EmptyState,
  ErrorNote,
  PageHeader,
  Pager,
  Spinner,
  statusTone,
  Table,
  Tabs,
  Td,
  Th,
  useToast,
} from '@/admin/components/ui';
import { useAsync } from '@/admin/hooks';
import { formatDateTime, type CommentStatus } from '@/lib/cms';
import { sanitizeHtml } from '@/lib/sanitize';

type Tab = 'all' | CommentStatus;
const PER_PAGE = 20;

export default function Comments() {
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const toast = useToast();

  const counts = useAsync(getCommentCounts, []);
  const list = useAsync(
    () => listComments({ status: tab, page, perPage: PER_PAGE }),
    [tab, page]
  );

  async function setStatus(id: number, status: CommentStatus, label: string) {
    try {
      await updateRow('cms_comments', id, { status });
      toast(label);
      await Promise.all([list.refetch(), counts.refetch()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed', 'error');
    }
  }

  async function destroy(id: number) {
    if (!confirmAction('Delete this comment permanently?')) return;
    try {
      await deleteRow('cms_comments', id);
      toast('Deleted');
      await Promise.all([list.refetch(), counts.refetch()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  }

  const c = counts.data ?? {};
  const total = list.data?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Comments"
        description="Comments submitted on the site wait here until approved."
      />
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          setPage(1);
        }}
        items={[
          {
            value: 'all',
            label: 'All',
            count: Object.values(c).reduce((a, b) => a + b, 0),
          },
          { value: 'hold', label: 'Pending', count: c.hold },
          { value: 'approved', label: 'Approved', count: c.approved },
          { value: 'spam', label: 'Spam', count: c.spam },
          { value: 'trash', label: 'Trash', count: c.trash },
        ]}
      />
      {list.error && <ErrorNote message={list.error} />}
      {list.loading && !list.data ? (
        <Spinner />
      ) : !list.data?.data.length ? (
        <EmptyState
          title="No comments"
          description={
            tab === 'hold' ? 'Nothing awaiting moderation.' : undefined
          }
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th className="w-44">Author</Th>
                <Th>Comment</Th>
                <Th className="w-48">In response to</Th>
                <Th className="w-40" />
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((comment) => (
                <tr key={comment.id} className="group hover:bg-bolt-ds-bgHover">
                  <Td>
                    <p className="m-0 font-medium">{comment.author_name}</p>
                    {comment.author_email && (
                      <p className="m-0 truncate text-xs text-bolt-ds-textTertiary">
                        {comment.author_email}
                      </p>
                    )}
                    <Badge tone={statusTone(comment.status)}>
                      {comment.status}
                    </Badge>
                  </Td>
                  <Td>
                    <p className="m-0 text-xs text-bolt-ds-textTertiary">
                      {formatDateTime(comment.date)}
                    </p>
                    <div
                      className="entry-content mt-1 text-sm [&_p]:m-0"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(comment.content_html),
                      }}
                    />
                  </Td>
                  <Td>
                    {comment.post ? (
                      <Link
                        to={`/admin/content/post/${comment.post.id}`}
                        className="no-underline hover:text-bolt-ds-brand"
                      >
                        {comment.post.title}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      {comment.status !== 'approved' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Check size={14} />}
                          title="Approve"
                          onClick={() =>
                            setStatus(comment.id, 'approved', 'Approved')
                          }
                        />
                      )}
                      {comment.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Undo2 size={14} />}
                          title="Unapprove"
                          onClick={() =>
                            setStatus(comment.id, 'hold', 'Moved to pending')
                          }
                        />
                      )}
                      {comment.status !== 'spam' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<ShieldAlert size={14} />}
                          title="Spam"
                          onClick={() =>
                            setStatus(comment.id, 'spam', 'Marked as spam')
                          }
                        />
                      )}
                      {comment.status === 'trash' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 size={14} />}
                          title="Delete permanently"
                          onClick={() => destroy(comment.id)}
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 size={14} />}
                          title="Trash"
                          onClick={() =>
                            setStatus(comment.id, 'trash', 'Moved to trash')
                          }
                        />
                      )}
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
