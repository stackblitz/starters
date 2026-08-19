/* "Edit data" bottom sheet for the STRUCTURED layouts that carry data —
   chart (all kinds), insight, table, comparison. Same sheet design as the
   freeform drawer (shared .cnv-data styles): spreadsheet-like grid docked
   to the bottom of the window, editing slide props live. */
import { createPortal } from 'react-dom'
import type { SlideData } from '@/data/types'
import { useStore } from '@/data/store'
import CmpCell from '@/edit/CmpCell'
import { TrashIcon } from '@/edit/icons'

const SWATCHES = ['var(--accent)', '#ffffff', '#94a3b8', '#475569', '#0b1026', '#ff6b6b', '#ffd166', '#34d399', '#a78bfa']

function Swatches({ value, onChange, allowNone = true }: {
  value: string | undefined
  onChange: (v: string | undefined) => void
  allowNone?: boolean
}) {
  return (
    <div className="cnvp-swatches">
      {allowNone && (
        <button
          className={'cnvp-sw none' + (!value ? ' on' : '')}
          title="Default"
          onClick={() => onChange(undefined)}
        />
      )}
      {SWATCHES.map((c) => (
        <button
          key={c}
          className={'cnvp-sw' + (value === c ? ' on' : '')}
          style={{ background: c }}
          title={c}
          onClick={() => onChange(c)}
        />
      ))}
      <input
        type="color"
        className="cnvp-sw pick"
        title="Custom color"
        value={/^#[0-9a-f]{6}$/i.test(value ?? '') ? (value as string) : '#1688fc'}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

const pipe = (s: unknown): string[] =>
  String(s ?? '').split('|').map((x) => x.trim()).filter((x) => x !== '')

export function hasDataSheet(slide: SlideData): boolean {
  return ['chart', 'insight', 'table', 'comparison'].includes(slide.layout)
}

export default function LayoutDataSheet({ slide, onClose }: { slide: SlideData; onClose: () => void }) {
  const setProp = useStore((s) => s.setProp)
  const set = (path: string, v: unknown) => setProp(slide.id, path, v)
  const p = slide.props

  /* ── resolve the slide's data model ──────────────────────────────── */
  const kind: string = slide.layout === 'table' ? 'table'
    : slide.layout === 'comparison' ? 'comparison'
    : slide.layout === 'insight' ? `i-${p.kind ?? 'bars'}`
    : String(p.kind ?? 'bars')

  let head: React.ReactNode = null
  let body: React.ReactNode = null
  let actions: React.ReactNode = null

  const x = (props: { disabled?: boolean; onClick: () => void; title: string }) => (
    <button className="cnv-data-x" title={props.title} disabled={props.disabled} onClick={props.onClick}><TrashIcon /></button>
  )

  /* bars (chart + insight share the shape via barsPath) */
  const barsSheet = (barsPath: string) => {
    const bars: { label: string; value: number }[] = Array.isArray(p[barsPath]) ? p[barsPath] : []
    body = (
      <div className="cnv-data-grid bars">
        <span className="cnv-data-th" /><span className="cnv-data-th">Category</span><span className="cnv-data-th">Value</span><span className="cnv-data-th" />
        {bars.map((b, r) => (
          <div key={r} className="cnv-data-row">
            <span className="cnv-data-no">{r + 1}</span>
            <input value={b.label} onChange={(e) => set(`${barsPath}.${r}.label`, e.target.value)} />
            <input inputMode="decimal" value={String(b.value)} onChange={(e) => set(`${barsPath}.${r}.value`, Number(e.target.value) || 0)} />
            {x({ title: 'Remove row', disabled: bars.length <= 1, onClick: () => set(barsPath, bars.filter((_, j) => j !== r)) })}
          </div>
        ))}
      </div>
    )
    actions = <button className="ghost-btn" onClick={() => set(barsPath, [...bars, { label: `Q${bars.length + 1}`, value: 10 }])}>+ Row</button>
  }

  /* pipe-of-numbers (chart line + insight line) */
  const pointsSheet = (pointsPath: string) => {
    const pts = pipe(p[pointsPath])
    const setPts = (next: string[]) => set(pointsPath, next.join(' | '))
    body = (
      <div className="cnv-data-grid line">
        <span className="cnv-data-th" /><span className="cnv-data-th">Value</span><span className="cnv-data-th" />
        {pts.map((v, r) => (
          <div key={r} className="cnv-data-row">
            <span className="cnv-data-no">{r + 1}</span>
            <input inputMode="decimal" value={v} onChange={(e) => setPts(pts.map((o, j) => (j === r ? e.target.value : o)))} />
            {x({ title: 'Remove row', disabled: pts.length <= 2, onClick: () => setPts(pts.filter((_, j) => j !== r)) })}
          </div>
        ))}
      </div>
    )
    actions = <button className="ghost-btn" onClick={() => setPts([...pts, '10'])}>+ Row</button>
  }

  const donutSheet = () => {
    body = (
      <div className="cnv-data-grid donut">
        <span className="cnv-data-th">Percent (0–100)</span><span className="cnv-data-th">Label</span>
        <div className="cnv-data-row">
          <input inputMode="decimal" value={String(p.donutValue ?? 0)} onChange={(e) => set('donutValue', Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
          <input value={p.donutLabel ?? ''} onChange={(e) => set('donutLabel', e.target.value)} />
        </div>
      </div>
    )
  }

  if (kind === 'bars' || kind === 'i-bars') barsSheet('bars')
  else if (kind === 'line') pointsSheet('points')
  else if (kind === 'i-line') pointsSheet('points_line')
  else if (kind === 'donut' || kind === 'i-donut') donutSheet()

  else if (kind === 'donuts') {
    const donuts: { value: number; label: string }[] = Array.isArray(p.donuts) ? p.donuts : []
    body = (
      <div className="cnv-data-grid bars">
        <span className="cnv-data-th" /><span className="cnv-data-th">Label</span><span className="cnv-data-th">Percent</span><span className="cnv-data-th" />
        {donuts.map((d, r) => (
          <div key={r} className="cnv-data-row">
            <span className="cnv-data-no">{r + 1}</span>
            <input value={d.label} onChange={(e) => set(`donuts.${r}.label`, e.target.value)} />
            <input inputMode="decimal" value={String(d.value)} onChange={(e) => set(`donuts.${r}.value`, Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
            {x({ title: 'Remove row', disabled: donuts.length <= 1, onClick: () => set('donuts', donuts.filter((_, j) => j !== r)) })}
          </div>
        ))}
      </div>
    )
    actions = <button className="ghost-btn" onClick={() => set('donuts', [...donuts, { label: 'New', value: 50 }])}>+ Row</button>
  }

  else if (kind === 'grouped') {
    /* categories = editable column headers · each series = one row */
    const cats = pipe(p.categories)
    const series: { label: string; values: string }[] = Array.isArray(p.series) ? p.series : []
    body = (
      <div className="cnv-data-grid table" style={{ gridTemplateColumns: `30px minmax(110px, 1fr) repeat(${cats.length}, minmax(80px, 1fr)) 30px` }}>
        <span className="cnv-data-no" />
        <span className="cnv-data-th">Series</span>
        {cats.map((c, ci) => (
          <span key={ci} className="cnv-data-colhead">
            <input value={c} onChange={(e) => set('categories', cats.map((o, j) => (j === ci ? e.target.value : o)).join(' | '))} />
            {x({ title: 'Remove column', disabled: cats.length <= 1, onClick: () => {
              set('categories', cats.filter((_, j) => j !== ci).join(' | '))
              set('series', series.map((sr) => ({ ...sr, values: pipe(sr.values).filter((_, j) => j !== ci).join(' | ') })))
            } })}
          </span>
        ))}
        <span />
        {series.map((sr, r) => {
          const vals = pipe(sr.values)
          return (
            <div key={r} className="cnv-data-row">
              <span className="cnv-data-no">{r + 1}</span>
              <input value={sr.label} onChange={(e) => set(`series.${r}.label`, e.target.value)} />
              {cats.map((_, ci) => (
                <input
                  key={ci} inputMode="decimal" value={vals[ci] ?? ''}
                  onChange={(e) => {
                    const next = cats.map((_, j) => (j === ci ? e.target.value : (vals[j] ?? '0')))
                    set(`series.${r}.values`, next.join(' | '))
                  }}
                />
              ))}
              {x({ title: 'Remove series', disabled: series.length <= 1, onClick: () => set('series', series.filter((_, j) => j !== r)) })}
            </div>
          )
        })}
      </div>
    )
    actions = (
      <>
        <button className="ghost-btn" onClick={() => set('series', [...series, { label: `Series ${series.length + 1}`, values: cats.map(() => '10').join(' | ') }])}>+ Series</button>
        <button className="ghost-btn" onClick={() => {
          set('categories', [...cats, 'New'].join(' | '))
          set('series', series.map((sr) => ({ ...sr, values: [...pipe(sr.values), '10'].join(' | ') })))
        }}>+ Column</button>
      </>
    )
  }

  else if (kind === 'lines') {
    const lines: { label: string; points: string }[] = Array.isArray(p.lines) ? p.lines : []
    const n = Math.max(2, ...lines.map((l) => pipe(l.points).length))
    body = (
      <div className="cnv-data-grid table" style={{ gridTemplateColumns: `30px minmax(110px, 1fr) repeat(${n}, minmax(64px, 1fr)) 30px` }}>
        <span className="cnv-data-no" />
        <span className="cnv-data-th">Line</span>
        {Array.from({ length: n }, (_, ci) => <span key={ci} className="cnv-data-th">{ci + 1}</span>)}
        <span />
        {lines.map((l, r) => {
          const vals = pipe(l.points)
          return (
            <div key={r} className="cnv-data-row">
              <span className="cnv-data-no">{r + 1}</span>
              <input value={l.label} onChange={(e) => set(`lines.${r}.label`, e.target.value)} />
              {Array.from({ length: n }, (_, ci) => (
                <input
                  key={ci} inputMode="decimal" value={vals[ci] ?? ''}
                  onChange={(e) => {
                    const next = [...vals]
                    while (next.length < n) next.push('')
                    next[ci] = e.target.value
                    set(`lines.${r}.points`, next.filter((v) => v !== '').join(' | '))
                  }}
                />
              ))}
              {x({ title: 'Remove line', disabled: lines.length <= 1, onClick: () => set('lines', lines.filter((_, j) => j !== r)) })}
            </div>
          )
        })}
      </div>
    )
    actions = <button className="ghost-btn" onClick={() => set('lines', [...lines, { label: `Line ${lines.length + 1}`, points: '10 | 20 | 15' }])}>+ Line</button>
  }

  else if (kind === 'table') {
    const cols: string[] = Array.isArray(p.columns) ? p.columns : []
    const rows: string[][] = Array.isArray(p.rows) ? p.rows : []
    body = (
      <div className="cnv-data-grid table" style={{ gridTemplateColumns: `30px repeat(${cols.length}, minmax(90px, 1fr)) 30px` }}>
        <span className="cnv-data-no" />
        {cols.map((c, ci) => (
          <span key={ci} className="cnv-data-colhead">
            <input value={c} onChange={(e) => set(`columns.${ci}`, e.target.value)} />
            {x({ title: 'Remove column', disabled: cols.length <= 1, onClick: () => {
              set('columns', cols.filter((_, j) => j !== ci))
              set('rows', rows.map((r) => r.filter((_, j) => j !== ci)))
            } })}
          </span>
        ))}
        <span />
        {rows.map((row, r) => (
          <div key={r} className="cnv-data-row">
            <span className="cnv-data-no">{r + 1}</span>
            {cols.map((_, c) => (
              <input key={c} value={row[c] ?? ''} onChange={(e) => set(`rows.${r}.${c}`, e.target.value)} />
            ))}
            {x({ title: 'Remove row', disabled: rows.length <= 1, onClick: () => set('rows', rows.filter((_, j) => j !== r)) })}
          </div>
        ))}
      </div>
    )
    actions = (
      <>
        <button className="ghost-btn" onClick={() => set('rows', [...rows, cols.map(() => '—')])}>+ Row</button>
        <button className="ghost-btn" onClick={() => { set('columns', [...cols, 'New']); set('rows', rows.map((r) => [...r, '—'])) }}>+ Column</button>
      </>
    )
  }

  else if (kind === 'comparison') {
    const cols: string[] = Array.isArray(p.cols) ? p.cols : []
    const rows: { label: string; values: (boolean | string)[] }[] = Array.isArray(p.rows) ? p.rows : []
    body = (
      <div className="cnv-data-grid table" style={{ gridTemplateColumns: `30px repeat(${cols.length}, minmax(90px, 1fr)) 30px` }}>
        <span className="cnv-data-no" />
        {cols.map((c, ci) => (
          <span key={ci} className="cnv-data-colhead">
            <input value={c} placeholder={ci === 0 ? 'Label column' : ''} onChange={(e) => set(`cols.${ci}`, e.target.value)} />
            {ci > 0 && x({ title: 'Remove column', disabled: cols.length <= 2, onClick: () => {
              set('cols', cols.filter((_, j) => j !== ci))
              set('rows', rows.map((r) => ({ ...r, values: r.values.filter((_, j) => j !== ci - 1) })))
            } })}
          </span>
        ))}
        <span />
        {rows.map((row, r) => (
          <div key={r} className="cnv-data-row">
            <span className="cnv-data-no">{r + 1}</span>
            <input value={row.label} onChange={(e) => set(`rows.${r}.label`, e.target.value)} />
            {cols.slice(1).map((_, c) => (
              <CmpCell key={c} value={row.values[c] ?? true} onChange={(nv) => set(`rows.${r}.values.${c}`, nv)} />
            ))}
            {x({ title: 'Remove row', disabled: rows.length <= 1, onClick: () => set('rows', rows.filter((_, j) => j !== r)) })}
          </div>
        ))}
      </div>
    )
    actions = (
      <>
        <button className="ghost-btn" onClick={() => set('rows', [...rows, { label: 'New row', values: cols.slice(1).map(() => true) }])}>+ Row</button>
        <button className="ghost-btn" onClick={() => { set('cols', [...cols, 'New']); set('rows', rows.map((r) => ({ ...r, values: [...r.values, true] }))) }}>+ Column</button>
      </>
    )
    head = <span className="fld-hint">Click a cell to toggle it — abc switches the cell to text.</span>
  }

  return createPortal(
    <div className="cnv-data" onPointerDown={(e) => e.stopPropagation()}>
      <div className="cnv-data-body">
        <div className="cnv-data-head">
          <div className="cnv-data-heading">
            <span className="cnv-data-title">Edit data</span>
            {head}
          </div>
          <div className="cnv-data-actions">
            {actions}
            <button className="solid-btn" onClick={onClose}>Done</button>
          </div>
        </div>
        {(slide.layout === 'chart' || slide.layout === 'insight') && (
          <div className="fld" style={{ marginBottom: 10 }}>
            <label>Chart color</label>
            <Swatches value={p.color} onChange={(color) => set('color', color)} />
          </div>
        )}
        {body}
      </div>
    </div>,
    document.body,
  )
}
