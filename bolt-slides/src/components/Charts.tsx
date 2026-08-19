import { useEffect, useId, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useInView } from '../deck/useInView'
import { useDeck } from '../deck/DeckContext'

/* A small hand-built chart kit — bar, line/area, and donut. Each draws itself
   in when scrolled into view. All token-driven (one accent), no chart library.
   <BarChart data={[{label:'Mon',value:44}, …]} />       (values label the bars)
   <LineChart points={[12,18,15,26,22,34,30]} />         (gridlines + live end-dot)
   <DonutChart value={72} label="Adoption" />            (the number counts up) */

export function BarChart({ data, height = 200, showValues = true }: {
  /** valueNode overrides how the figure above a bar renders (math still uses value) */
  data: { label: string; value: number; valueNode?: React.ReactNode }[]; height?: number; showValues?: boolean
}) {
  const { isStatic } = useDeck()
  const reduce = useReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>(0.3)
  const animate = !isStatic && !reduce
  const max = Math.max(...data.map((d) => d.value)) || 1
  return (
    <div className="ch ch-bars" ref={ref} style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="ch-col">
          {showValues && (
            <motion.div
              className="ch-val"
              initial={animate ? { opacity: 0, y: 6 } : false}
              animate={inView ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.4, delay: 0.45 + i * 0.06 }}
            >
              {d.valueNode ?? d.value.toLocaleString('en-US')}
            </motion.div>
          )}
          <div className="ch-bar-track">
            <motion.span
              className="ch-bar"
              initial={animate ? { height: 0 } : false}
              animate={{ height: inView ? `${(d.value / max) * 100}%` : 0 }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="ch-x">{d.label}</div>
        </div>
      ))}
    </div>
  )
}

export function LineChart({ points: rawPoints, height = 200, showValues = false, large = false }: { points: number[]; height?: number; showValues?: boolean; large?: boolean }) {
  const points = rawPoints.length >= 2 ? rawPoints : rawPoints.length === 1 ? [rawPoints[0], rawPoints[0]] : [0, 0]
  const { isStatic } = useDeck()
  const reduce = useReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>(0.3)
  const gid = useId()
  const animate = !isStatic && !reduce
  const w = 300, h = 120
  const max = Math.max(...points), min = Math.min(...points)
  const span = max - min || 1
  const coords = points.map((p, i) => [(i / (points.length - 1)) * w, h - ((p - min) / span) * (h - 10) - 5])
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`
  const [ex, ey] = coords[coords.length - 1]
  return (
    <div className="ch-wrap" ref={ref}>
      <svg className="ch-line" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* horizontal gridlines — crisp regardless of the non-uniform scale */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={w} y1={5 + (h - 10) * f} y2={5 + (h - 10) * f} stroke="var(--hair-2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <line x1="0" x2={w} y1={h - 0.5} y2={h - 0.5} stroke="var(--hair)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <motion.path
          d={area} fill={`url(#${gid})`}
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: inView ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        />
        {/* no vectorEffect here: non-scaling-stroke breaks the pathLength
            draw-in under a stretched viewBox (the dash ends before the path
            does and the stroke stops short of its end-point) */}
        <motion.path
          d={line} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          initial={animate ? { pathLength: 0 } : false}
          animate={{ pathLength: inView ? 1 : 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      {showValues && coords.map((c, i) => (
        <span
          key={i}
          className={'ch-pt-val' + (inView ? ' shown' : '')}
          style={{ left: `${(c[0] / w) * 100}%`, top: `${(c[1] / h) * 100}%`, transitionDelay: `${0.3 + i * 0.05}s` }}
        >
          {points[i].toLocaleString('en-US')}
        </span>
      ))}
      {/* the live end-point — a glowing dot with a radar pulse */}
      <span
        className={'ch-dot' + (large ? ' lg' : '') + (inView ? ' shown' : '')}
        style={{ left: `${(ex / w) * 100}%`, top: `${(ey / h) * 100}%` }}
        aria-hidden
      />
    </div>
  )
}

export function DonutChart({ value, label, size = 168 }: { value: number; label?: string; size?: number }) {
  const { isStatic } = useDeck()
  const reduce = useReducedMotion()
  const { ref, inView } = useInView<SVGSVGElement>(0.4)
  const [shown, setShown] = useState(isStatic ? value : 0)
  const r = 54
  const circ = 2 * Math.PI * r

  useEffect(() => {
    if (isStatic || !inView) return
    if (reduce) { setShown(value); return }
    let raf = 0
    const t0 = performance.now()
    const dur = 1100
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      setShown(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isStatic, inView, value, reduce])

  return (
    <div className="ch-donut" style={{ '--ch-size': `${size}px` } as CSSProperties}>
      <svg ref={ref} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--hair)" strokeWidth={12} />
        <motion.circle
          className="ch-donut-arc"
          cx="70" cy="70" r={r} fill="none" stroke="var(--primary)" strokeWidth={12} strokeLinecap="round"
          strokeDasharray={circ} transform="rotate(-90 70 70)"
          initial={isStatic || reduce ? false : { strokeDashoffset: circ }}
          animate={{ strokeDashoffset: inView ? circ * (1 - value / 100) : circ }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        <text x="70" y="70" textAnchor="middle" dominantBaseline="central" className="ch-donut-val">{Math.round(shown)}%</text>
      </svg>
      {label && <div className="ch-donut-label">{label}</div>}
    </div>
  )
}

/* Grouped bars — multi-series comparison with a y-axis and legend.
   <GroupedBarChart categories={['Q1','Q2']} series={[{label:'2024',values:[10,20]},…]} />
   Token-driven: first series takes the accent, later ones step down in ink. */
export const SERIES_COLORS = [
  'var(--primary)',
  'color-mix(in srgb, var(--primary) 45%, var(--fg-muted))',
  'color-mix(in srgb, var(--fg-muted) 60%, transparent)',
]

export function GroupedBarChart({ categories, series, height = 240, showValues = false }: {
  categories: React.ReactNode[]
  series: { label: React.ReactNode; values: number[] }[]
  height?: number
  showValues?: boolean
}) {
  const { isStatic } = useDeck()
  const reduce = useReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>(0.3)
  const animate = !isStatic && !reduce
  const max = Math.max(...series.flatMap((s) => s.values), 1)
  // 4 tidy ticks
  const step = Math.pow(10, Math.floor(Math.log10(max / 4 || 1)))
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * step).find((u) => u * 4 >= max) ?? step
  const top = unit * 4
  const ticks = [4, 3, 2, 1]
  return (
    <div className="gch" ref={ref}>
      <div className="gch-legend">
        {series.map((s, i) => (
          <span key={i} className="gch-key">
            <i style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="gch-plot" style={{ height }}>
        <div className="gch-axis">
          {ticks.map((t) => (
            <span key={t} className="gch-tick" style={{ bottom: `${(t / 4) * 100}%` }}>
              {(unit * t) % 1 === 0 ? unit * t : (unit * t).toFixed(1)}
            </span>
          ))}
        </div>
        <div className="gch-area">
          {ticks.map((t) => (
            <span key={t} className="gch-grid" style={{ bottom: `${(t / 4) * 100}%` }} />
          ))}
          <div className="gch-groups">
            {categories.map((c, ci) => (
              <div key={ci} className="gch-group">
                <div className="gch-bars">
                  {series.map((s, si) => (
                    <div key={si} className="gch-barwrap">
                      {showValues && (
                        <motion.span
                          className="gch-val"
                          initial={animate ? { opacity: 0 } : false}
                          animate={{ opacity: inView ? 1 : 0 }}
                          transition={{ duration: 0.4, delay: 0.5 + ci * 0.06 + si * 0.04 }}
                        >
                          {(s.values[ci] ?? 0).toLocaleString('en-US')}
                        </motion.span>
                      )}
                      <motion.span
                        className="gch-bar"
                        style={{ background: SERIES_COLORS[si % SERIES_COLORS.length] }}
                        initial={animate ? { height: 0 } : false}
                        animate={{ height: inView ? `${((s.values[ci] ?? 0) / top) * 100}%` : 0 }}
                        transition={{ duration: 0.7, delay: ci * 0.06 + si * 0.04, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  ))}
                </div>
                <div className="gch-x">{c}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
