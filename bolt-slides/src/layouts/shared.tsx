/* Shared bits for layout renderers + the inspector's field schema. */
import type { ReactNode } from 'react';
import type { SlideData } from '@/data/types';
import { useEdit } from '@/edit/EditContext';
import { renderRich } from '@/edit/rich';
import T from '@/edit/EditableText';
import CountUp from '@/components/CountUp';
import Reveal from '@/deck/Reveal';

/* ── inspector schema ──────────────────────────────────────────────── */
export interface FieldSpec {
  path: string;
  label: string;
  kind:
    | 'text'
    | 'textarea'
    | 'select'
    | 'number'
    | 'toggle'
    | 'image'
    | 'list'
    | 'cardbg'
    | 'dim';
  options?: { value: string; label: string }[];
  /** list kind: fields per item (paths relative to the item) */
  item?: FieldSpec[];
  /** list kind: template for a newly added item */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blank?: any;
  hint?: string;
  /** keep this text field in the inspector even though text is normally
      canvas-edited (pipe-string tables, code, values not wrapped in T) */
  keep?: boolean;
  /** machine-parsed string (pipe lists, code, line numbers): the inspector
      edits it as a plain input — no rich toolbar, no marker handling */
  plain?: boolean;
  /** show this field only when relevant (e.g. per chart kind) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  when?: (props: any) => boolean;
}

export interface LayoutDef {
  type: string;
  label: string;
  hint: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaults: any;
  fields: FieldSpec[];
  Render: (p: { slide: SlideData }) => ReactNode;
}

export const textField = (path: string, label: string): FieldSpec => ({
  path,
  label,
  kind: 'text',
});
export const headerFields = (): FieldSpec[] => [
  textField('kicker', 'Kicker'),
  textField('title', 'Title'),
];

/* ── render helpers ────────────────────────────────────────────────── */

/** show optional text slots when they have content — or always in the editor */
export const useShow = () => {
  const { editable } = useEdit();
  return (v: unknown) => !!v || editable;
};

/** "$1.24M" → CountUp fields; null when the string isn't a plain figure */
export function parseCountable(v: string | undefined) {
  if (!v || v.length > 16) return null;
  const m = v.match(/^([^0-9-]{0,4})(-?[\d,]+(?:\.\d+)?)([^0-9]{0,6})$/);
  if (!m) return null;
  const to = parseFloat(m[2].replace(/,/g, ''));
  if (!Number.isFinite(to)) return null;
  const decimals = m[2].includes('.') ? m[2].split('.')[1].length : 0;
  return { to, prefix: m[1], suffix: m[3], decimals };
}

/** a figure: animates as a CountUp when it looks numeric, editable in the editor */
export function Num({ path, value }: { path: string; value?: string }) {
  const { editable } = useEdit();
  const c = editable ? null : parseCountable(value);
  if (c)
    return (
      <CountUp
        to={c.to}
        prefix={c.prefix}
        suffix={c.suffix}
        decimals={c.decimals}
      />
    );
  return <T path={path} placeholder="42%" />;
}

/** the standard centered kicker + headline block used by block-style layouts */
export function Heading({
  slide,
  tight,
}: {
  slide: SlideData;
  tight?: boolean;
}) {
  const show = useShow();
  if (!show(slide.props.kicker) && !show(slide.props.title)) return null;
  return (
    <Reveal>
      {show(slide.props.kicker) && (
        <div
          className="kicker"
          style={{ marginBottom: 10, textAlign: 'center' }}
        >
          <T path="kicker" placeholder="Kicker" />
        </div>
      )}
      {show(slide.props.title) && (
        <h2
          className="headline"
          style={{
            textAlign: 'center',
            marginInline: 'auto',
            marginBottom: tight
              ? 'clamp(18px,3vh,30px)'
              : 'clamp(24px,4vh,44px)',
          }}
        >
          <T path="title" placeholder="Title" />
        </h2>
      )}
    </Reveal>
  );
}

/** split "a | b | c" cells */
export const pipe = (s: string | undefined) =>
  (s ?? '').split('|').map((x) => x.trim());

/** table props normalized: columns string[], rows string[][] (legacy = pipe strings) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const normTable = (p: any): { columns: string[]; rows: string[][] } => ({
  columns: Array.isArray(p.columns) ? p.columns : pipe(p.columns),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: (p.rows ?? []).map((r: any) =>
    Array.isArray(r) ? r : pipe(r?.cells ?? '')
  ),
});

/** rich text without editing (used where inline editing isn't wired, e.g. table cells) */
export const rich = renderRich;
