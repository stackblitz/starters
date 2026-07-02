import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/* An expand/collapse accordion. Data-driven like Bento/StatGrid.
   <Accordion items={[{ title: 'Q', body: 'A' }, …]} />
   - single (default true): only one panel open at a time.
   - defaultOpen: index open on mount (null = all closed). */
export type AccordionItem = { title: string; body: ReactNode }

const Chevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export default function Accordion({
  items, single = true, defaultOpen = 0,
}: {
  items: AccordionItem[]
  single?: boolean
  defaultOpen?: number | null
}) {
  const [open, setOpen] = useState<number[]>(defaultOpen == null ? [] : [defaultOpen])
  const isOpen = (i: number) => open.includes(i)
  const toggle = (i: number) =>
    setOpen((cur) => {
      const has = cur.includes(i)
      if (single) return has ? [] : [i]
      return has ? cur.filter((x) => x !== i) : [...cur, i]
    })

  return (
    <div className="accordion">
      {items.map((it, i) => (
        <div key={i} className={'acc-item' + (isOpen(i) ? ' open' : '')}>
          <button className="acc-head" onClick={() => toggle(i)} aria-expanded={isOpen(i)}>
            <span className="acc-index">{String(i + 1).padStart(2, '0')}</span>
            <h3>{it.title}</h3>
            <span className="acc-chevron"><Chevron /></span>
          </button>
          <AnimatePresence initial={false}>
            {isOpen(i) && (
              <motion.div
                className="acc-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="acc-body-inner">{it.body}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
