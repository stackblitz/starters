/* Freeform canvas — the one layout where elements are FREELY positioned.
   Items (text / image / shapes / lines / charts / table) live at percent
   coordinates so the same data renders identically in the editor,
   thumbnails, present mode and PDF.
   In the editor: an insert bar (Text · Media · Shape · Chart · Table) with
   flyout galleries; click to select, drag to move, handles to resize — all
   with snap-to-guides against the slide edges/center and every other
   item's edges/centers. Double-click text/tables to edit. Right-click for
   layering, duplicate, delete, image URL and chart data. */
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPE,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import type { SlideData } from '@/data/types';
import { useDeck } from '@/deck/DeckContext';
import { useEdit } from '@/edit/EditContext';
import { useStore } from '@/data/store';
import T from '@/edit/EditableText';
import ContextMenu, { type MenuItem } from '@/edit/ContextMenu';
import { BarChart, LineChart, DonutChart } from '@/components/Charts';
import Comparison, { type CompRow } from '@/components/Comparison';
import CmpCell from '@/edit/CmpCell';
import { TrashIcon } from '@/edit/icons';

export type CnvShape =
  | 'rect'
  | 'rounded'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'star';

export interface CnvItem {
  type:
    | 'text'
    | 'image'
    | 'box'
    | 'ellipse'
    | 'line'
    | 'triangle'
    | 'table'
    | 'shape'
    | 'chart'
    | 'compare';
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  /** typography: default = the deck's heading font; 'head' adds title
      weight/tracking; 'body' switches to the body font */
  font?: 'head' | 'body';
  url?: string;
  bg?: string;
  radius?: number;
  columns?: string[];
  rows?: string[][];
  highlightCol?: number;
  /* comparison matrix */
  cols?: string[];
  cmpRows?: CompRow[];
  highlight?: number;
  /* shape */
  shape?: CnvShape;
  variant?: 'fill' | 'outline';
  /* line */
  dash?: boolean;
  arrows?: 'none' | 'end' | 'both';
  /* rotation (degrees, clockwise) */
  rot?: number;
  /* style (shapes / lines / boxes) */
  fill?: string;
  stroke?: string;
  strokeW?: number;
  /* chart */
  kind?: 'bars' | 'line' | 'donut';
  bars?: { label: string; value: number }[];
  points?: string;
  donutValue?: number;
  donutLabel?: string;
}

type DragMode = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
const HANDLES: DragMode[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const r1 = (n: number) => Math.round(n * 10) / 10;
const SNAP_PX = 6;
const MIN = 2.5;

/* ── item factories ─────────────────────────────────────────────────── */
const make = {
  text: (x: number, y: number): CnvItem => ({
    type: 'text',
    x,
    y,
    w: 34,
    h: 10,
    text: 'New text',
  }),
  image: (x: number, y: number): CnvItem => ({
    type: 'image',
    x,
    y,
    w: 28,
    h: 36,
    url: '',
    radius: 16,
  }),
  table: (x: number, y: number): CnvItem => ({
    type: 'table',
    x,
    y,
    w: 52,
    h: 30,
    columns: ['Column A', 'Column B', 'Column C'],
    rows: [
      ['Row 1', '—', '—'],
      ['Row 2', '—', '—'],
    ],
  }),
  shape: (
    x: number,
    y: number,
    shape: CnvShape,
    variant: 'fill' | 'outline'
  ): CnvItem => ({
    type: 'shape',
    x,
    y,
    w: 16,
    h: shape === 'rect' || shape === 'rounded' ? 12 : 16 * (16 / 9),
    shape,
    variant,
  }),
  line: (
    x: number,
    y: number,
    dash: boolean,
    arrows: 'none' | 'end' | 'both'
  ): CnvItem => ({ type: 'line', x, y, w: 26, h: 2.6, dash, arrows }),
  compare: (x: number, y: number): CnvItem => ({
    type: 'compare',
    x,
    y,
    w: 46,
    h: 38,
    cols: ['', 'Us', 'Them'],
    highlight: 0,
    cmpRows: [
      { label: 'Feature A', values: [true, false] },
      { label: 'Feature B', values: [true, true] },
      { label: 'Feature C', values: [true, false] },
    ],
  }),
  chart: (x: number, y: number, kind: 'bars' | 'line' | 'donut'): CnvItem => ({
    type: 'chart',
    x,
    y,
    w: kind === 'donut' ? 24 : 38,
    h: kind === 'donut' ? 40 : 34,
    kind,
    ...(kind === 'bars'
      ? {
          bars: [
            { label: 'Q1', value: 12 },
            { label: 'Q2', value: 18 },
            { label: 'Q3', value: 26 },
            { label: 'Q4', value: 22 },
          ],
        }
      : {}),
    ...(kind === 'line' ? { points: '8 | 14 | 12 | 22 | 19 | 30' } : {}),
    ...(kind === 'donut' ? { donutValue: 68, donutLabel: 'Complete' } : {}),
  }),
};

const SHAPES: CnvShape[] = [
  'rect',
  'rounded',
  'circle',
  'triangle',
  'diamond',
  'star',
];
const POLYS: Partial<Record<CnvShape, string>> = {
  triangle: '50,2 98,98 2,98',
  diamond: '50,2 98,50 50,98 2,50',
  star: '50,2 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35',
};
const LINE_STYLES: { dash: boolean; arrows: 'none' | 'end' | 'both' }[] = [
  { dash: false, arrows: 'none' },
  { dash: false, arrows: 'end' },
  { dash: false, arrows: 'both' },
  { dash: true, arrows: 'none' },
  { dash: true, arrows: 'end' },
  { dash: true, arrows: 'both' },
];

/* ── responsive renderers (used on canvas AND in the flyout galleries) ── */
export function ShapeGlyph({
  shape,
  variant,
  fill,
  stroke,
  strokeW,
  radius,
}: {
  shape: CnvShape;
  variant: 'fill' | 'outline';
  fill?: string;
  stroke?: string;
  strokeW?: number;
  radius?: number;
}) {
  const sw = strokeW ?? 2;
  if (shape === 'rect' || shape === 'rounded' || shape === 'circle') {
    return (
      <div
        className={`cnv-shp ${variant}`}
        style={{
          borderRadius:
            shape === 'circle'
              ? '50%'
              : radius != null
              ? radius
              : shape === 'rounded'
              ? 'clamp(8px, 1.2vw, 18px)'
              : 2,
          background: fill || (variant === 'fill' ? undefined : 'transparent'),
          ...(variant === 'outline' || stroke
            ? {
                borderWidth: sw,
                borderStyle: 'solid',
                ...(stroke ? { borderColor: stroke } : {}),
              }
            : { border: 'none' }),
        }}
      />
    );
  }
  return (
    <svg
      className={`cnv-shp-svg ${variant}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polygon
        points={POLYS[shape]}
        vectorEffect="non-scaling-stroke"
        style={{
          ...(variant === 'fill'
            ? { fill: fill || undefined }
            : { fill: fill || 'none' }),
          ...(variant === 'outline' || stroke
            ? { stroke: stroke || undefined, strokeWidth: sw }
            : { stroke: 'none' }),
        }}
      />
    </svg>
  );
}

export function LineGlyph({
  dash,
  arrows,
  bg,
  strokeW,
}: {
  dash?: boolean;
  arrows?: 'none' | 'end' | 'both';
  bg?: string;
  strokeW?: number;
}) {
  const color = bg || 'var(--accent)';
  const sw = strokeW ?? 2;
  const th = `max(${sw}px, ${(sw * 0.11).toFixed(2)}vw)`;
  return (
    <div className="cnv-line2" style={{ color }}>
      <div
        className="cnv-line2-bar"
        style={{
          height: th,
          ...(dash
            ? {
                background: `repeating-linear-gradient(90deg, ${color} 0 0.9vw, transparent 0.9vw 1.5vw)`,
              }
            : { background: color }),
        }}
      />
      {(arrows === 'end' || arrows === 'both') && (
        <span className="cnv-arr r" />
      )}
      {arrows === 'both' && <span className="cnv-arr l" />}
    </div>
  );
}

/* charts take pixel sizes — measure the item frame so they track it
   responsively (the frame is % of the slide, the slide is viewport-sized) */
function ChartItem({ it }: { it: CnvItem }) {
  const ref = useRef<HTMLDivElement>(null);
  const [d, setD] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = () => setD({ w: el.clientWidth, h: el.clientHeight });
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="cnv-chart"
      style={
        it.fill
          ? { ['--primary' as never]: it.fill, ['--accent' as never]: it.fill }
          : undefined
      }
    >
      {d.h > 20 && it.kind === 'bars' && (
        <BarChart data={it.bars ?? []} height={Math.max(40, d.h - 54)} />
      )}
      {d.h > 20 && it.kind === 'line' && (
        <LineChart
          points={(it.points ?? '')
            .split('|')
            .map((s) => Number(s.trim()))
            .filter(Number.isFinite)}
          height={Math.max(40, d.h - 10)}
        />
      )}
      {d.h > 20 && it.kind === 'donut' && (
        <DonutChart
          value={it.donutValue ?? 0}
          label={it.donutLabel}
          size={Math.max(60, Math.min(d.w, d.h - 30))}
        />
      )}
    </div>
  );
}

/* ── the Edit-data drawer (Pitch-style bottom sheet, charts + tables) ── */
function DataPanel({
  it,
  onChange,
  onClose,
}: {
  it: CnvItem;
  onChange: (patch: Partial<CnvItem>) => void;
  onClose: () => void;
}) {
  const pts = (it.points ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  const setPts = (next: string[]) => onChange({ points: next.join(' | ') });
  const bars = it.bars ?? [];
  const cols = it.columns ?? [];
  const rows = it.rows ?? [];

  return createPortal(
    <div className="cnv-data" onPointerDown={(e) => e.stopPropagation()}>
      <div className="cnv-data-body">
        <div className="cnv-data-head">
          <span className="cnv-data-title">Edit data</span>
          <div className="cnv-data-actions">
            {it.type === 'chart' && it.kind !== 'donut' && (
              <button
                className="ghost-btn"
                onClick={() =>
                  it.kind === 'bars'
                    ? onChange({
                        bars: [
                          ...bars,
                          { label: `Q${bars.length + 1}`, value: 10 },
                        ],
                      })
                    : setPts([...pts, '10'])
                }
              >
                + Row
              </button>
            )}
            {it.type === 'table' && (
              <>
                <button
                  className="ghost-btn"
                  onClick={() =>
                    onChange({ rows: [...rows, cols.map(() => '—')] })
                  }
                >
                  + Row
                </button>
                <button
                  className="ghost-btn"
                  onClick={() =>
                    onChange({
                      columns: [...cols, 'New'],
                      rows: rows.map((r) => [...r, '—']),
                    })
                  }
                >
                  + Column
                </button>
              </>
            )}
            {it.type === 'compare' && (
              <>
                <button
                  className="ghost-btn"
                  onClick={() =>
                    onChange({
                      cmpRows: [
                        ...(it.cmpRows ?? []),
                        {
                          label: 'New row',
                          values: (it.cols ?? []).slice(1).map(() => true),
                        },
                      ],
                    })
                  }
                >
                  + Row
                </button>
                <button
                  className="ghost-btn"
                  onClick={() =>
                    onChange({
                      cols: [...(it.cols ?? []), 'New'],
                      cmpRows: (it.cmpRows ?? []).map((r) => ({
                        ...r,
                        values: [...r.values, true],
                      })),
                    })
                  }
                >
                  + Column
                </button>
              </>
            )}
            <button className="solid-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>

        {it.type === 'table' && (
          <div
            className="cnv-data-grid table"
            style={{
              gridTemplateColumns: `30px repeat(${cols.length}, minmax(90px, 1fr)) 30px`,
            }}
          >
            <span className="cnv-data-no" />
            {cols.map((c, ci) => (
              <span key={ci} className="cnv-data-colhead">
                <input
                  value={c}
                  onChange={(e) =>
                    onChange({
                      columns: cols.map((o, j) =>
                        j === ci ? e.target.value : o
                      ),
                    })
                  }
                />
                <button
                  className="cnv-data-x"
                  title="Remove column"
                  disabled={cols.length <= 1}
                  onClick={() =>
                    onChange({
                      columns: cols.filter((_, j) => j !== ci),
                      rows: rows.map((r) => r.filter((_, j) => j !== ci)),
                    })
                  }
                >
                  <TrashIcon />
                </button>
              </span>
            ))}
            <span />
            {rows.map((row, r) => (
              <div key={r} className="cnv-data-row">
                <span className="cnv-data-no">{r + 1}</span>
                {row.map((cell, c) => (
                  <input
                    key={c}
                    value={cell}
                    onChange={(e) =>
                      onChange({
                        rows: rows.map((ro, rj) =>
                          rj === r
                            ? ro.map((co, cj) =>
                                cj === c ? e.target.value : co
                              )
                            : ro
                        ),
                      })
                    }
                  />
                ))}
                <button
                  className="cnv-data-x"
                  title="Remove row"
                  disabled={rows.length <= 1}
                  onClick={() =>
                    onChange({ rows: rows.filter((_, j) => j !== r) })
                  }
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}

        {it.type === 'compare' &&
          (() => {
            const ccols = it.cols ?? [];
            const crows = it.cmpRows ?? [];
            return (
              <div
                className="cnv-data-grid table"
                style={{
                  gridTemplateColumns: `30px repeat(${ccols.length}, minmax(90px, 1fr)) 30px`,
                }}
              >
                <span className="cnv-data-no" />
                {ccols.map((c, ci) => (
                  <span key={ci} className="cnv-data-colhead">
                    <input
                      value={c}
                      placeholder={ci === 0 ? 'Label column' : ''}
                      onChange={(e) =>
                        onChange({
                          cols: ccols.map((o, j) =>
                            j === ci ? e.target.value : o
                          ),
                        })
                      }
                    />
                    {ci > 0 && (
                      <button
                        className="cnv-data-x"
                        title="Remove column"
                        disabled={ccols.length <= 2}
                        onClick={() =>
                          onChange({
                            cols: ccols.filter((_, j) => j !== ci),
                            cmpRows: crows.map((r) => ({
                              ...r,
                              values: r.values.filter((_, j) => j !== ci - 1),
                            })),
                          })
                        }
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </span>
                ))}
                <span />
                {crows.map((row, r) => (
                  <div key={r} className="cnv-data-row">
                    <span className="cnv-data-no">{r + 1}</span>
                    <input
                      value={row.label}
                      onChange={(e) =>
                        onChange({
                          cmpRows: crows.map((o, j) =>
                            j === r ? { ...o, label: e.target.value } : o
                          ),
                        })
                      }
                    />
                    {ccols.slice(1).map((_, c) => (
                      <CmpCell
                        key={c}
                        value={row.values[c] ?? true}
                        onChange={(nv) =>
                          onChange({
                            cmpRows: crows.map((o, j) =>
                              j === r
                                ? {
                                    ...o,
                                    values: o.values.map((v, vj) =>
                                      vj === c ? nv : v
                                    ),
                                  }
                                : o
                            ),
                          })
                        }
                      />
                    ))}
                    <button
                      className="cnv-data-x"
                      title="Remove row"
                      disabled={crows.length <= 1}
                      onClick={() =>
                        onChange({ cmpRows: crows.filter((_, j) => j !== r) })
                      }
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}

        {it.kind === 'bars' && (
          <div className="cnv-data-grid bars">
            <span className="cnv-data-th" />
            <span className="cnv-data-th">Category</span>
            <span className="cnv-data-th">Value</span>
            <span className="cnv-data-th" />
            {bars.map((b, r) => (
              <div key={r} className="cnv-data-row">
                <span className="cnv-data-no">{r + 1}</span>
                <input
                  value={b.label}
                  onChange={(e) =>
                    onChange({
                      bars: bars.map((o, j) =>
                        j === r ? { ...o, label: e.target.value } : o
                      ),
                    })
                  }
                />
                <input
                  inputMode="decimal"
                  value={String(b.value)}
                  onChange={(e) =>
                    onChange({
                      bars: bars.map((o, j) =>
                        j === r
                          ? { ...o, value: Number(e.target.value) || 0 }
                          : o
                      ),
                    })
                  }
                />
                <button
                  className="cnv-data-x"
                  title="Remove row"
                  disabled={bars.length <= 1}
                  onClick={() =>
                    onChange({ bars: bars.filter((_, j) => j !== r) })
                  }
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}

        {it.kind === 'line' && (
          <div className="cnv-data-grid line">
            <span className="cnv-data-th" />
            <span className="cnv-data-th">Value</span>
            <span className="cnv-data-th" />
            {pts.map((p, r) => (
              <div key={r} className="cnv-data-row">
                <span className="cnv-data-no">{r + 1}</span>
                <input
                  inputMode="decimal"
                  value={p}
                  onChange={(e) =>
                    setPts(pts.map((o, j) => (j === r ? e.target.value : o)))
                  }
                />
                <button
                  className="cnv-data-x"
                  title="Remove row"
                  disabled={pts.length <= 2}
                  onClick={() => setPts(pts.filter((_, j) => j !== r))}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}

        {it.kind === 'donut' && (
          <div className="cnv-data-grid donut">
            <span className="cnv-data-th">Percent (0–100)</span>
            <span className="cnv-data-th">Label</span>
            <div className="cnv-data-row">
              <input
                inputMode="decimal"
                value={String(it.donutValue ?? 0)}
                onChange={(e) =>
                  onChange({
                    donutValue: Math.max(
                      0,
                      Math.min(100, Number(e.target.value) || 0)
                    ),
                  })
                }
              />
              <input
                value={it.donutLabel ?? ''}
                onChange={(e) => onChange({ donutLabel: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ── the insert bar + flyout galleries ──────────────────────────────── */
function InsertBar({ onAdd }: { onAdd: (it: CnvItem) => void }) {
  const [panel, setPanel] = useState<'shape' | 'chart' | null>(null);
  const add = (it: CnvItem) => {
    onAdd(it);
    setPanel(null);
  };
  const AT = { x: 34, y: 30 };

  const Icon = ({ d, box = 24 }: { d: ReactNode; box?: number }) => (
    <svg
      width="17"
      height="17"
      viewBox={`0 0 ${box} ${box}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {d}
    </svg>
  );

  return (
    <div className="cnv-toolwrap" onPointerDown={(e) => e.stopPropagation()}>
      <div className="cnv-toolbar">
        <button
          onClick={() => {
            setPanel(null);
            add(make.text(AT.x, AT.y));
          }}
        >
          <Icon
            d={
              <>
                <path d="M5 5h14" />
                <path d="M12 5v14" />
              </>
            }
          />
          <span>Text</span>
        </button>
        <button
          onClick={() => {
            setPanel(null);
            add(make.image(AT.x, AT.y));
          }}
        >
          <Icon
            d={
              <>
                <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
                <circle cx="9" cy="10" r="1.6" />
                <path d="m4.5 17 4.8-4.4 3.4 3 3-2.6 3.8 3.6" />
              </>
            }
          />
          <span>Media</span>
        </button>
        <button
          className={panel === 'shape' ? 'on' : ''}
          onClick={() => setPanel(panel === 'shape' ? null : 'shape')}
        >
          <Icon
            d={
              <>
                <rect x="3.5" y="3.5" width="8" height="8" rx="1.5" />
                <circle cx="16.5" cy="16.5" r="4.2" />
              </>
            }
          />
          <span>Shape</span>
        </button>
        <button
          className={panel === 'chart' ? 'on' : ''}
          onClick={() => setPanel(panel === 'chart' ? null : 'chart')}
        >
          <Icon
            d={
              <>
                <path d="M4 20V10" />
                <path d="M10 20V4" />
                <path d="M16 20v-7" />
                <path d="M22 20H2" />
              </>
            }
          />
          <span>Chart</span>
        </button>
        <button
          onClick={() => {
            setPanel(null);
            add(make.table(AT.x, AT.y));
          }}
        >
          <Icon
            d={
              <>
                <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
                <path d="M3.5 10h17" />
                <path d="M10.5 10v9.5" />
              </>
            }
          />
          <span>Table</span>
        </button>
        <button
          onClick={() => {
            setPanel(null);
            add(make.compare(AT.x, AT.y));
          }}
        >
          <Icon
            d={
              <>
                <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
                <path d="M12 4.5v15" />
                <path d="m6.2 11 1.6 1.6 2.6-2.9" />
                <path d="m14.8 10 3 3m0-3-3 3" />
              </>
            }
          />
          <span>Compare</span>
        </button>
      </div>

      {panel === 'shape' && (
        <div className="cnv-flyout">
          <div className="cnv-fly-label">Shapes</div>
          <div className="cnv-fly-grid s6">
            {SHAPES.map((s) => (
              <button
                key={s}
                title={s}
                onClick={() => add(make.shape(AT.x, AT.y, s, 'fill'))}
              >
                <div className="cnv-fly-shp">
                  <ShapeGlyph shape={s} variant="fill" />
                </div>
              </button>
            ))}
            {SHAPES.map((s) => (
              <button
                key={s + 'o'}
                title={`${s} (outline)`}
                onClick={() => add(make.shape(AT.x, AT.y, s, 'outline'))}
              >
                <div className="cnv-fly-shp">
                  <ShapeGlyph shape={s} variant="outline" />
                </div>
              </button>
            ))}
          </div>
          <div className="cnv-fly-label">Lines</div>
          <div className="cnv-fly-grid s3">
            {LINE_STYLES.map((l, i) => (
              <button
                key={i}
                title={`${l.dash ? 'dashed' : 'solid'} ${l.arrows}`}
                onClick={() => add(make.line(AT.x, AT.y, l.dash, l.arrows))}
              >
                <div className="cnv-fly-line">
                  <LineGlyph dash={l.dash} arrows={l.arrows} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {panel === 'chart' && (
        <div className="cnv-flyout">
          <div className="cnv-fly-label">Charts</div>
          <div className="cnv-fly-grid s3">
            <button
              title="Bar chart"
              onClick={() => add(make.chart(AT.x, AT.y, 'bars'))}
            >
              <svg viewBox="0 0 48 34" className="cnv-fly-chart" aria-hidden>
                {[8, 20, 14, 26].map((h, i) => (
                  <rect
                    key={i}
                    x={5 + i * 10}
                    y={30 - h}
                    width="6"
                    height={h}
                    rx="1.5"
                    fill="var(--accent)"
                    opacity={0.45 + i * 0.14}
                  />
                ))}
              </svg>
            </button>
            <button
              title="Line chart"
              onClick={() => add(make.chart(AT.x, AT.y, 'line'))}
            >
              <svg viewBox="0 0 48 34" className="cnv-fly-chart" aria-hidden>
                <path
                  d="M4 26 14 16l8 5 9-10 9 4"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="44" cy="15" r="2.6" fill="var(--accent)" />
              </svg>
            </button>
            <button
              title="Donut chart"
              onClick={() => add(make.chart(AT.x, AT.y, 'donut'))}
            >
              <svg viewBox="0 0 48 34" className="cnv-fly-chart" aria-hidden>
                <circle
                  cx="24"
                  cy="17"
                  r="11"
                  fill="none"
                  stroke="var(--hair)"
                  strokeWidth="5.5"
                />
                <circle
                  cx="24"
                  cy="17"
                  r="11"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="5.5"
                  strokeDasharray="47 22"
                  strokeLinecap="round"
                  transform="rotate(-90 24 17)"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FreeformCanvas({ slide }: { slide: SlideData }) {
  const { editable, slideId } = useEdit();
  const { isStatic } = useDeck();
  const setProp = useStore((s) => s.setProp);
  const items: CnvItem[] = Array.isArray(slide.props.items)
    ? slide.props.items
    : [];

  const rootRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({
    v: [],
    h: [],
  });
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    item: number | null;
  } | null>(null);
  const [dataEdit, setDataEdit] = useState<number | null>(null);
  const dragging = useRef(false);

  /* the right panel shows the selected item's settings via the store */
  const setCnvSel = useStore((s) => s.setCnvSel);
  const cnvDataReq = useStore((s) => s.cnvDataReq);
  useEffect(() => {
    if (editable) setCnvSel(sel);
  }, [sel, editable, setCnvSel]);
  useEffect(
    () => () => {
      if (editable) setCnvSel(null);
    },
    [editable, setCnvSel]
  );
  useEffect(() => {
    if (editable && cnvDataReq) {
      useStore.getState().reqCnvData(false);
      if (
        sel !== null &&
        ['chart', 'table', 'compare'].includes(items[sel]?.type ?? '')
      )
        setDataEdit(sel);
    }
  }, [cnvDataReq, editable, sel, items]);

  const commit = (next: CnvItem[]) => {
    if (slideId) setProp(slideId, 'items', next);
  };
  const lastTap = useRef<{ t: number; x: number; y: number; i: number } | null>(
    null
  );
  const enterEdit = (i: number) => {
    setEditing(i);
    setTimeout(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(
        `.cnv-item:nth-child(${i + 1}) [contenteditable]`
      );
      if (el && !el.contains(document.activeElement)) el.focus();
    }, 0);
  };
  /* pointerdown-based double-click: browsers suppress synthesized dblclick
     after drags/preventDefault, so detect the second tap ourselves */
  const isDoubleTap = (e: RPE, i: number) => {
    const prev = lastTap.current;
    const now = performance.now();
    lastTap.current = { t: now, x: e.clientX, y: e.clientY, i };
    return (
      !!prev &&
      prev.i === i &&
      now - prev.t < 380 &&
      Math.abs(e.clientX - prev.x) < 8 &&
      Math.abs(e.clientY - prev.y) < 8
    );
  };

  /* ── move / resize with snapping ─────────────────────────────────── */
  const startDrag = (e: RPE, i: number, mode: DragMode, onTap?: () => void) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    if (mode !== 'move') e.preventDefault(); // handles never need click/dblclick
    setSel(i);
    setEditing(null);
    const cont = rootRef.current!.getBoundingClientRect();
    const it = items[i];
    const start = {
      px: e.clientX,
      py: e.clientY,
      x: it.x,
      y: it.y,
      w: it.w,
      h: it.h,
    };
    const thX = (SNAP_PX / cont.width) * 100;
    const thY = (SNAP_PX / cont.height) * 100;
    const vLines = [
      0,
      50,
      100,
      ...items.flatMap((o, j) =>
        j === i ? [] : [o.x, o.x + o.w / 2, o.x + o.w]
      ),
    ];
    const hLines = [
      0,
      50,
      100,
      ...items.flatMap((o, j) =>
        j === i ? [] : [o.y, o.y + o.h / 2, o.y + o.h]
      ),
    ];
    const snap = (val: number, lines: number[], th: number): number | null => {
      let best: number | null = null;
      for (const l of lines)
        if (
          Math.abs(val - l) < th &&
          (best === null || Math.abs(val - l) < Math.abs(val - best))
        )
          best = l;
      return best;
    };
    let moved = false;
    const rad = ((it.rot ?? 0) * Math.PI) / 180;

    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      let dx = ((ev.clientX - start.px) / cont.width) * 100;
      let dy = ((ev.clientY - start.py) / cont.height) * 100;
      if (mode !== 'move' && rad !== 0) {
        // resize axes live in the item's rotated frame: rotate the screen
        // delta by -rot (x normalised per-axis, so convert around the aspect)
        const px = dx,
          py = dy;
        dx = px * Math.cos(rad) + py * Math.sin(rad);
        dy = -px * Math.sin(rad) + py * Math.cos(rad);
      }
      if (
        !moved &&
        Math.abs(ev.clientX - start.px) < 3 &&
        Math.abs(ev.clientY - start.py) < 3
      )
        return;
      if (!moved) {
        // a real drag begins: kill any native text selection and block new
        // ones for its duration (else the drag sweep-selects other items' text)
        window.getSelection()?.removeAllRanges();
        document.body.classList.add('cnv-dragging');
      }
      moved = true;
      dragging.current = true;
      let { x, y, w, h } = start;
      const gv: number[] = [],
        gh: number[] = [];

      if (mode === 'move') {
        x += dx;
        y += dy;
        for (const [edge, setX] of [
          [
            x,
            (v: number) => {
              x = v;
            },
          ],
          [
            x + w / 2,
            (v: number) => {
              x = v - w / 2;
            },
          ],
          [
            x + w,
            (v: number) => {
              x = v - w;
            },
          ],
        ] as const) {
          const s = snap(edge, vLines, thX);
          if (s !== null) {
            setX(s);
            gv.push(s);
            break;
          }
        }
        for (const [edge, setY] of [
          [
            y,
            (v: number) => {
              y = v;
            },
          ],
          [
            y + h / 2,
            (v: number) => {
              y = v - h / 2;
            },
          ],
          [
            y + h,
            (v: number) => {
              y = v - h;
            },
          ],
        ] as const) {
          const s = snap(edge, hLines, thY);
          if (s !== null) {
            setY(s);
            gh.push(s);
            break;
          }
        }
      } else {
        if (mode.includes('e')) {
          w += dx;
          const s = snap(x + w, vLines, thX);
          if (s !== null) {
            w = s - x;
            gv.push(s);
          }
        }
        if (mode.includes('w')) {
          x += dx;
          w -= dx;
          const s = snap(x, vLines, thX);
          if (s !== null) {
            w += x - s;
            x = s;
            gv.push(s);
          }
        }
        if (mode.includes('s')) {
          h += dy;
          const s = snap(y + h, hLines, thY);
          if (s !== null) {
            h = s - y;
            gh.push(s);
          }
        }
        if (mode.includes('n')) {
          y += dy;
          h -= dy;
          const s = snap(y, hLines, thY);
          if (s !== null) {
            h += y - s;
            y = s;
            gh.push(s);
          }
        }
        if (w < MIN) {
          if (mode.includes('w')) x -= MIN - w;
          w = MIN;
        }
        if (h < MIN) {
          if (mode.includes('n')) y -= MIN - h;
          h = MIN;
        }
      }
      setGuides({ v: gv, h: gh });
      commit(
        items.map((o, j) =>
          j === i ? { ...o, x: r1(x), y: r1(y), w: r1(w), h: r1(h) } : o
        )
      );
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('cnv-dragging');
      setGuides({ v: [], h: [] });
      if (!moved && onTap) onTap();
      setTimeout(() => {
        dragging.current = false;
      }, 0);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /* ── rotate: drag the halo handle; snaps every 45° ───────────────── */
  const startRotate = (e: RPE, i: number) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    document.body.classList.add('cnv-dragging');
    const cont = rootRef.current!.getBoundingClientRect();
    const it = items[i];
    const cx = cont.left + ((it.x + it.w / 2) / 100) * cont.width;
    const cy = cont.top + ((it.y + it.h / 2) / 100) * cont.height;
    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      dragging.current = true;
      let a =
        (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
      a = ((a % 360) + 360) % 360;
      const near45 = Math.round(a / 45) * 45;
      if (Math.abs(a - near45) < 4) a = near45 % 360;
      commit(
        items.map((o, j) => (j === i ? { ...o, rot: r1(a === 0 ? 0 : a) } : o))
      );
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('cnv-dragging');
      setTimeout(() => {
        dragging.current = false;
      }, 0);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /* ── keyboard: delete / nudge / deselect ─────────────────────────── */
  useEffect(() => {
    if (!editable || sel === null || editing !== null || dataEdit !== null)
      return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        commit(items.filter((_, j) => j !== sel));
        setSel(null);
      } else if (e.key === 'Escape') {
        setSel(null);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 0.5;
        const d = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        }[e.key]!;
        commit(
          items.map((o, j) =>
            j === sel ? { ...o, x: r1(o.x + d[0]), y: r1(o.y + d[1]) } : o
          )
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, sel, editing, dataEdit, items]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── context menus ───────────────────────────────────────────────── */
  const pctAt = (cx: number, cy: number) => {
    const r = rootRef.current!.getBoundingClientRect();
    return {
      x: r1(((cx - r.left) / r.width) * 100),
      y: r1(((cy - r.top) / r.height) * 100),
    };
  };
  const menuItems = (): MenuItem[] => {
    if (!menu) return [];
    if (menu.item === null) {
      const at = pctAt(menu.x, menu.y);
      const add = (it: CnvItem) => {
        commit([...items, it]);
        setSel(items.length);
      };
      return [
        { label: 'Add text', onClick: () => add(make.text(at.x, at.y)) },
        { label: 'Add image', onClick: () => add(make.image(at.x, at.y)) },
        {
          label: 'Add shape',
          onClick: () => add(make.shape(at.x, at.y, 'rounded', 'fill')),
        },
        { label: 'Add table', onClick: () => add(make.table(at.x, at.y)) },
      ];
    }
    const i = menu.item;
    const it = items[i];
    const out: MenuItem[] = [];
    const upd = (patch: Partial<CnvItem>) =>
      commit(items.map((o, j) => (j === i ? { ...o, ...patch } : o)));
    if (it.type === 'table') {
      const cols = it.columns ?? [],
        rows = it.rows ?? [];
      out.push(
        {
          label: 'Edit data…',
          onClick: () => {
            setSel(i);
            setDataEdit(i);
          },
        },
        {
          label: 'Add row',
          onClick: () => upd({ rows: [...rows, cols.map(() => '—')] }),
        },
        {
          label: 'Add column',
          onClick: () =>
            upd({
              columns: [...cols, 'New'],
              rows: rows.map((r) => [...r, '—']),
            }),
        }
      );
      if (rows.length > 1)
        out.push({
          label: 'Remove last row',
          onClick: () => upd({ rows: rows.slice(0, -1) }),
        });
      if (cols.length > 1)
        out.push({
          label: 'Remove last column',
          onClick: () =>
            upd({
              columns: cols.slice(0, -1),
              rows: rows.map((r) => r.slice(0, -1)),
            }),
        });
      out.push({ separator: true, label: '' });
    }
    if (it.type === 'image') {
      out.push({
        label: 'Set image URL…',
        onClick: () => {
          const url = window.prompt('Image URL', it.url || '');
          if (url !== null) upd({ url });
        },
      });
    }
    if (it.type === 'chart' || it.type === 'compare') {
      out.push({
        label: 'Edit data…',
        onClick: () => {
          setSel(i);
          setDataEdit(i);
        },
      });
    }
    if (it.type === 'shape') {
      out.push({
        label: it.variant === 'outline' ? 'Make filled' : 'Make outline',
        onClick: () =>
          upd({ variant: it.variant === 'outline' ? 'fill' : 'outline' }),
      });
    }
    if (it.type === 'line') {
      out.push(
        {
          label: it.dash ? 'Make solid' : 'Make dashed',
          onClick: () => upd({ dash: !it.dash }),
        },
        {
          label: 'Cycle arrows',
          onClick: () =>
            upd({
              arrows:
                it.arrows === 'both'
                  ? 'none'
                  : it.arrows === 'end'
                  ? 'both'
                  : 'end',
            }),
        }
      );
    }
    if (it.rot)
      out.push({ label: 'Reset rotation', onClick: () => upd({ rot: 0 }) });
    out.push(
      {
        label: 'Bring to front',
        onClick: () => {
          const n = items.filter((_, j) => j !== i);
          n.push(it);
          commit(n);
          setSel(n.length - 1);
        },
      },
      {
        label: 'Send to back',
        onClick: () => {
          const n = items.filter((_, j) => j !== i);
          n.unshift(it);
          commit(n);
          setSel(0);
        },
      },
      {
        label: 'Duplicate',
        onClick: () => {
          commit([...items, { ...it, x: r1(it.x + 3), y: r1(it.y + 3) }]);
          setSel(items.length);
        },
      },
      { separator: true, label: '' },
      {
        label: 'Delete',
        danger: true,
        onClick: () => {
          commit(items.filter((_, j) => j !== i));
          setSel(null);
        },
      }
    );
    return out;
  };

  /* ── render ──────────────────────────────────────────────────────── */
  const renderInner = (it: CnvItem, i: number): ReactNode => {
    switch (it.type) {
      case 'text':
        return (
          <div
            className={
              'cnv-text' +
              (it.font === 'head' ? ' head' : it.font === 'body' ? ' body' : '')
            }
            onDragStart={(e) => e.preventDefault()}
          >
            <T path={`items.${i}.text`} placeholder="Text" block />
          </div>
        );
      case 'image':
        return (
          <div className="cnv-img" style={{ borderRadius: it.radius ?? 16 }}>
            {it.url ? (
              <img src={it.url} alt="" draggable={false} />
            ) : (
              <div className="poster-wash" aria-hidden />
            )}
          </div>
        );
      case 'shape':
        return (
          <ShapeGlyph
            shape={it.shape ?? 'rounded'}
            variant={it.variant ?? 'fill'}
            fill={it.fill ?? it.bg}
            stroke={it.stroke}
            strokeW={it.strokeW}
            radius={it.radius}
          />
        );
      case 'line':
        return (
          <LineGlyph
            dash={it.dash}
            arrows={it.arrows}
            bg={it.fill ?? it.bg}
            strokeW={it.strokeW}
          />
        );
      case 'chart':
        return <ChartItem it={it} />;
      case 'compare':
        return (
          <div className="cnv-cmp">
            <Comparison
              cols={it.cols ?? []}
              rows={it.cmpRows ?? []}
              highlight={it.highlight ?? 0}
            />
          </div>
        );
      case 'table':
        return (
          <div className="dtable mat cnv-tbl">
            <table>
              <thead>
                <tr>
                  {(it.columns ?? []).map((_, c) => (
                    <th
                      key={c}
                      className={c === it.highlightCol ? 'hl-col' : undefined}
                    >
                      <T path={`items.${i}.columns.${c}`} placeholder="Col" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(it.rows ?? []).map((row, r) => (
                  <tr key={r}>
                    {row.map((_, c) => (
                      <td
                        key={c}
                        className={c === it.highlightCol ? 'hl-col' : undefined}
                      >
                        <T path={`items.${i}.rows.${r}.${c}`} placeholder="—" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      /* legacy first-version types keep rendering */
      case 'ellipse':
        return (
          <div
            className="cnv-box ellipse"
            style={{ background: it.bg || undefined }}
          />
        );
      case 'triangle':
        return (
          <div
            className="cnv-box tri"
            style={{ background: it.bg || undefined }}
          />
        );
      default:
        return (
          <div
            className="cnv-box"
            style={{
              borderRadius: it.radius ?? 16,
              background: it.bg || undefined,
            }}
          />
        );
    }
  };

  return (
    <div
      ref={rootRef}
      className="cnv"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          setSel(null);
          setEditing(null);
        }
      }}
      onContextMenu={
        editable
          ? (e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, item: null });
              }
            }
          : undefined
      }
    >
      {items.map((it, i) => {
        const style = {
          left: `${it.x}%`,
          top: `${it.y}%`,
          width: `${it.w}%`,
          height: `${it.h}%`,
          transform: it.rot ? `rotate(${it.rot}deg)` : undefined,
        };
        const inner = renderInner(it, i);
        const body = isStatic ? (
          inner
        ) : (
          <motion.div
            style={{ width: '100%', height: '100%' }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.55,
              delay: 0.12 + i * 0.07,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {inner}
          </motion.div>
        );
        if (!editable)
          return (
            <div key={i} className="cnv-item" style={style}>
              {body}
            </div>
          );
        return (
          <div
            key={i}
            className={'cnv-item edit' + (sel === i ? ' sel' : '')}
            style={style}
            onPointerDown={(e) => {
              // frame area (padding/border) still moves an item being text-edited
              if (editing === i && (e.target as HTMLElement).isContentEditable)
                return;
              if (
                (it.type === 'chart' || it.type === 'compare') &&
                isDoubleTap(e, i)
              ) {
                setSel(i);
                setDataEdit(i);
                return;
              }
              startDrag(e, i, 'move');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({ x: e.clientX, y: e.clientY, item: i });
            }}
            onBlurCapture={
              editing === i
                ? (e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node))
                      setEditing(null);
                  }
                : undefined
            }
          >
            {body}
            {(it.type === 'text' || it.type === 'table') && editing !== i && (
              <div
                className="cnv-shield"
                onPointerDown={(e) => {
                  if (isDoubleTap(e, i)) {
                    e.stopPropagation(); // else the item's own handler startDrags and clobbers editing
                    enterEdit(i);
                    return;
                  }
                  // Pitch gesture: a plain tap (no drag) on an already-selected
                  // item enters text editing on release — no fast timing needed
                  startDrag(
                    e,
                    i,
                    'move',
                    sel === i ? () => enterEdit(i) : undefined
                  );
                }}
              />
            )}
            {sel === i &&
              HANDLES.map((h) => (
                <span
                  key={h}
                  className={`cnv-handle ${h}`}
                  onPointerDown={(e) => startDrag(e, i, h)}
                />
              ))}
            {sel === i && (
              <span
                className="cnv-rot"
                title="Rotate (snaps every 45°)"
                onPointerDown={(e) => startRotate(e, i)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M20 12a8 8 0 1 1-2.4-5.7" />
                  <path d="M18 2v4.5h-4.5" />
                </svg>
              </span>
            )}
          </div>
        );
      })}
      {editable && (
        <InsertBar
          onAdd={(it) => {
            commit([...items, it]);
            setSel(items.length);
          }}
        />
      )}
      {editable &&
        guides.v.map((v) => (
          <div
            key={`v${v}`}
            className="cnv-guide v"
            style={{ left: `${v}%` }}
          />
        ))}
      {editable &&
        guides.h.map((h) => (
          <div key={`h${h}`} className="cnv-guide h" style={{ top: `${h}%` }} />
        ))}
      {menu &&
        createPortal(
          <ContextMenu
            x={menu.x}
            y={menu.y}
            items={menuItems()}
            onClose={() => setMenu(null)}
          />,
          document.body
        )}
      {editable &&
        dataEdit !== null &&
        ['chart', 'table', 'compare'].includes(items[dataEdit]?.type ?? '') && (
          <DataPanel
            it={items[dataEdit]}
            onChange={(patch) =>
              commit(
                items.map((o, j) => (j === dataEdit ? { ...o, ...patch } : o))
              )
            }
            onClose={() => setDataEdit(null)}
          />
        )}
    </div>
  );
}
