import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/* Tabbed content with a sliding accent pill (framer layoutId) and a cross-fade
   between panels. <Tabs tabs={[{ label: 'Overview', content: <…/> }, …]} /> */
export type Tab = { label: string; content: ReactNode }

export default function Tabs({ tabs, defaultTab = 0 }: { tabs: Tab[]; defaultTab?: number }) {
  const [active, setActive] = useState(defaultTab)
  return (
    <div className="tabs">
      <div className="tabs-bar" role="tablist">
        {tabs.map((t, i) => (
          <button key={i} className={'tab' + (i === active ? ' on' : '')} onClick={() => setActive(i)} role="tab" aria-selected={i === active}>
            {i === active && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="tabs-panel">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {tabs[active].content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
