import type { ReactNode } from 'react';
import type { LayoutName } from '../data/layoutProps';
import type { SlideData } from '../data/types';
import { useEdit } from '../edit/EditContext';
import { renderRich } from '../edit/rich';
import T from '../edit/EditableText';
import CountUp from '../components/CountUp';
import Reveal from '../deck/Reveal';

export interface LayoutDef {
  type: LayoutName;
  label: string;
  defaults: Record<string, unknown>;
  Render: (p: { slide: SlideData }) => ReactNode;
}

export const e = (node: ReactNode) => node as unknown as string;

export const useShow = () => {
  const { editable } = useEdit();

  return (v: unknown) => !!v || editable;
};

function parseCountable(v: string | undefined) {
  if (!v || v.length > 16) return null;

  const m = v.match(/^([^0-9-]{0,4})(-?[\d,]+(?:\.\d+)?)([^0-9]{0,6})$/);

  if (!m) return null;

  const to = parseFloat(m[2].replace(/,/g, ''));

  if (!Number.isFinite(to)) return null;

  const decimals = m[2].includes('.') ? m[2].split('.')[1].length : 0;

  return { to, prefix: m[1], suffix: m[3], decimals };
}

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

export const pipe = (s: string | undefined) =>
  (s ?? '').split('|').map((x) => x.trim());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const normTable = (p: any): { columns: string[]; rows: string[][] } => ({
  columns: Array.isArray(p.columns) ? p.columns : pipe(p.columns),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: (p.rows ?? []).map((r: any) =>
    Array.isArray(r) ? r : pipe(r?.cells ?? '')
  ),
});

export const rich = renderRich;
