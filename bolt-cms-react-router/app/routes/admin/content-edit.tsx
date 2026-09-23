import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  getFields,
  getPost,
  getPostTermIds,
  getTaxonomies,
  listTerms,
  savePost,
  setPostStatus,
  setPostTerms,
} from '@/admin/api';
import { FieldGroup, hasGroup } from '@/admin/components/fields/FieldGroup';
import { RichTextEditor } from '@/admin/components/editor/RichTextEditor';
import { TermsPanel } from '@/admin/components/TermsPanel';
import {
  Badge,
  Button,
  Card,
  confirmAction,
  ErrorNote,
  Input,
  Spinner,
  statusTone,
  useToast,
} from '@/admin/components/ui';
import { useAsync } from '@/admin/hooks';
import { taxonomiesForType, typeLabel } from '@/admin/labels';
import { slugify } from '@/lib/cms/format';
import type { FieldDef, Post, Term } from '@/lib/cms/types';

type Row = Record<string, unknown>;

const OWN_COLUMNS = ['title', 'content_html', 'content_json'];

function emptyPost(type: string): Row {
  return {
    type,
    status: 'draft',
    title: '',
    slug: '',
    excerpt: '',
    content_html: '',
    content_json: null,
    author_id: 1,
    featured_media_id: null,
    parent_id: null,
    menu_order: 0,
    date: new Date().toISOString(),
    comment_status: type === 'post' ? 'open' : 'closed',
    sticky: false,
    format: 'standard',
    template: '',
    seo: {},
  };
}

export default function ContentEdit() {
  const { type = 'post', id } = useParams();
  const postId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const toast = useToast();

  const [row, setRow] = useState<Row | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [termsByTax, setTermsByTax] = useState<Record<string, Term[]>>({});
  const [selectedByTax, setSelectedByTax] = useState<Record<string, number[]>>(
    {}
  );

  const initial = useAsync(async () => {
    const [fields, post, taxonomies] = await Promise.all([
      getFields('cms_posts'),
      postId ? getPost(postId) : Promise.resolve<Post | null>(null),
      getTaxonomies(),
    ]);
    if (postId && !post) throw new Error('This item does not exist.');

    const applicable = taxonomiesForType(
      type,
      taxonomies.map((t) => t.taxonomy)
    );
    const termLists = await Promise.all(
      applicable.map((tax) => listTerms(tax))
    );
    const byTax: Record<string, Term[]> = {};
    applicable.forEach((tax, i) => (byTax[tax] = termLists[i]));

    const selected: Record<string, number[]> = {};
    if (post) {
      const ids = await getPostTermIds(post.id);
      for (const tax of applicable) {
        const inTax = new Set(byTax[tax].map((t) => t.id));
        selected[tax] = ids.filter((tid) => inTax.has(tid));
      }
    } else {
      for (const tax of applicable) selected[tax] = [];
      // WordPress default: new posts land in "Uncategorized".
      const uncategorized = byTax.category?.find(
        (t) => t.slug === 'uncategorized'
      );
      if (uncategorized) selected.category = [uncategorized.id];
    }

    return {
      fields,
      post: (post as Row | null) ?? emptyPost(type),
      byTax,
      selected,
      applicable,
    };
  }, [type, postId]);

  useEffect(() => {
    if (!initial.data) return;
    setRow(initial.data.post);
    setTermsByTax(initial.data.byTax);
    setSelectedByTax(initial.data.selected);
    setDirty(false);
  }, [initial.data]);

  const fields: FieldDef[] = initial.data?.fields ?? [];

  const update = (column: string, value: unknown) => {
    setRow((r) => (r ? { ...r, [column]: value } : r));
    setDirty(true);
  };

  const publicPath = useMemo(
    () => (row?.slug ? `/${String(row.slug)}` : null),
    [row?.slug]
  );

  async function save(nextStatus?: Post['status']) {
    if (!row) return;
    setSaving(true);
    try {
      const values: Row = { ...row };
      if (nextStatus) values.status = nextStatus;
      if (!values.slug)
        values.slug =
          slugify(String(values.title ?? '')) ||
          `untitled-${Date.now().toString(36)}`;
      // Only send real columns.
      const allowed = new Set([
        ...fields.map((f) => f.column_name),
        'type',
        'status',
        'slug',
        'title',
        'content_html',
        'content_json',
        'author_id',
      ]);
      for (const key of Object.keys(values))
        if (!allowed.has(key)) delete values[key];

      const saved = await savePost(
        values as Partial<Post> & { type: string },
        postId
      );

      await Promise.all(
        Object.entries(selectedByTax).map(([tax, ids]) =>
          setPostTerms(
            saved.id,
            (termsByTax[tax] ?? []).map((t) => t.id),
            ids
          )
        )
      );

      setDirty(false);
      toast(nextStatus === 'publish' ? 'Published' : 'Saved');
      if (!postId)
        navigate(`/admin/content/${type}/${saved.id}`, { replace: true });
      else setRow((r) => (r ? { ...r, ...(saved as unknown as Row) } : r));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function trash() {
    if (!postId || !confirmAction('Move this item to the trash?')) return;
    try {
      await setPostStatus(postId, 'trash');
      toast('Moved to trash');
      navigate(`/admin/content/${type}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not trash', 'error');
    }
  }

  if (initial.error) return <ErrorNote message={initial.error} />;
  if (!row) return <Spinner />;

  const status = String(row.status);
  const isPublished = status === 'publish';

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to={`/admin/content/${type}`}
            className="inline-flex items-center gap-1 text-sm text-bolt-ds-textTertiary no-underline hover:text-bolt-ds-textPrimary"
          >
            <ArrowLeft size={14} /> {typeLabel(type, true)}
          </Link>
          <Badge tone={statusTone(status)}>{status}</Badge>
          {dirty && (
            <span className="text-xs text-bolt-ds-textTertiary">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {postId && isPublished && publicPath && (
            <Button
              variant="ghost"
              icon={<ExternalLink size={14} />}
              onClick={() => window.open(publicPath, '_blank')}
            >
              View
            </Button>
          )}
          {postId && (
            <Button variant="ghost" icon={<Trash2 size={14} />} onClick={trash}>
              Trash
            </Button>
          )}
          {!isPublished && (
            <Button loading={saving} onClick={() => save()}>
              Save draft
            </Button>
          )}
          <Button
            variant="primary"
            loading={saving}
            onClick={() => save(isPublished ? undefined : 'publish')}
          >
            {isPublished ? 'Update' : 'Publish'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-4">
          <Input
            value={String(row.title ?? '')}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Add title"
            className="h-12 text-xl font-semibold"
            aria-label="Title"
          />
          <RichTextEditor
            html={String(row.content_html ?? '')}
            json={row.content_json}
            onChange={({ html, json }) => {
              setRow((r) =>
                r ? { ...r, content_html: html, content_json: json } : r
              );
              setDirty(true);
            }}
          />
          {hasGroup(fields, 'main', OWN_COLUMNS) && (
            <Card>
              <FieldGroup
                fields={fields}
                group="main"
                row={row}
                table="cms_posts"
                onChange={update}
                exclude={OWN_COLUMNS}
              />
            </Card>
          )}
        </div>

        <aside className="grid content-start gap-4">
          {hasGroup(fields, 'sidebar') && (
            <Card title="Publish">
              <FieldGroup
                fields={fields}
                group="sidebar"
                row={row}
                table="cms_posts"
                onChange={update}
              />
            </Card>
          )}

          {(initial.data?.applicable ?? []).map((tax) => (
            <TermsPanel
              key={tax}
              taxonomy={tax}
              terms={termsByTax[tax] ?? []}
              selected={selectedByTax[tax] ?? []}
              onChange={(ids) => {
                setSelectedByTax((s) => ({ ...s, [tax]: ids }));
                setDirty(true);
              }}
              onTermCreated={(term) =>
                setTermsByTax((t) => ({
                  ...t,
                  [tax]: [...(t[tax] ?? []), term],
                }))
              }
            />
          ))}

          {hasGroup(fields, 'seo') && (
            <Card title="SEO">
              <FieldGroup
                fields={fields}
                group="seo"
                row={row}
                table="cms_posts"
                onChange={update}
              />
            </Card>
          )}

          {hasGroup(fields, 'advanced') && (
            <details className="rounded-lg border border-bolt-ds-borderSecondary bg-bolt-ds-bgAlt">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold">
                Advanced
              </summary>
              <div className="border-t border-bolt-ds-borderSecondary p-4">
                <FieldGroup
                  fields={fields}
                  group="advanced"
                  row={row}
                  table="cms_posts"
                  onChange={update}
                />
              </div>
            </details>
          )}
        </aside>
      </div>
    </>
  );
}
