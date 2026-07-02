import { useEffect, useRef, useState } from 'react'
import { useDeck } from '../deck/DeckContext'

/* A number that animates 0 → to when its slide becomes active. Inherits color,
   so inside a .figure / .stat-value it picks up the accent gradient. Renders
   the final value instantly in thumbnails. */
export default function CountUp({
  to, from = 0, duration = 1500, decimals = 0, prefix = '', suffix = '',
}: {
  to: number; from?: number; duration?: number; decimals?: number; prefix?: string; suffix?: string
}) {
  const { isStatic } = useDeck()
  const ref = useRef<HTMLSpanElement>(null)
  const [val, setVal] = useState(isStatic ? to : from)
  const started = useRef(false)

  useEffect(() => {
    if (isStatic) { setVal(to); return }
    const el = ref.current
    if (!el) return
    let raf = 0
    const run = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(to); return }
      const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration)
        setVal(from + (to - from) * (1 - Math.pow(1 - p, 3)))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting && !started.current) { started.current = true; run() } }),
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [isStatic, to, from, duration])

  const text = prefix + val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix
  return <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>{text}</span>
}
