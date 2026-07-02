/* A "us vs. them" feature matrix. One value column is highlighted (your column).
   <Comparison cols={['', 'Acme', 'Legacy']} highlight={0}
     rows={[{ label: 'Realtime sync', values: [true, false] },
            { label: 'Price', values: ['$29', '$99'] }]} />
   values are booleans (→ ✓/✗) or strings; `highlight` indexes the value columns. */
import type { CSSProperties } from 'react'

export type CompRow = { label: string; values: (boolean | string)[] }

const Check = () => (<svg className="cmp-ic ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>)
const Cross = () => (<svg className="cmp-ic no" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 7l10 10M17 7L7 17" /></svg>)

export default function Comparison({ cols, rows, highlight = 0 }: { cols: string[]; rows: CompRow[]; highlight?: number }) {
  const vcols = cols.length - 1
  return (
    <div className="cmp" style={{ '--vcols': vcols } as CSSProperties}>
      <div className="cmp-row cmp-head">
        {cols.map((c, i) => (
          <div key={i} className={'cmp-cell cmp-h' + (i - 1 === highlight ? ' hl' : '')}>{c}</div>
        ))}
      </div>
      {rows.map((r, ri) => (
        <div key={ri} className="cmp-row">
          <div className="cmp-cell cmp-label">{r.label}</div>
          {r.values.map((v, vi) => (
            <div key={vi} className={'cmp-cell' + (vi === highlight ? ' hl' : '')}>
              {typeof v === 'boolean' ? (v ? <Check /> : <Cross />) : <span className="cmp-val">{v}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
