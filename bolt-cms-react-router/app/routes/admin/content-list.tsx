import { ExternalLink, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import {
  CONTENT_TYPES,
  countContent,
  deleteContent,
  isContentType,
  listCollection,
  listContent,
  setContentStatus,
  STATUSES,
  type ContentType,
} from '@/admin/api';
import {
  Badge,
  Button,
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
import {
  errorMessage,
  isRejectedByUser,
  useAsync,
  useCanEdit,
  useDebounced,
} from '@/admin/hooks';
import { formatDateTime } from '@/lib/cms';

type StatusTab = 'all' | (typeof STATUSES)[number];

const PER_PAGE = 20;

const TAB_LABELS: Record<StatusTab, string> = {
  all: 'All',
  publish: 'Published',
  draft: 'Drafts',
  trash: 'Trash',
};

export default function ContentListRoute() {
  const { type } = useParams();
  if (!isContentType(type)) return <ErrorNote message="Unknown content type" />;
  return <ContentList key={type} type={type} />;
}

function ContentList({ type }: { type: ContentType }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const canEdit = useCanEdit();
  const { label, singular } = CONTENT_TYPES[type];

  const param = params.get('status');
  const status: StatusTab =
    param && (STATUSES as readonly string[]).includes(param)
      ? (param as StatusTab)
      : 'all';
  const page = Number(params.get('page') ?? '1') || 1;
  const [search, setSearch] = useState(params.get('s') ?? '');
  const debounced = useDebounced(search);

  const counts = useAsync(() => countContent(type), [type]);
  const authors = useAsync(() => listCollection('author'), []);
  const list = useAsync(
    () =>
      listContent(type, { status, search: debounced, page, perPage: PER_PAGE }),
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

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast(done);
      await Promise.all([list.refetch(), counts.refetch()]);
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    }
  }

  const c = counts.data ?? {};
  const nonTrash = Object.entries(c).reduce(
    (sum, [s, n]) => (s === 'trash' ? sum : sum + n),
    0
  );
  const rows = list.data ?? [];
  // ponytail: no count query per search term; with a search the pager only knows "is there a next page"
  const known = debounced ? null : status === 'all' ? nonTrash : c[status] ?? 0;
  const total = known ?? (page - 1) * PER_PAGE + rows.length;
  const pages =
    known !== null
      ? Math.max(1, Math.ceil(known / PER_PAGE))
      : page + (rows.length === PER_PAGE ? 1 : 0);
  const authorName = new Map(authors.data?.map((a) => [a.id, a.name]));

  return (
    <>
      <PageHeader
        title={label}
        actions={
          <Button
            variant="primary"
            icon={<Plus size={14} />}
            disabled={!canEdit}
            onClick={() => navigate(`/bolt-admin/content/${type}/new`)}
          >
            Add new
          </Button>
        }
      />

      <Tabs
        value={status}
        onChange={(v) => set({ status: v === 'all' ? null : v, page: null })}
        items={(['all', ...STATUSES] as StatusTab[]).map((value) => ({
          value,
          label: TAB_LABELS[value],
          count: value === 'all' ? nonTrash : c[value] ?? 0,
        }))}
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <Input
          placeholder={`Search ${label.toLowerCase()}…`}
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
      ) : !rows.length ? (
        <EmptyState
          title={
            status === 'trash'
              ? 'Trash is empty'
              : `No ${label.toLowerCase()} found`
          }
          description={
            status === 'all' && !debounced
              ? `Create your first ${singular} to see it here.`
              : undefined
          }
          action={
            status === 'all' && !debounced ? (
              <Button
                variant="primary"
                size="sm"
                disabled={!canEdit}
                onClick={() => navigate(`/bolt-admin/content/${type}/new`)}
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
              {rows.map((post) => {
                const postStatus = post.status ?? 'publish';
                return (
                  <tr key={post.id} className="group hover:bg-bolt-ds-bgHover">
                    <Td>
                      <Link
                        to={`/bolt-admin/content/${type}/${post.id}`}
                        className="font-medium no-underline hover:text-bolt-ds-brand"
                      >
                        {post.title || '(no title)'}
                      </Link>
                      <p className="m-0 mt-0.5 font-mono text-[11px] text-bolt-ds-textTertiary">
                        /{post.slug}
                      </p>
                    </Td>
                    <Td className="text-bolt-ds-textSecondary">
                      {(post.author !== null && authorName.get(post.author)) ||
                        '—'}
                    </Td>
                    <Td>
                      <Badge tone={statusTone(postStatus)}>{postStatus}</Badge>
                    </Td>
                    <Td className="text-xs text-bolt-ds-textTertiary">
                      {formatDateTime(post.published_at)}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        {postStatus === 'publish' && (
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
                        {postStatus === 'trash' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<RotateCcw size={14} />}
                            title="Restore"
                            disabled={!canEdit}
                            onClick={() =>
                              run(
                                () => setContentStatus(type, post.id, 'draft'),
                                'Restored to drafts'
                              )
                            }
                          />
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Trash2 size={14} />}
                            title="Move to trash"
                            disabled={!canEdit}
                            onClick={() =>
                              run(
                                () => setContentStatus(type, post.id, 'trash'),
                                'Moved to trash'
                              )
                            }
                          />
                        )}
                        {status === 'trash' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Trash2 size={14} />}
                            title="Delete permanently"
                            disabled={!canEdit}
                            onClick={() =>
                              run(
                                () => deleteContent(type, post.id),
                                'Deleted permanently'
                              )
                            }
                          />
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
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
