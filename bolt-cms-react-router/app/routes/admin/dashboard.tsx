import { FileText, Files, Image, MessageSquare, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  getAdminSettings,
  getCommentCounts,
  getPostTypeCounts,
  listContent,
  listMedia,
  savePost,
  summarizeTypes,
  listComments,
} from '@/admin/api';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Spinner,
  statusTone,
  Textarea,
  useToast,
} from '@/admin/components/ui';
import { useAsync } from '@/admin/hooks';
import { typeLabel } from '@/admin/labels';
import { formatDateTime, pluralize, stripHtml, truncate } from '@/lib/cms';

export default function Dashboard() {
  const glance = useAsync(async () => {
    const [types, comments, media, settings] = await Promise.all([
      getPostTypeCounts(),
      getCommentCounts(),
      listMedia({ perPage: 1 }),
      getAdminSettings(),
    ]);
    return {
      types: summarizeTypes(types),
      comments,
      mediaTotal: media.count ?? 0,
      settings,
    };
  }, []);

  const recent = useAsync(
    async () =>
      (await listContent({ type: 'post', status: 'all', perPage: 6 })).data,
    []
  );
  const pending = useAsync(
    async () => (await listComments({ status: 'hold', perPage: 5 })).data,
    []
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          glance.data
            ? `${glance.data.settings.site_title} · ${glance.data.settings.tagline}`
            : undefined
        }
        actions={
          <Button
            variant="primary"
            icon={<Plus size={14} />}
            onClick={() => (window.location.href = '/admin/content/post/new')}
          >
            New post
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="At a glance" className="lg:col-span-1">
          {glance.loading ? (
            <Spinner />
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0 text-sm">
              {glance.data?.types.map((t) => (
                <li key={t.type}>
                  <Link
                    to={`/admin/content/${t.type}`}
                    className="flex items-center gap-2 text-bolt-ds-textPrimary no-underline hover:text-bolt-ds-brand"
                  >
                    {t.type === 'page' ? (
                      <Files size={14} />
                    ) : (
                      <FileText size={14} />
                    )}
                    <span>
                      {t.byStatus.publish ?? 0}{' '}
                      {typeLabel(t.type, (t.byStatus.publish ?? 0) !== 1)}
                    </span>
                    {(t.byStatus.draft ?? 0) > 0 && (
                      <Badge tone="warning">{t.byStatus.draft} draft</Badge>
                    )}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/admin/media"
                  className="flex items-center gap-2 no-underline hover:text-bolt-ds-brand"
                >
                  <Image size={14} />{' '}
                  {pluralize(glance.data?.mediaTotal ?? 0, 'media file')}
                </Link>
              </li>
              <li>
                <Link
                  to="/admin/comments"
                  className="flex items-center gap-2 no-underline hover:text-bolt-ds-brand"
                >
                  <MessageSquare size={14} />{' '}
                  {pluralize(glance.data?.comments.approved ?? 0, 'comment')}
                  {(glance.data?.comments.hold ?? 0) > 0 && (
                    <Badge tone="warning">
                      {glance.data?.comments.hold} in moderation
                    </Badge>
                  )}
                </Link>
              </li>
            </ul>
          )}
          {glance.data?.settings.imported_from && (
            <p className="m-0 mt-4 border-t border-bolt-ds-borderSecondary pt-3 text-xs text-bolt-ds-textTertiary">
              Imported from {glance.data.settings.imported_from}
            </p>
          )}
        </Card>

        <QuickDraft />

        <Card title="Recent posts" className="lg:col-span-2" padded={false}>
          {recent.loading ? (
            <Spinner />
          ) : (
            <ul className="m-0 list-none divide-y divide-bolt-ds-borderSecondary p-0 text-sm">
              {recent.data?.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <Link
                    to={`/admin/content/post/${p.id}`}
                    className="truncate font-medium no-underline hover:text-bolt-ds-brand"
                  >
                    {p.title || '(no title)'}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-bolt-ds-textTertiary">
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                    {formatDateTime(p.date)}
                  </span>
                </li>
              ))}
              {recent.data?.length === 0 && (
                <li className="px-4 py-6 text-center text-bolt-ds-textTertiary">
                  No posts yet.
                </li>
              )}
            </ul>
          )}
        </Card>

        <Card title="Awaiting moderation" padded={false}>
          {pending.loading ? (
            <Spinner />
          ) : pending.data?.length ? (
            <ul className="m-0 list-none divide-y divide-bolt-ds-borderSecondary p-0 text-sm">
              {pending.data.map((c) => (
                <li key={c.id} className="px-4 py-2.5">
                  <p className="m-0 text-xs text-bolt-ds-textTertiary">
                    <strong className="text-bolt-ds-textSecondary">
                      {c.author_name}
                    </strong>{' '}
                    on {c.post?.title ?? 'a post'}
                  </p>
                  <p className="m-0 mt-0.5 line-clamp-2">
                    {truncate(stripHtml(c.content_html), 120)}
                  </p>
                </li>
              ))}
              <li className="px-4 py-2 text-xs">
                <Link
                  to="/admin/comments"
                  className="no-underline text-bolt-ds-brand"
                >
                  Moderate comments →
                </Link>
              </li>
            </ul>
          ) : (
            <p className="m-0 px-4 py-6 text-center text-sm text-bolt-ds-textTertiary">
              Nothing waiting. Nice.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

function QuickDraft() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  async function save() {
    setSaving(true);
    try {
      const post = await savePost({
        type: 'post',
        status: 'draft',
        title,
        slug: title
          ? title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
          : `draft-${Date.now()}`,
        content_html: content
          ? `<p>${content
              .replace(/\n{2,}/g, '</p><p>')
              .replace(/\n/g, '<br />')}</p>`
          : '',
        author_id: 1,
      });
      toast('Draft saved');
      navigate(`/admin/content/post/${post.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save draft', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Quick draft">
      <div className="grid gap-3">
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
        </Field>
        <Field label="Content">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={4}
          />
        </Field>
        <div>
          <Button
            variant="primary"
            size="sm"
            loading={saving}
            disabled={!title && !content}
            onClick={save}
          >
            Save draft
          </Button>
        </div>
      </div>
    </Card>
  );
}
