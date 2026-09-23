import type { FieldDef } from '@/lib/cms/types';

import { FieldInput } from './FieldInput';

/**
 * Render registry fields for one row: `only` picks field names (in that
 * order), otherwise every field in `position` order.
 */
export function FieldGroup({
  fields,
  row,
  typeName,
  onChange,
  only,
  slugSource,
  disabled,
}: {
  fields: FieldDef[];
  row: Record<string, unknown>;
  typeName: string;
  onChange: (column: string, value: unknown) => void;
  only?: string[];
  slugSource?: 'title' | 'name';
  disabled?: boolean;
}) {
  const visible = only
    ? only.flatMap((name) => fields.filter((f) => f.name === name))
    : [...fields].sort((a, b) => a.position - b.position);

  if (visible.length === 0) return null;

  return (
    <div className="grid gap-4">
      {visible.map((field) => (
        <FieldInput
          key={field.column_name}
          field={field}
          value={row[field.column_name]}
          onChange={(value) => onChange(field.column_name, value)}
          context={{ row, typeName, slugSource }}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
