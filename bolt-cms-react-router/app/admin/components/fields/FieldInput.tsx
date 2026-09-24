/**
 * Renders one `cms_fields` registry row as an input, driven by its
 * `primitive`. Adding a column plus a matching `cms_fields` row is all it takes
 * for a field to show up in the admin (once its queries carry the column).
 */
import { ImageOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  getAsset,
  isCollectionKind,
  isContentType,
  listCollection,
  listContentOptions,
} from '@/admin/api';
import { useAsync } from '@/admin/hooks';
import { slugify } from '@/lib/cms/format';
import { assetUrl } from '@/lib/cms/media';
import type { FieldDef } from '@/lib/cms/types';

import { MediaPicker } from '../MediaPicker';
import { TermsPanel } from '../TermsPanel';
import { Button, Checkbox, Field, Input, Select, Textarea } from '../ui';

const LONG_TEXT = ['excerpt', 'bio', 'description'];

export function FieldInput({
  field,
  value,
  onChange,
  context,
  bare,
  disabled,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  context: {
    row: Record<string, unknown>;
    typeName: string;
    slugSource?: 'title' | 'name';
  };
  bare?: boolean;
  disabled?: boolean;
}) {
  const opts = field.options ?? {};
  const id = `${field.type_name}-${field.column_name}`;
  const to = (opts.to as string[] | undefined)?.[0];
  const of = opts.of as { primitive?: string; to?: string[] } | undefined;
  const ofKind = of?.to?.[0];

  // Components that carry their own label/card.
  if (field.primitive === 'boolean')
    return (
      <Checkbox
        id={id}
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        label={bare ? undefined : field.title}
        disabled={disabled}
      />
    );
  if (
    field.primitive === 'array' &&
    of?.primitive === 'reference' &&
    (ofKind === 'category' || ofKind === 'tag')
  )
    return (
      <TermsField
        kind={ofKind}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );

  const control = (() => {
    switch (field.primitive) {
      case 'string':
        return LONG_TEXT.includes(field.name) ? (
          <Textarea
            id={id}
            rows={3}
            value={str(value)}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        ) : (
          <Input
            id={id}
            value={str(value)}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );
      case 'slug':
        return (
          <SlugInput
            id={id}
            value={str(value)}
            onChange={onChange}
            from={str(context.row[context.slugSource ?? 'title'])}
            disabled={disabled}
          />
        );
      case 'number':
        return (
          <Input
            id={id}
            type="number"
            step={opts.integer ? 1 : 'any'}
            value={str(value)}
            onChange={(e) =>
              onChange(e.target.value === '' ? null : Number(e.target.value))
            }
            disabled={disabled}
          />
        );
      case 'date':
        return (
          <Input
            id={id}
            type="date"
            value={toDateInput(value)}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
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
            disabled={disabled}
          />
        );
      case 'image':
      case 'file':
        return (
          <AssetField
            image={field.primitive === 'image'}
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
        );
      case 'reference':
        return (
          <ReferenceSelect
            to={to ?? ''}
            value={value === null || value === undefined ? null : Number(value)}
            onChange={onChange}
            excludeId={
              to === context.typeName ? (context.row.id as number | null) : null
            }
            disabled={disabled}
          />
        );
      default:
        return (
          <JsonInput
            id={id}
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
        );
    }
  })();

  if (bare) return control;
  return (
    <Field
      label={field.title}
      htmlFor={id}
      required={field.required}
      hint={field.description ?? undefined}
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
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  from: string;
  disabled?: boolean;
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
      disabled={disabled}
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

/** Picks a row of another type by id; `to` is a type name. */
export function ReferenceSelect({
  to,
  value,
  onChange,
  excludeId,
  disabled,
}: {
  to: string;
  value: number | null;
  onChange: (id: number | null) => void;
  excludeId?: number | null;
  disabled?: boolean;
}) {
  const options = useAsync(async () => {
    if (isCollectionKind(to))
      return (await listCollection(to)).map((r) => ({
        id: r.id,
        label: r.name,
      }));
    if (isContentType(to))
      return (await listContentOptions(to)).map((r) => ({
        id: r.id,
        label: r.title,
      }));
    return null;
  }, [to]);

  if (!isCollectionKind(to) && !isContentType(to))
    return (
      <Input value={value === null ? '' : String(value)} disabled readOnly />
    );

  return (
    <Select
      value={value === null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      disabled={disabled}
    >
      <option value="">— None —</option>
      {options.data
        ?.filter((o) => o.id !== excludeId)
        .map((o) => (
          <option key={o.id} value={String(o.id)}>
            {o.label || `#${o.id}`}
          </option>
        ))}
    </Select>
  );
}

/** Stores a `cms_assets.id`. */
function AssetField({
  image,
  value,
  onChange,
  disabled,
}: {
  image: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const asset = useAsync(
    async () => (value ? getAsset(String(value)) : null),
    [value]
  );
  const url = assetUrl(asset.data);

  return (
    <div className="grid gap-2">
      <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-md border border-dashed border-bolt-ds-borderPrimary bg-bolt-ds-bgSecondary">
        {url && image && asset.data?.kind === 'image' ? (
          <img
            src={url}
            alt={asset.data.alt ?? ''}
            className="h-full w-full object-cover"
          />
        ) : asset.data ? (
          <span className="truncate px-3 text-xs text-bolt-ds-textSecondary">
            {asset.data.filename}
          </span>
        ) : (
          <ImageOff size={18} className="text-bolt-ds-iconTertiary" />
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setOpen(true)} disabled={disabled}>
          {value ? 'Replace' : `Choose ${image ? 'image' : 'file'}`}
        </Button>
        {Boolean(value) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Remove
          </Button>
        )}
      </div>
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(a) => {
          onChange(a.id);
          setOpen(false);
        }}
      />
    </div>
  );
}

/** A `bigint[]` of category/tag ids. */
function TermsField({
  kind,
  value,
  onChange,
  disabled,
}: {
  kind: 'category' | 'tag';
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const terms = useAsync(() => listCollection(kind), [kind]);
  return (
    <TermsPanel
      kind={kind}
      terms={terms.data ?? []}
      selected={Array.isArray(value) ? (value as number[]) : []}
      onChange={onChange}
      onCreated={(term) => terms.setData((prev) => [...(prev ?? []), term])}
      disabled={disabled}
    />
  );
}

function JsonInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() =>
    value === undefined || value === null ? '' : JSON.stringify(value, null, 2)
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
        disabled={disabled}
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
