/* CompareEditor — visual editing for the comparison matrix, on the
   TableEditor pattern:
     · header names + row labels edit in place (T)
     · click a ✓/✗ chip to toggle it; right-click any value cell to switch
       between Check / Cross / Text (text cells edit in place)
     · hover → ⠿ grips outside the edges: drag to reorder rows or value
       columns (insertion indicators), right-click for delete / highlight
     · "+" strips: bottom adds a row, right adds a column
   Data model: cols: string[] (first entry = label-column header), rows:
   [{ label, values: (boolean|string)[] }], highlight indexes value columns. */
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../data/store'
import { useEdit } from './EditContext'
import type { SlideData } from '../data/types'
import T from './EditableText'
import ContextMenu, { type MenuItem } from './ContextMenu'
import { offsetTo } from './measure'

type Val = boolean | string
export interface CmpData { cols: string[]; rows: { label: string; values: Val[] }[] }

const Check = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>)
const Cross = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M7 7l10 10M17 7L7 17" /></svg>)

interface Rects { left: number; top: number; width: number; height: number; cols: number[]; rows: number[] }

export default function CompareEditor({ slide, data }: { slide: SlideData; data: CmpData }) {
  const { slideId } = useEdit()
  const setProp = useStore((s) => s.setProp)
  const wrapRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [rects, setRects] = useState<Rects | null>(null)
  const [hover, setHover] = useState<{ row: number | null; col: number | null }>({ row: null, col: null })
  const [menu, setMenu] = useState<{ x: number; y: number; kind: 'row' | 'col' | 'cell'; index: number; ci?: number } | null>(null)

  const { cols, rows } = data
  const hl = (slide.props.highlight ?? null) as number | null // value-column index

  const write = (c: string[], r: { label: string; values: Val[] }[], hlv: number | null) => {
    if (!slideId) return
    setProp(slideId, 'cols', c)
    setProp(slideId, 'rows', r)
    setProp(slideId, 'highlight', hlv ?? undefined)
  }
  const clone = () => ({ c: [...cols], r: rows.map((x) => ({ label: x.label, values: [...x.values] })) })

  useLayoutEffect(() => {
    const update = () => {
      const wrap = wrapRef.current, grid = gridRef.current
      if (!wrap || !grid) return
      const g = offsetTo(grid, wrap)
      const head = grid.querySelector('.cmp-head')
      setRects({
        left: g.x, top: g.y, width: grid.offsetWidth, height: grid.offsetHeight,
        cols: head ? Array.from(head.children).map((c) => g.x + (c as HTMLElement).offsetLeft + (c as HTMLElement).offsetWidth / 2) : [],
        rows: Array.from(grid.querySelectorAll('.cmp-row:not(.cmp-head)')).map((r) => g.y + (r as HTMLElement).offsetTop + (r as HTMLElement).offsetHeight / 2),
      })
    }
    update()
    const ro = new ResizeObserver(update)
    if (gridRef.current) ro.observe(gridRef.current)
    return () => ro.disconnect()
  }, [cols.length, rows.length])

  /* ── ops ── */
  const addRow = () => { const { c, r } = clone(); r.push({ label: '', values: new Array(c.length - 1).fill(true) }); write(c, r, hl) }
  const addCol = () => { const { c, r } = clone(); c.push(''); r.forEach((row) => row.values.push(true)); write(c, r, hl) }
  const delRow = (i: number) => { if (rows.length <= 1) return; const { c, r } = clone(); r.splice(i, 1); write(c, r, hl) }
  const delCol = (vi: number) => { // vi = value-column index
    if (cols.length <= 2) return
    const { c, r } = clone()
    c.splice(vi + 1, 1); r.forEach((row) => row.values.splice(vi, 1))
    write(c, r, hl === vi ? null : hl != null && hl > vi ? hl - 1 : hl)
  }
  const moveRow = (from: number, to: number) => { const { c, r } = clone(); const [m] = r.splice(from, 1); r.splice(to, 0, m); write(c, r, hl) }
  const moveCol = (from: number, to: number) => { // value-column indices
    const { c, r } = clone()
    const shift = (list: unknown[]) => { const [m] = list.splice(from, 1); list.splice(to, 0, m) }
    const heads = c.slice(1); shift(heads)
    r.forEach((row) => shift(row.values))
    let hlv = hl
    if (hlv != null) {
      const order = [...Array(heads.length).keys()]
      const [m] = order.splice(from, 1); order.splice(to, 0, m)
      hlv = order.indexOf(hlv)
    }
    write([c[0], ...heads], r, hlv)
  }
  const setVal = (ri: number, vi: number, v: Val) => {
    const { c, r } = clone()
    r[ri].values[vi] = v
    write(c, r, hl)
  }

  /* ── pointer drags ── */
  const startDrag = (kind: 'row' | 'col', from: number) => (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    const grid = gridRef.current
    if (!grid) return
    document.body.classList.add('li-dragging')
    const bodyRows = () => Array.from(grid.querySelectorAll('.cmp-row:not(.cmp-head)')) as HTMLElement[]
    const colCells = (vi: number) => Array.from(grid.querySelectorAll(`.cmp-row > *:nth-child(${vi + 2})`)) as HTMLElement[]
    const srcEls = kind === 'row' ? [bodyRows()[from]] : colCells(from)
    srcEls.forEach((el) => el?.classList.add('li-src'))
    let target: { i: number; els: HTMLElement[]; cls: string } | null = null
    const clear = () => { target?.els.forEach((el) => el.classList.remove('tr-before', 'tr-after', 'tc-before', 'tc-after')); target = null }
    const onMove = (ev: MouseEvent) => {
      const cell = document.elementsFromPoint(ev.clientX, ev.clientY)
        .find((el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains('cmp-cell') && grid.contains(el))
      if (!cell) { clear(); return }
      const rowEl = cell.parentElement as HTMLElement
      const isHead = rowEl.classList.contains('cmp-head')
      const i = kind === 'row'
        ? (isHead ? -1 : bodyRows().indexOf(rowEl))
        : Array.from(rowEl.children).indexOf(cell) - 1
      if (i === from || i < 0) { clear(); return }
      const side = from < i ? 'after' : 'before'
      const cls = kind === 'row' ? `tr-${side}` : `tc-${side}`
      if (target?.i === i && target.cls === cls) return
      clear()
      const els = kind === 'row' ? [bodyRows()[i]] : colCells(i)
      els.forEach((el) => el?.classList.add(cls))
      target = { i, els, cls }
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('li-dragging')
      srcEls.forEach((el) => el?.classList.remove('li-src'))
      if (target) (kind === 'row' ? moveRow : moveCol)(from, target.i)
      clear()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const onGridMove = (e: React.MouseEvent) => {
    const cell = (e.target as HTMLElement).closest('.cmp-cell') as HTMLElement | null
    if (!cell) return
    const rowEl = cell.parentElement as HTMLElement
    const isHead = rowEl.classList.contains('cmp-head')
    const ci = Array.from(rowEl.children).indexOf(cell)
    const bodyRows = Array.from(gridRef.current?.querySelectorAll('.cmp-row:not(.cmp-head)') ?? [])
    const row = isHead ? null : bodyRows.indexOf(rowEl)
    const col = ci >= 1 ? ci - 1 : null // value columns only
    if (hover.row !== row || hover.col !== col) setHover({ row, col })
  }

  const menuItems = (m: NonNullable<typeof menu>): MenuItem[] => {
    if (m.kind === 'row') return [{ label: 'Delete row', danger: true, onClick: () => delRow(m.index) }]
    if (m.kind === 'col') return [
      { label: hl === m.index ? 'Remove highlight' : 'Highlight column', onClick: () => write([...cols], rows.map((r) => ({ ...r, values: [...r.values] })), hl === m.index ? null : m.index) },
      { separator: true, label: '' },
      { label: 'Delete column', danger: true, onClick: () => delCol(m.index) },
    ]
    return [
      { label: '✓  Check', onClick: () => setVal(m.index, m.ci!, true) },
      { label: '✗  Cross', onClick: () => setVal(m.index, m.ci!, false) },
      { label: 'Text…', onClick: () => setVal(m.index, m.ci!, '') },
    ]
  }

  const vcols = cols.length - 1

  return (
    <div className="tbl-wrap cmp-wrap" ref={wrapRef} onMouseLeave={() => setHover({ row: null, col: null })}>
      <div className="cmp mat" ref={gridRef} style={{ ['--vcols' as never]: String(vcols) }} onMouseMove={onGridMove}>
        <div className="cmp-row cmp-head">
          {cols.map((_, i) => (
            <div key={i} className={'cmp-cell cmp-h' + (i - 1 === hl ? ' hl' : '')}>
              <T path={`cols.${i}`} placeholder={i === 0 ? '—' : 'Column'} />
            </div>
          ))}
        </div>
        {rows.map((r, ri) => (
          <div key={ri} className="cmp-row">
            <div className="cmp-cell cmp-label"><T path={`rows.${ri}.label`} placeholder="Feature" /></div>
            {r.values.map((v, vi) => (
              <div
                key={vi}
                className={'cmp-cell' + (vi === hl ? ' hl' : '')}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, kind: 'cell', index: ri, ci: vi }) }}
              >
                {typeof v === 'boolean' ? (
                  <button
                    className={'cmp-chip cmp-chip-btn ' + (v ? 'ok' : 'no')}
                    title="Click to toggle · right-click for options"
                    onClick={() => setVal(ri, vi, !v)}
                  >
                    {v ? <Check /> : <Cross />}
                  </button>
                ) : (
                  <span className="cmp-val"><T path={`rows.${ri}.values.${vi}`} placeholder="—" /></span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {rects && hover.col != null && rects.cols[hover.col + 1] != null && (
        <span
          className="tbl-grip tbl-grip-col"
          style={{ left: rects.cols[hover.col + 1], top: rects.top }}
          title="Drag to reorder · right-click for options"
          onMouseDown={startDrag('col', hover.col)}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, kind: 'col', index: hover.col! }) }}
        >⠿</span>
      )}
      {rects && hover.row != null && rects.rows[hover.row] != null && (
        <span
          className="tbl-grip tbl-grip-row"
          style={{ left: rects.left, top: rects.rows[hover.row] }}
          title="Drag to reorder · right-click to delete"
          onMouseDown={startDrag('row', hover.row)}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, kind: 'row', index: hover.row! }) }}
        >⠿</span>
      )}

      {rects && (
        <>
          <button className="tbl-add tbl-add-row" title="Add row"
            style={{ left: rects.left, top: rects.top + rects.height, width: rects.width }}
            onClick={addRow}>+</button>
          <button className="tbl-add tbl-add-col" title="Add column"
            style={{ left: rects.left + rects.width, top: rects.top, height: rects.height }}
            onClick={addCol}>+</button>
        </>
      )}

      {menu && createPortal(
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu)} onClose={() => setMenu(null)} />,
        document.body,
      )}
    </div>
  )
}
