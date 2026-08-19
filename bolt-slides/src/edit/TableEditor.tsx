/* TableEditor — the purpose-built editing surface for the table layout.
   Renders the same .dtable markup as the presentation component, plus:
     · every cell edited in place (T)
     · hover a row → ⠿ grip at its left edge; hover a column → ⠿ grip above
       its header. Drag a grip to reorder (full row/column insertion
       indicator); right-click it for Delete / Highlight column.
     · Notion-style "+" strips on the bottom (add row) and right (add column)
   All geometry is measured in layout px (offset* — transform-safe) and every
   overlay dimension multiplies by --inv to stay at true screen size. */
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../data/store'
import { useEdit } from './EditContext'
import type { SlideData } from '../data/types'
import { normTable } from '../layouts/shared'
import T from './EditableText'
import ContextMenu, { type MenuItem } from './ContextMenu'
import { offsetTo } from './measure'

interface Rects { left: number; top: number; width: number; height: number; cols: number[]; rows: number[] }

export default function TableEditor({ slide }: { slide: SlideData }) {
  const { slideId } = useEdit()
  const setProp = useStore((s) => s.setProp)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const [rects, setRects] = useState<Rects | null>(null)
  const [hover, setHover] = useState<{ row: number | null; col: number | null }>({ row: null, col: null })
  const [menu, setMenu] = useState<{ x: number; y: number; kind: 'row' | 'col'; index: number } | null>(null)

  const { columns, rows } = normTable(slide.props)
  const hl = (slide.props.highlightCol ?? null) as number | null

  const write = (c: string[], r: string[][], hlv: number | null) => {
    if (!slideId) return
    setProp(slideId, 'columns', c)
    setProp(slideId, 'rows', r)
    setProp(slideId, 'highlightCol', hlv ?? undefined)
  }
  const clone = () => ({ c: [...columns], r: rows.map((x) => [...x]) })

  /* overlay geometry in layout px — offset chains ignore the canvas scale */
  useLayoutEffect(() => {
    const update = () => {
      const wrap = wrapRef.current, tbl = tableRef.current
      if (!wrap || !tbl) return
      const t = offsetTo(tbl, wrap)
      setRects({
        left: t.x, top: t.y, width: tbl.offsetWidth, height: tbl.offsetHeight,
        cols: Array.from(tbl.querySelectorAll('thead th')).map((th) => t.x + (th as HTMLElement).offsetLeft + (th as HTMLElement).offsetWidth / 2),
        rows: Array.from(tbl.querySelectorAll('tbody tr')).map((tr) => t.y + (tr as HTMLElement).offsetTop + (tr as HTMLElement).offsetHeight / 2),
      })
    }
    update()
    const ro = new ResizeObserver(update)
    if (tableRef.current) ro.observe(tableRef.current)
    return () => ro.disconnect()
  }, [columns.length, rows.length])

  /* ── structure ops ── */
  const addRow = () => { const { c, r } = clone(); r.push(new Array(c.length).fill('')); write(c, r, hl) }
  const addCol = () => { const { c, r } = clone(); c.push(''); r.forEach((row) => row.push('')); write(c, r, hl) }
  const delRow = (i: number) => { if (rows.length <= 1) return; const { c, r } = clone(); r.splice(i, 1); write(c, r, hl) }
  const delCol = (i: number) => {
    if (columns.length <= 1) return
    const { c, r } = clone()
    c.splice(i, 1); r.forEach((row) => row.splice(i, 1))
    write(c, r, hl === i ? null : hl != null && hl > i ? hl - 1 : hl)
  }
  const moveRow = (from: number, to: number) => { const { c, r } = clone(); const [m] = r.splice(from, 1); r.splice(to, 0, m); write(c, r, hl) }
  const moveCol = (from: number, to: number) => {
    const { c, r } = clone()
    const shift = (list: unknown[]) => { const [m] = list.splice(from, 1); list.splice(to, 0, m) }
    shift(c); r.forEach(shift)
    let hlv = hl
    if (hlv != null) {
      const order = [...Array(c.length).keys()] // remap the highlight through the move
      const [m] = order.splice(from, 1)
      order.splice(to, 0, m)
      hlv = order.indexOf(hlv)
    }
    write(c, r, hlv)
  }

  /* ── pointer drags (same pattern as list items — no native DnD) ── */
  const startDrag = (kind: 'row' | 'col', from: number) => (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    const tbl = tableRef.current
    if (!tbl) return
    document.body.classList.add('li-dragging')
    const srcEls = kind === 'row'
      ? [tbl.querySelectorAll('tbody tr')[from] as HTMLElement]
      : Array.from(tbl.querySelectorAll(`tr > *:nth-child(${from + 1})`)) as HTMLElement[]
    srcEls.forEach((el) => el?.classList.add('li-src'))
    let target: { i: number; side: 'before' | 'after'; els: HTMLElement[] } | null = null
    const clear = () => { target?.els.forEach((el) => el.classList.remove('tr-before', 'tr-after', 'tc-before', 'tc-after')); target = null }
    const onMove = (ev: MouseEvent) => {
      const cell = document.elementsFromPoint(ev.clientX, ev.clientY)
        .find((el): el is HTMLElement => el instanceof HTMLElement && (el.tagName === 'TD' || el.tagName === 'TH') && tbl.contains(el)) as HTMLTableCellElement | undefined
      if (!cell) { clear(); return }
      const i = kind === 'row'
        ? (cell.parentElement as HTMLTableRowElement).rowIndex - 1 // minus header row
        : cell.cellIndex
      if (i === from || i < 0) { clear(); return }
      const side: 'before' | 'after' = from < i ? 'after' : 'before'
      if (target?.i === i && target.side === side) return
      clear()
      const els = kind === 'row'
        ? [tbl.querySelectorAll('tbody tr')[i] as HTMLElement]
        : Array.from(tbl.querySelectorAll(`tr > *:nth-child(${i + 1})`)) as HTMLElement[]
      const cls = kind === 'row' ? (side === 'before' ? 'tr-before' : 'tr-after') : (side === 'before' ? 'tc-before' : 'tc-after')
      els.forEach((el) => el?.classList.add(cls))
      target = { i, side, els }
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

  /* hover tracking → which grips to show */
  const onTableMove = (e: React.MouseEvent) => {
    const cell = (e.target as HTMLElement).closest('td,th') as HTMLTableCellElement | null
    if (!cell) return
    const col = cell.cellIndex
    const row = cell.tagName === 'TD' ? (cell.parentElement as HTMLTableRowElement).rowIndex - 1 : null
    if (hover.row !== row || hover.col !== col) setHover({ row, col })
  }

  const menuItems = (m: { kind: 'row' | 'col'; index: number }): MenuItem[] =>
    m.kind === 'row'
      ? [{ label: 'Delete row', danger: true, onClick: () => delRow(m.index) }]
      : [
          { label: hl === m.index ? 'Remove highlight' : 'Highlight column', onClick: () => write([...columns], rows.map((r) => [...r]), hl === m.index ? null : m.index) },
          { separator: true, label: '' },
          { label: 'Delete column', danger: true, onClick: () => delCol(m.index) },
        ]

  const grip = (kind: 'row' | 'col', index: number, style: React.CSSProperties) => (
    <span
      className={'tbl-grip ' + (kind === 'col' ? 'tbl-grip-col' : 'tbl-grip-row')}
      style={style}
      title="Drag to reorder · right-click for options"
      onMouseDown={startDrag(kind, index)}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, kind, index }) }}
    >⠿</span>
  )

  return (
    <div className="tbl-wrap" ref={wrapRef} onMouseLeave={() => setHover({ row: null, col: null })}>
      <div className="dtable mat">
        <table ref={tableRef} onMouseMove={onTableMove}>
          <thead>
            <tr>
              {columns.map((_, ci) => (
                <th key={ci} className={ci === hl ? 'hl-col' : undefined}>
                  <T path={`columns.${ci}`} placeholder="Column" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((_, ci) => (
                  <td key={ci} className={ci === hl ? 'hl-col' : undefined}>
                    <T path={`rows.${ri}.${ci}`} placeholder="—" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rects && hover.col != null && rects.cols[hover.col] != null &&
        grip('col', hover.col, { left: rects.cols[hover.col], top: rects.top })}
      {rects && hover.row != null && rects.rows[hover.row] != null &&
        grip('row', hover.row, { left: rects.left, top: rects.rows[hover.row] })}

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
