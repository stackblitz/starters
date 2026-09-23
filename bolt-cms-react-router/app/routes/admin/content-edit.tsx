import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  CONTENT_TYPES,
  getContent,
  getFields,
  insertContent,
  isContentType,
  setContentStatus,
  STATUSES,
  updateContent,
  type ContentInput,
  type ContentType,
} from '@/admin/api';
import { RichTextEditor } from '@/admin/components/editor/RichTextEditor';
import { FieldInput } from '@/admin/components/fields/FieldInput';
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  Select,
  Spinner,
  statusTone,
  useToast,
} from '@/admin/components/ui';
import {
  errorMessage,
  isRejectedByUser,
  useAsync,
  useCanEdit,
} from '@/admin/hooks';
import { slugify } from '@/lib/cms/format';
import type { FieldDef } from '@/lib/cms/types';

/** Where each `cms_fields` entry of a post/page renders; unknown fields are not shown. */
const FIELD_LAYOUT = {
  main: ['title', 'body', 'excerpt'],
  sidebar: [
    'status',
    'slug',
    'published_at',
    'author',
    'featured_image',
    'categories',
    'tags',
    'parent',
    'menu_order',
  ],
  hidden: ['content_html', 'link', 'modified_at'],
};
const HIDDEN_FOR_PAGE = ['categories', 'tags'];

const EMPTY: ContentInput = {
  title: '',
  slug: '',
  excerpt: null,
  body: null,
  content_html: null,
  status: 'draft',
  author: null,
  featured_image: null,
  categories: [],
  tags: [],
  parent: null,
  menu_order: null,
  published_at: null,
};

export default function ContentEditRoute() {
  const { type, id } = useParams();
  const postId = id ? Number(id) : null;

  const initial = useAsync(async () => {
    if (!isContentType(type)) throw new Error('Unknown content type');
    const [fields, post] = await Promise.all([
      getFields(type),
      postId ? getContent(type, postId) : null,
    ]);
    if (postId && !post) throw new Error('This item does not exist.');
    return { fields, post };
  }, [type, postId]);

  if (initial.error) return <ErrorNote message={initial.error} />;
  if (!initial.data || !isContentType(type)) return <Spinner />;

  const { post } = initial.data;
  return (
    <ContentEditor
      key={post?.id ?? 'new'}
      type={type}
      postId={post?.id ?? null}
      fields={initial.data.fields}
      initialForm={
        post
          ? {
              title: post.title,
              slug: post.slug,
              excerpt: post.excerpt,
              body: post.body,
              content_html: post.content_html,
              status: post.status ?? 'publish',
              author: post.author,
              featured_image: post.featured_image,
              categories: post.categories,
              tags: post.tags,
              parent: post.parent,
              menu_order: post.menu_order,
              published_at: post.published_at,
            }
          : EMPTY
      }
    />
  );
}

function ContentEditor({
  type,
  postId,
  fields,
  initialForm,
}: {
  type: ContentType;
  postId: number | null;
  fields: FieldDef[];
  initialForm: ContentInput;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const canEdit = useCanEdit();
  const { label } = CONTENT_TYPES[type];

  const [form, setForm] = useState(initialForm);
  const [savedStatus, setSavedStatus] = useState(initialForm.status);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (column: string, value: unknown) => {
    setForm((f) => ({ ...f, [column]: value }));
    setDirty(true);
  };

  const hidden = type === 'page' ? HIDDEN_FOR_PAGE : [];
  const fieldsIn = (names: string[]) =>
    names.flatMap((name) =>
      hidden.includes(name) ? [] : fields.filter((f) => f.name === name)
    );
  const context = { row: { ...form, id: postId }, typeName: type };
  const renderField = (field: FieldDef) => (
    <FieldInput
      key={field.name}
      field={field}
      value={form[field.column_name as keyof ContentInput]}
      onChange={(value) => update(field.column_name, value)}
      context={context}
      disabled={!canEdit}
    />
  );

  const mainFields = fieldsIn(
    FIELD_LAYOUT.main.filter((n) => n !== 'title' && n !== 'body')
  );
  const sidebarFields = fieldsIn(
    FIELD_LAYOUT.sidebar.filter((n) => n !== 'status')
  );
  // imported rows may carry other WordPress statuses (future, private): keep them selectable
  const statusOptions: string[] = (STATUSES as readonly string[]).includes(
    form.status
  )
    ? [...STATUSES]
    : [form.status, ...STATUSES];

  async function save(nextStatus?: string) {
    setSaving(true);
    const input: ContentInput = {
      ...form,
      status: nextStatus ?? form.status,
      slug: form.slug || slugify(form.title) || `untitled-${Date.now()}`,
    };
    try {
      const saved = postId
        ? await updateContent(type, postId, input)
        : await insertContent(type, input);
      setForm(input);
      setSavedStatus(input.status);
      setDirty(false);
      toast(nextStatus === 'publish' ? 'Published' : 'Saved');
      if (!postId)
        navigate(`/bolt-admin/content/${type}/${saved.id}`, { replace: true });
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function trash() {
    if (!postId) return;
    try {
      await setContentStatus(type, postId, 'trash');
      toast('Moved to trash');
      navigate(`/bolt-admin/content/${type}`);
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    }
  }

  const isPublished = savedStatus === 'publish';

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to={`/bolt-admin/content/${type}`}
            className="inline-flex items-center gap-1 text-sm text-bolt-ds-textTertiary no-underline hover:text-bolt-ds-textPrimary"
          >
            <ArrowLeft size={14} /> {label}
          </Link>
          <Badge tone={statusTone(savedStatus)}>{savedStatus}</Badge>
          {dirty && (
            <span className="text-xs text-bolt-ds-textTertiary">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {postId && isPublished && form.slug && (
            <Button
              variant="ghost"
              icon={<ExternalLink size={14} />}
              onClick={() => window.open(`/${form.slug}`, '_blank')}
            >
              View
            </Button>
          )}
          {postId && savedStatus !== 'trash' && (
            <Button
              variant="ghost"
              icon={<Trash2 size={14} />}
              disabled={!canEdit}
              onClick={trash}
            >
              Trash
            </Button>
          )}
          {!isPublished && (
            <Button loading={saving} disabled={!canEdit} onClick={() => save()}>
              Save
            </Button>
          )}
          <Button
            variant="primary"
            loading={saving}
            disabled={!canEdit}
            onClick={() => save(isPublished ? undefined : 'publish')}
          >
            {isPublished ? 'Update' : 'Publish'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-4">
          <Input
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Add title"
            className="h-12 text-xl font-semibold"
            aria-label="Title"
            disabled={!canEdit}
          />
          <RichTextEditor
            initialBody={initialForm.body}
            initialHtml={initialForm.content_html}
            onChange={({ body, html }) => {
              setForm((f) => ({ ...f, body, content_html: html }));
              setDirty(true);
            }}
          />
          {mainFields.length > 0 && (
            <Card>
              <div className="grid gap-4">{mainFields.map(renderField)}</div>
            </Card>
          )}
        </div>

        <aside className="grid content-start gap-4">
          <Card title="Publish">
            <div className="grid gap-4">
              <Field label="Status" htmlFor="content-status">
                <Select
                  id="content-status"
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                  disabled={!canEdit}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              {sidebarFields
                .filter((f) => f.primitive !== 'array')
                .map(renderField)}
            </div>
          </Card>
          {/* category/tag arrays render as their own TermsPanel cards */}
          {sidebarFields
            .filter((f) => f.primitive === 'array')
            .map(renderField)}
        </aside>
      </div>
    </>
  );
}
