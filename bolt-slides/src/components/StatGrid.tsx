import type { ReactNode } from 'react'
import Reveal from '../deck/Reveal'

/* A full-viewport proof slide: responsive auto-fit stat cards. Pass a
   <CountUp> as a stat `value` so figures animate in. */
export type Stat = { value?: ReactNode; label: string; caption?: string }

export default function StatGrid({ kicker, title, stats }: {
  kicker?: string; title?: string; stats: Stat[]; nav?: string; notes?: string
}) {
  return (
    <div className="slide">
      <div className="container">
        <Reveal>
          {kicker && <div className="kicker" style={{ marginBottom: 10, textAlign: 'center' }}>{kicker}</div>}
          {title && <h2 className="headline" style={{ textAlign: 'center', marginInline: 'auto', marginBottom: 'clamp(24px,4vh,44px)' }}>{title}</h2>}
        </Reveal>
        <Reveal className="stat-grid" y={36}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
              {s.caption && <div className="stat-caption">{s.caption}</div>}
            </div>
          ))}
        </Reveal>
      </div>
    </div>
  )
}
