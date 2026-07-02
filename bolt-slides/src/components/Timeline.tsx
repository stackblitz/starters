import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useInView } from '../deck/useInView'

/* A vertical timeline / roadmap. The connector line draws in and milestones
   reveal in sequence when scrolled into view.
   <Timeline items={[{ time: 'Q1', title: 'Launch', body: '…' }, …]} /> */
export type TimelineItem = { time: string; title: string; body?: ReactNode }

export default function Timeline({ items }: { items: TimelineItem[] }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2)
  return (
    <div className="tl" ref={ref}>
      <div className="tl-line">
        <motion.span className="tl-line-fill" initial={{ scaleY: 0 }} animate={{ scaleY: inView ? 1 : 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
      </div>
      <div className="tl-items">
        {items.map((it, i) => (
          <motion.div
            key={i}
            className="tl-item"
            initial={{ opacity: 0, x: -14 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -14 }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="tl-dot" />
            <div className="tl-content">
              <div className="tl-time">{it.time}</div>
              <h3>{it.title}</h3>
              {it.body && <p>{it.body}</p>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
