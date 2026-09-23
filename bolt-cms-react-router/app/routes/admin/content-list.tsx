import { ExternalLink, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import {
  deletePostPermanently,
  getPostTypeCounts,
  listContent,
  setPostStatus,
} from '@/admin/api';
import {
  Badge,
  Button,
  confirmAction,
  EmptyState,
  ErrorNote,
  Input,
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
import { useAsync, useDebounced } from '@/admin/hooks';
import { typeLabel } from '@/admin/labels';
import { formatDateTime, type PostStatus } from '@/lib/cms';

type StatusTab = 'all' | PostStatus;

const PER_PAGE = 20;

export default function ContentList() {
  const { type = 'post' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const status = (params.get('status') as StatusTab | null) ?? 'all';
  const page = Number(params.get('page') ?? '1') || 1;
  const [search, setSearch] = useState(params.get('s') ?? '');
  const debounced = useDebounced(search);

  const counts = useAsync(async () => {
    const all = await getPostTypeCounts();
    const mine: Record<string, number> = {};
    for (const c of all) if (c.type === type) mine[c.status] = c.count;
    return mine;
  }, [type]);

  const list = useAsync(
    () =>
      listContent({ type, status, search: debounced, page, perPage: PER_PAGE }),
    [type, status, debounced, page]
  );

  const set = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p);
  };

  async function changeStatus(id: number, next: PostStatus, label: string) {
    try {
      await setPostStatus(id, next);
      toast(label);
      await Promise.all([list.refetch(), counts.refetch()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed', 'error');
    }
  }

  async function destroy(id: number) {
    if (!confirmAction('Permanently delete this item? This cannot be undone.'))
      return;
    try {
      await deletePostPermanently(id);
      toast('Deleted permanently');
      await Promise.all([list.refetch(), counts.refetch()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  }

  const total = list.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const c = counts.data ?? {};
  const nonTrash = Object.entries(c).reduce(
    (sum, [s, n]) => (s === 'trash' ? sum : sum + n),
    0
  );

  const allTabs: Array<{ value: StatusTab; label: string; count?: number }> = [
    { value: 'all', label: 'All', count: nonTrash },
    { value: 'publish', label: 'Published', count: c.publish },
    { value: 'draft', label: 'Drafts', count: c.draft },
    { value: 'pending', label: 'Pending', count: c.pending },
    { value: 'private', label: 'Private', count: c.private },
    { value: 'trash', label: 'Trash', count: c.trash },
  ];
  const tabs = allTabs.filter(
    (t) =>
      t.value === 'all' ||
      t.value === 'publish' ||
      t.value === 'draft' ||
      (t.count ?? 0) > 0
  );

  return (
    <>
      <PageHeader
        title={typeLabel(type, true)}
        actions={
          <Button
            variant="primary"
            icon={<Plus size={14} />}
            onClick={() => navigate(`/admin/content/${type}/new`)}
          >
            Add new
          </Button>
        }
      />

      <Tabs
        value={status}
        onChange={(v) => set({ status: v === 'all' ? null : v, page: null })}
        items={tabs}
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <Input
          placeholder={`Search ${typeLabel(type, true).toLowerCase()}…`}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            set({ s: e.target.value || null, page: null });
          }}
          className="max-w-xs"
        />
      </div>

      {list.error && <ErrorNote message={list.error} />}
      {list.loading && !list.data ? (
        <Spinner />
      ) : !list.data?.data.length ? (
        <EmptyState
          title={
            status === 'trash'
              ? 'Trash is empty'
              : `No ${typeLabel(type, true).toLowerCase()} found`
          }
          description={
            status === 'all' && !debounced
              ? `Create your first ${typeLabel(
                  type
                ).toLowerCase()} to see it here.`
              : undefined
          }
          action={
            status === 'all' && !debounced ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/admin/content/${type}/new`)}
              >
                Add new
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th className="w-36">Author</Th>
                <Th className="w-28">Status</Th>
                <Th className="w-40">Date</Th>
                <Th className="w-32" />
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((post) => (
                <tr key={post.id} className="group hover:bg-bolt-ds-bgHover">
                  <Td>
                    <Link
                      to={`/admin/content/${type}/${post.id}`}
                      className="font-medium no-underline hover:text-bolt-ds-brand"
                    >
                      {post.title || '(no title)'}
                    </Link>
                    <p className="m-0 mt-0.5 font-mono text-[11px] text-bolt-ds-textTertiary">
                      /{post.slug}
                    </p>
                  </Td>
                  <Td className="text-bolt-ds-textSecondary">
                    {post.author?.name ?? '—'}
                  </Td>
                  <Td>
                    <Badge tone={statusTone(post.status)}>{post.status}</Badge>
                  </Td>
                  <Td className="text-xs text-bolt-ds-textTertiary">
                    {formatDateTime(post.date)}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      {post.status === 'publish' && (
                        <a
                          href={`/${post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-bolt-ds-iconSecondary hover:bg-bolt-ds-utilHover"
                          title="View"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {post.status === 'trash' ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<RotateCcw size={14} />}
                            title="Restore"
                            onClick={() =>
                              changeStatus(
                                post.id,
                                'draft',
                                'Restored to drafts'
                              )
                            }
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Trash2 size={14} />}
                            title="Delete permanently"
                            onClick={() => destroy(post.id)}
                          />
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 size={14} />}
                          title="Move to trash"
                          onClick={() =>
                            changeStatus(post.id, 'trash', 'Moved to trash')
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
            pages={pages}
            total={total}
            onChange={(p) => set({ page: p > 1 ? String(p) : null })}
          />
        </>
      )}
    </>
  );
}
