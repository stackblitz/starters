/**
 * Renders one `cms_fields` row as an input. Adding a new column to a table and
 * a matching `cms_fields` row is all it takes for it to show up in the admin.
 */
import { ImageOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { getRow, listRows } from '@/admin/api';
import { useAsync } from '@/admin/hooks';
import { slugify } from '@/lib/cms/format';
import { mediaUrl } from '@/lib/cms/media';
import type { FieldDef, Media } from '@/lib/cms/types';

import { MediaPicker } from '../MediaPicker';
import { Button, Checkbox, Field, Input, Select, Textarea } from '../ui';

export type Row = Record<string, unknown>;

export interface FieldContext {
  /** Row being edited (for slug-from-title, same_type references, self-exclusion). */
  row: Row;
  table: string;
}

export interface FieldInputProps {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  context: FieldContext;
  /** Hide the label wrapper (the caller renders its own). */
  bare?: boolean;
}

export function FieldInput({
  field,
  value,
  onChange,
  context,
  bare,
}: FieldInputProps) {
  const opts = field.options ?? {};
  const readonly = Boolean(opts.readonly);
  const id = `${field.table_name}-${field.column_name}`;

  const control = (() => {
    switch (field.type) {
      case 'string':
        return (
          <Input
            id={id}
            value={str(value)}
            onChange={(e) => onChange(e.target.value)}
            readOnly={readonly}
          />
        );
      case 'text':
        return (
          <Textarea
            id={id}
            value={str(value)}
            rows={Number(opts.rows ?? 3)}
            onChange={(e) => onChange(e.target.value)}
            readOnly={readonly}
          />
        );
      case 'number':
        return (
          <Input
            id={id}
            type="number"
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(e) =>
              onChange(e.target.value === '' ? null : Number(e.target.value))
            }
            readOnly={readonly}
          />
        );
      case 'boolean':
        return (
          <Checkbox
            id={id}
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            label={bare ? undefined : field.label}
          />
        );
      case 'date':
        return (
          <Input
            id={id}
            type="date"
            value={toDateInput(value)}
            onChange={(e) => onChange(e.target.value || null)}
          />
        );
      case 'datetime':
        return (
          <Input
            id={id}
            type="datetime-local"
            value={toDateTimeInput(value)}
            onChange={(e) =>
              onChange(
                e.target.value ? new Date(e.target.value).toISOString() : null
              )
            }
          />
        );
      case 'select':
        return (
          <Select
            id={id}
            value={str(value)}
            onChange={(e) => onChange(e.target.value)}
          >
            {(opts.choices as string[] | undefined)?.map((c) => (
              <option key={c} value={c}>
                {c === '' ? '—' : c}
              </option>
            ))}
          </Select>
        );
      case 'slug':
        return (
          <SlugInput
            id={id}
            value={str(value)}
            onChange={onChange}
            from={str(context.row[String(opts.from ?? '')])}
          />
        );
      case 'reference':
        return (
          <ReferenceSelect
            id={id}
            field={field}
            value={value}
            onChange={onChange}
            context={context}
          />
        );
      case 'image':
      case 'file':
        return <MediaField field={field} value={value} onChange={onChange} />;
      case 'object':
        return (
          <ObjectFields
            field={field}
            value={value}
            onChange={onChange}
            context={context}
          />
        );
      case 'richtext':
        // The content editor owns rich text; if a richtext field is placed in a
        // generic form, fall back to raw HTML.
        return (
          <Textarea
            id={id}
            value={str(value)}
            rows={10}
            onChange={(e) => onChange(e.target.value)}
            className="font-mono text-xs"
          />
        );
      case 'array':
      case 'json':
      default:
        return <JsonInput id={id} value={value} onChange={onChange} />;
    }
  })();

  if (bare || field.type === 'boolean') return control;
  return (
    <Field
      label={field.label}
      htmlFor={id}
      required={Boolean(opts.required)}
      hint={opts.help as string | undefined}
    >
      {control}
    </Field>
  );
}

/* ------------------------------------------------------------------------ */

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function toDateInput(v: unknown): string {
  if (!v) return '';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function toDateTimeInput(v: unknown): string {
  if (!v) return '';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Follows the `from` field until the user edits the slug by hand. */
function SlugInput({
  id,
  value,
  onChange,
  from,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  from: string;
}) {
  const [dirty, setDirty] = useState(Boolean(value));
  const lastFrom = useRef(from);

  useEffect(() => {
    if (dirty) return;
    if (from !== lastFrom.current || !value) {
      lastFrom.current = from;
      const next = slugify(from);
      if (next !== value) onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, dirty]);

  return (
    <Input
      id={id}
      value={value}
      className="font-mono text-xs"
      onChange={(e) => {
        setDirty(true);
        onChange(slugify(e.target.value) || e.target.value);
      }}
      onBlur={(e) => {
        if (!e.target.value) setDirty(false);
      }}
    />
  );
}

function ReferenceSelect({
  id,
  field,
  value,
  onChange,
  context,
}: {
  id: string;
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  context: FieldContext;
}) {
  const opts = field.options;
  const table = String(opts.table ?? '');
  const labelCol = String(opts.label ?? 'name');
  const sameType =
    Boolean(opts.same_type) && typeof context.row.type === 'string';
  const sameTaxonomy =
    Boolean(opts.same_taxonomy) && typeof context.row.taxonomy === 'string';

  const options = useAsync(async () => {
    if (!table) return [];
    const filters = [];
    if (sameType)
      filters.push({
        column: 'type',
        op: 'eq' as const,
        value: context.row.type,
      });
    if (sameTaxonomy)
      filters.push({
        column: 'taxonomy',
        op: 'eq' as const,
        value: context.row.taxonomy,
      });
    const { data } = await listRows<Row>(table, {
      columns: `id, ${labelCol}`,
      filters,
      order: [{ column: labelCol }],
      perPage: 500,
    });
    // A row can't be its own parent; only exclude self for self-references.
    const selfReference = table === context.table;
    return selfReference ? data.filter((r) => r.id !== context.row.id) : data;
  }, [
    table,
    context.table,
    labelCol,
    sameType ? context.row.type : null,
    sameTaxonomy ? context.row.taxonomy : null,
  ]);

  return (
    <Select
      id={id}
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">— None —</option>
      {options.data?.map((r) => (
        <option key={String(r.id)} value={String(r.id)}>
          {str(r[labelCol]) || `#${String(r.id)}`}
        </option>
      ))}
    </Select>
  );
}

/**
 * Image/file picker. Stores a media id (`options.value = "id"`, default for
 * `*_id` columns) or a URL string (`options.value = "url"`, used inside objects
 * like `seo.og_image`).
 */
function MediaField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const storesUrl =
    field.options.value === 'url' ||
    (!field.column_name.endsWith('_id') && field.options.value !== 'id');
  const [open, setOpen] = useState(false);

  const media = useAsync(async () => {
    if (storesUrl || !value) return null;
    return getRow<Media>('cms_media', Number(value));
  }, [storesUrl ? null : value]);

  const url = storesUrl
    ? str(value)
    : mediaUrl(media.data ?? null, 'medium') ?? mediaUrl(media.data ?? null);
  const isImage = field.type === 'image';

  return (
    <div className="grid gap-2">
      <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-md border border-dashed border-bolt-ds-borderPrimary bg-bolt-ds-bgSecondary">
        {url ? (
          isImage ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="truncate px-3 text-xs text-bolt-ds-textSecondary">
              {url}
            </span>
          )
        ) : (
          <ImageOff size={18} className="text-bolt-ds-iconTertiary" />
        )}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          disabled={Boolean(field.options.readonly)}
        >
          {url ? 'Replace' : `Choose ${isImage ? 'image' : 'file'}`}
        </Button>
        {url && (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
      </div>
      <MediaPicker
        open={open}
        accept={isImage ? 'image/*' : '*/*'}
        onClose={() => setOpen(false)}
        onSelect={(m) => {
          onChange(storesUrl ? mediaUrl(m) : m.id);
          setOpen(false);
        }}
      />
    </div>
  );
}

/** A jsonb column edited as a set of sub-fields (`options.fields`). */
function ObjectFields({
  field,
  value,
  onChange,
  context,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  context: FieldContext;
}) {
  const subfields =
    (field.options.fields as
      | Array<{
          key: string;
          label: string;
          type: FieldDef['type'];
          options?: Row;
        }>
      | undefined) ?? [];
  const obj = (value && typeof value === 'object' ? (value as Row) : {}) as Row;

  if (subfields.length === 0)
    return (
      <JsonInput id={field.column_name} value={value} onChange={onChange} />
    );

  return (
    <div className="grid gap-3">
      {subfields.map((sf) => (
        <FieldInput
          key={sf.key}
          field={{
            table_name: field.table_name,
            column_name: `${field.column_name}.${sf.key}`,
            label: sf.label,
            type: sf.type,
            options: {
              value:
                sf.type === 'image' || sf.type === 'file' ? 'url' : undefined,
              ...(sf.options ?? {}),
            },
            group_name: field.group_name,
            position: 0,
          }}
          value={obj[sf.key]}
          onChange={(v) => onChange({ ...obj, [sf.key]: v })}
          context={context}
        />
      ))}
    </div>
  );
}

function JsonInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [text, setText] = useState(() =>
    value === undefined ? '' : JSON.stringify(value, null, 2)
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-1">
      <Textarea
        id={id}
        value={text}
        rows={6}
        spellCheck={false}
        className="font-mono text-xs"
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(
              e.target.value.trim() === '' ? null : JSON.parse(e.target.value)
            );
            setError(null);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      {error && <p className="m-0 text-xs text-bolt-ds-danger">{error}</p>}
    </div>
  );
}
