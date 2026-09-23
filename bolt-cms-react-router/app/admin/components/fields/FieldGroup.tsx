import type { FieldDef } from '@/lib/cms/types';

import { FieldInput, type FieldContext, type Row } from './FieldInput';

/**
 * Render every field of one `group_name` for a table, in `position` order.
 * `exclude` lets a screen take over specific columns (e.g. the content editor
 * renders `title` and `content_html` itself).
 */
export function FieldGroup({
  fields,
  group,
  row,
  table,
  onChange,
  exclude = [],
}: {
  fields: FieldDef[];
  group: string;
  row: Row;
  table: string;
  onChange: (column: string, value: unknown) => void;
  exclude?: string[];
}) {
  const visible = fields
    .filter((f) => f.group_name === group && !exclude.includes(f.column_name))
    .sort((a, b) => a.position - b.position);

  if (visible.length === 0) return null;

  const context: FieldContext = { row, table };

  return (
    <div className="grid gap-4">
      {visible.map((field) => (
        <FieldInput
          key={field.column_name}
          field={field}
          value={row[field.column_name]}
          onChange={(value) => onChange(field.column_name, value)}
          context={context}
        />
      ))}
    </div>
  );
}

export function hasGroup(
  fields: FieldDef[],
  group: string,
  exclude: string[] = []
): boolean {
  return fields.some(
    (f) => f.group_name === group && !exclude.includes(f.column_name)
  );
}
