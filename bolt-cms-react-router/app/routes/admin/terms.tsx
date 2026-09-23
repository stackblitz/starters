import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { deleteRow, getFields, listTerms, saveTerm } from '@/admin/api';
import { FieldGroup } from '@/admin/components/fields/FieldGroup';
import {
  Button,
  Card,
  confirmAction,
  EmptyState,
  ErrorNote,
  PageHeader,
  Spinner,
  Table,
  Td,
  Th,
  useToast,
} from '@/admin/components/ui';
import { useAsync } from '@/admin/hooks';
import { taxonomyLabel } from '@/admin/labels';
import type { Term } from '@/lib/cms';

/** Categories, tags, and any custom taxonomy: WordPress' two-column terms screen. */
export default function Terms() {
  const { taxonomy = 'category' } = useParams();
  const toast = useToast();

  const terms = useAsync(() => listTerms(taxonomy), [taxonomy]);
  const fields = useAsync(() => getFields('cms_terms'), []);
  const [editing, setEditing] = useState<Term | null>(null);
  const [row, setRow] = useState<Record<string, unknown>>({
    taxonomy,
    name: '',
    slug: '',
    description: '',
    parent_id: null,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing(null);
    setRow({ taxonomy, name: '', slug: '', description: '', parent_id: null });
  }, [taxonomy]);

  function startEdit(term: Term) {
    setEditing(term);
    setRow({ ...term });
  }

  function reset() {
    setEditing(null);
    setRow({ taxonomy, name: '', slug: '', description: '', parent_id: null });
  }

  async function save() {
    if (!String(row.name ?? '').trim()) return;
    setSaving(true);
    try {
      const values: Record<string, unknown> = { taxonomy };
      for (const f of fields.data ?? [])
        values[f.column_name] = row[f.column_name];
      await saveTerm(
        values as Partial<Term> & { taxonomy: string },
        editing?.id
      );
      toast(editing ? 'Updated' : 'Added');
      reset();
      await terms.refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function destroy(term: Term) {
    if (!confirmAction(`Delete "${term.name}"? Posts keep their other terms.`))
      return;
    try {
      await deleteRow('cms_terms', term.id);
      toast('Deleted');
      if (editing?.id === term.id) reset();
      await terms.refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete', 'error');
    }
  }

  const byId = new Map((terms.data ?? []).map((t) => [t.id, t]));

  return (
    <>
      <PageHeader title={taxonomyLabel(taxonomy, true)} />
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card
          title={
            editing
              ? `Edit ${taxonomyLabel(taxonomy).toLowerCase()}`
              : `Add new ${taxonomyLabel(taxonomy).toLowerCase()}`
          }
        >
          {fields.loading ? (
            <Spinner />
          ) : (
            <div className="grid gap-4">
              <FieldGroup
                fields={fields.data ?? []}
                group="main"
                row={row}
                table="cms_terms"
                onChange={(c, v) => setRow((r) => ({ ...r, [c]: v }))}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  loading={saving}
                  onClick={save}
                  disabled={!String(row.name ?? '').trim()}
                >
                  {editing ? 'Update' : 'Add'}
                </Button>
                {editing && (
                  <Button variant="ghost" onClick={reset}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>

        <div>
          {terms.error && <ErrorNote message={terms.error} />}
          {terms.loading && !terms.data ? (
            <Spinner />
          ) : !terms.data?.length ? (
            <EmptyState
              title={`No ${taxonomyLabel(taxonomy, true).toLowerCase()} yet`}
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Slug</Th>
                  <Th className="w-20 text-right">Count</Th>
                  <Th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {terms.data.map((t) => (
                  <tr key={t.id} className="group hover:bg-bolt-ds-bgHover">
                    <Td>
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="font-medium hover:text-bolt-ds-brand"
                      >
                        {t.parent_id && byId.get(t.parent_id)
                          ? `${byId.get(t.parent_id)!.name} › `
                          : ''}
                        {t.name}
                      </button>
                      {t.description && (
                        <p className="m-0 mt-0.5 text-xs text-bolt-ds-textTertiary">
                          {t.description}
                        </p>
                      )}
                    </Td>
                    <Td className="font-mono text-xs text-bolt-ds-textTertiary">
                      {t.slug}
                    </Td>
                    <Td className="text-right text-bolt-ds-textSecondary">
                      {t.count}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil size={14} />}
                          title="Edit"
                          onClick={() => startEdit(t)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 size={14} />}
                          title="Delete"
                          onClick={() => destroy(t)}
                          disabled={t.slug === 'uncategorized'}
                        />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
