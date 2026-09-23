import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';

import {
  COLLECTIONS,
  deleteCollection,
  getFields,
  insertCollection,
  isCollectionKind,
  listCollection,
  updateCollection,
  type CollectionKind,
} from '@/admin/api';
import { FieldInput } from '@/admin/components/fields/FieldInput';
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  PageHeader,
  Spinner,
  Table,
  Td,
  Th,
  useToast,
} from '@/admin/components/ui';
import {
  errorMessage,
  isRejectedByUser,
  useAsync,
  useCanEdit,
} from '@/admin/hooks';
import { slugify } from '@/lib/cms/format';
import type { Author, Term } from '@/lib/cms/types';

type Row = Record<string, unknown>;

/** Authors, categories, tags: WordPress' two-column terms screen. */
export default function Collection() {
  const { kind } = useParams();
  if (!isCollectionKind(kind)) return <EmptyState title="Unknown collection" />;
  return <CollectionScreen key={kind} kind={kind} />;
}

function CollectionScreen({ kind }: { kind: CollectionKind }) {
  const config = COLLECTIONS[kind];
  const toast = useToast();
  const canEdit = useCanEdit();

  const items = useAsync<Array<Author | Term>>(
    () => listCollection(kind),
    [kind]
  );
  const fields = useAsync(async () => {
    const all = await getFields(config.typeName);
    return config.columns.flatMap((c) =>
      all.filter((f) => f.column_name === c)
    );
  }, [kind]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [row, setRow] = useState<Row>({});
  const [saving, setSaving] = useState(false);

  function reset() {
    setEditingId(null);
    setRow({});
  }

  async function save() {
    const name = String(row.name ?? '').trim();
    if (!name) return;
    setSaving(true);
    try {
      const values = {
        ...row,
        name,
        slug: String(row.slug ?? '').trim() || slugify(name),
      };
      if (editingId === null) await insertCollection(kind, values);
      else await updateCollection(kind, editingId, values);
      toast(editingId === null ? 'Added' : 'Updated');
      reset();
      await items.refetch();
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function destroy(id: number) {
    try {
      await deleteCollection(kind, id);
      toast('Deleted');
      if (editingId === id) reset();
      await items.refetch();
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    }
  }

  const byId = new Map((items.data ?? []).map((t) => [t.id, t]));
  const singular = config.singular;

  return (
    <>
      <PageHeader title={config.label} />
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card
          title={
            editingId === null ? `Add new ${singular}` : `Edit ${singular}`
          }
        >
          {fields.error && <ErrorNote message={fields.error} />}
          {fields.loading ? (
            <Spinner />
          ) : (
            <div className="grid gap-4">
              {/* FieldInput renders `parent` as a ReferenceSelect that excludes this row */}
              {(fields.data ?? []).map((f) => (
                <FieldInput
                  key={f.column_name}
                  field={f}
                  value={row[f.column_name] ?? null}
                  onChange={(v) =>
                    setRow((r) => ({ ...r, [f.column_name]: v }))
                  }
                  context={{
                    row,
                    typeName: config.typeName,
                    slugSource: 'name',
                  }}
                  disabled={!canEdit}
                />
              ))}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  loading={saving}
                  onClick={save}
                  disabled={!canEdit || !String(row.name ?? '').trim()}
                >
                  {editingId === null ? 'Add' : 'Update'}
                </Button>
                {editingId !== null && (
                  <Button variant="ghost" onClick={reset}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>

        <div>
          {items.error && <ErrorNote message={items.error} />}
          {items.loading && !items.data ? (
            <Spinner />
          ) : !items.data?.length ? (
            <EmptyState title={`No ${config.label.toLowerCase()} yet`} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Slug</Th>
                  <Th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {items.data.map((t) => {
                  const parent =
                    'parent' in t && t.parent ? byId.get(t.parent) : undefined;
                  const detail = 'bio' in t ? t.bio : t.description;
                  const edit = () => {
                    setEditingId(t.id);
                    setRow({ ...t });
                  };
                  return (
                    <tr key={t.id} className="group hover:bg-bolt-ds-bgHover">
                      <Td>
                        <button
                          type="button"
                          onClick={edit}
                          className="font-medium hover:text-bolt-ds-brand"
                        >
                          {parent ? `${parent.name} › ` : ''}
                          {t.name}
                        </button>
                        {detail && (
                          <p className="m-0 mt-0.5 text-xs text-bolt-ds-textTertiary">
                            {detail}
                          </p>
                        )}
                      </Td>
                      <Td className="font-mono text-xs text-bolt-ds-textTertiary">
                        {t.slug}
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Pencil size={14} />}
                            title="Edit"
                            onClick={edit}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Trash2 size={14} />}
                            title="Delete"
                            disabled={!canEdit}
                            onClick={() => destroy(t.id)}
                          />
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
