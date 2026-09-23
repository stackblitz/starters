import { FileText, Files, Image, MessageSquare, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  countAssets,
  countComments,
  countContent,
  CONTENT_TYPES,
  getAdminSettings,
  insertContent,
  listComments,
  listContent,
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
import {
  errorMessage,
  isRejectedByUser,
  useAsync,
  useCanEdit,
} from '@/admin/hooks';
import {
  escapeHtml,
  formatDateTime,
  pluralize,
  portableTextToHtml,
  slugify,
  stripHtml,
  truncate,
} from '@/lib/cms';

export default function Dashboard() {
  const navigate = useNavigate();
  const canEdit = useCanEdit();
  const glance = useAsync(async () => {
    const [post, page, comments, assets, settings] = await Promise.all([
      countContent('post'),
      countContent('page'),
      countComments(),
      countAssets(''),
      getAdminSettings(),
    ]);
    return { counts: { post, page }, comments, assets, settings };
  }, []);

  const recent = useAsync(() => listContent('post', { perPage: 6 }), []);
  const comments = useAsync(() => listComments({ perPage: 5 }), []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          glance.data
            ? [glance.data.settings.site_title, glance.data.settings.tagline]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        actions={
          <Button
            variant="primary"
            icon={<Plus size={14} />}
            disabled={!canEdit}
            onClick={() => navigate('/bolt-admin/content/post/new')}
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
              {(['post', 'page'] as const).map((type) => {
                const counts = glance.data?.counts[type] ?? {};
                const published = counts.publish ?? 0;
                return (
                  <li key={type}>
                    <Link
                      to={`/bolt-admin/content/${type}`}
                      className="flex items-center gap-2 text-bolt-ds-textPrimary no-underline hover:text-bolt-ds-brand"
                    >
                      {type === 'page' ? (
                        <Files size={14} />
                      ) : (
                        <FileText size={14} />
                      )}
                      <span>
                        {pluralize(
                          published,
                          CONTENT_TYPES[type].singular,
                          CONTENT_TYPES[type].label.toLowerCase()
                        )}
                      </span>
                      {(counts.draft ?? 0) > 0 && (
                        <Badge tone="warning">{counts.draft} draft</Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link
                  to="/bolt-admin/media"
                  className="flex items-center gap-2 no-underline hover:text-bolt-ds-brand"
                >
                  <Image size={14} />{' '}
                  {pluralize(glance.data?.assets ?? 0, 'media file')}
                </Link>
              </li>
              <li>
                <Link
                  to="/bolt-admin/comments"
                  className="flex items-center gap-2 no-underline hover:text-bolt-ds-brand"
                >
                  <MessageSquare size={14} />{' '}
                  {pluralize(glance.data?.comments ?? 0, 'comment')}
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
                    to={`/bolt-admin/content/post/${p.id}`}
                    className="truncate font-medium no-underline hover:text-bolt-ds-brand"
                  >
                    {p.title || '(no title)'}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-bolt-ds-textTertiary">
                    <Badge tone={statusTone(p.status ?? 'publish')}>
                      {p.status ?? 'publish'}
                    </Badge>
                    {formatDateTime(p.published_at)}
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

        <Card title="Recent comments" padded={false}>
          {comments.loading ? (
            <Spinner />
          ) : comments.data?.length ? (
            <ul className="m-0 list-none divide-y divide-bolt-ds-borderSecondary p-0 text-sm">
              {comments.data.map((c) => (
                <li key={c.id} className="px-4 py-2.5">
                  <p className="m-0 text-xs text-bolt-ds-textTertiary">
                    <strong className="text-bolt-ds-textSecondary">
                      {c.author_name ?? 'Anonymous'}
                    </strong>{' '}
                    on {c.post_title ?? 'a post'}
                  </p>
                  <p className="m-0 mt-0.5 line-clamp-2">
                    {truncate(stripHtml(portableTextToHtml(c.body ?? [])), 120)}
                  </p>
                </li>
              ))}
              <li className="px-4 py-2 text-xs">
                <Link
                  to="/bolt-admin/comments"
                  className="no-underline text-bolt-ds-brand"
                >
                  All comments →
                </Link>
              </li>
            </ul>
          ) : (
            <p className="m-0 px-4 py-6 text-center text-sm text-bolt-ds-textTertiary">
              No comments yet.
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
  const canEdit = useCanEdit();

  async function save() {
    setSaving(true);
    try {
      const post = await insertContent('post', {
        title,
        slug: slugify(title) || `draft-${Date.now()}`,
        excerpt: null,
        body: content
          ? [
              {
                _type: 'block',
                _key: crypto.randomUUID().slice(0, 8),
                style: 'normal',
                markDefs: [],
                children: [
                  {
                    _type: 'span',
                    _key: crypto.randomUUID().slice(0, 8),
                    text: content,
                    marks: [],
                  },
                ],
              },
            ]
          : null,
        content_html: content ? `<p>${escapeHtml(content)}</p>` : null,
        status: 'draft',
        author: null,
        featured_image: null,
        categories: [],
        tags: [],
        parent: null,
        menu_order: null,
        published_at: null,
      });
      toast('Draft saved');
      navigate(`/bolt-admin/content/post/${post.id}`);
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
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
            disabled={!canEdit || (!title && !content)}
            onClick={save}
          >
            Save draft
          </Button>
        </div>
      </div>
    </Card>
  );
}
