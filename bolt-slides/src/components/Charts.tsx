import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { useInView } from '../deck/useInView'

/* A small hand-built chart kit — bar, line/area, and donut. Each draws itself in
   when scrolled into view. All token-driven (one accent), no chart library.
   <BarChart data={[{label:'Mon',value:44}, …]} />
   <LineChart points={[12,18,15,26,22,34,30]} />
   <DonutChart value={72} label="Adoption" /> */

export function BarChart({ data, height = 200 }: { data: { label: string; value: number }[]; height?: number }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3)
  const max = Math.max(...data.map((d) => d.value)) || 1
  return (
    <div className="ch ch-bars" ref={ref} style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="ch-col">
          <div className="ch-bar-track">
            <motion.span className="ch-bar" initial={{ height: 0 }} animate={{ height: inView ? `${(d.value / max) * 100}%` : 0 }} transition={{ duration: 0.7, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          <div className="ch-x">{d.label}</div>
        </div>
      ))}
    </div>
  )
}

export function LineChart({ points, height = 200 }: { points: number[]; height?: number }) {
  const { ref, inView } = useInView<SVGSVGElement>(0.3)
  const w = 300, h = 120
  const max = Math.max(...points), min = Math.min(...points)
  const span = max - min || 1
  const coords = points.map((p, i) => [(i / (points.length - 1)) * w, h - ((p - min) / span) * (h - 10) - 5])
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`
  return (
    <svg ref={ref} className="ch-line" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id="ch-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity="0.34" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient>
      </defs>
      <motion.path d={area} fill="url(#ch-fill)" initial={{ opacity: 0 }} animate={{ opacity: inView ? 1 : 0 }} transition={{ duration: 0.6, delay: 0.5 }} />
      <motion.path d={line} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: inView ? 1 : 0 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} />
    </svg>
  )
}

export function DonutChart({ value, label, size = 168 }: { value: number; label?: string; size?: number }) {
  const { ref, inView } = useInView<SVGSVGElement>(0.4)
  const r = 54
  const circ = 2 * Math.PI * r
  return (
    <div className="ch-donut" style={{ '--ch-size': `${size}px` } as CSSProperties}>
      <svg ref={ref} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--hair)" strokeWidth={12} />
        <motion.circle
          cx="70" cy="70" r={r} fill="none" stroke="var(--primary)" strokeWidth={12} strokeLinecap="round"
          strokeDasharray={circ} transform="rotate(-90 70 70)"
          initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: inView ? circ * (1 - value / 100) : circ }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        <text x="70" y="70" textAnchor="middle" dominantBaseline="central" className="ch-donut-val">{value}%</text>
      </svg>
      {label && <div className="ch-donut-label">{label}</div>}
    </div>
  )
}
