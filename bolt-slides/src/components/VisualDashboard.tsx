import { useEffect, useRef, useState } from 'react'
import CountUp from './CountUp'
import { useDeck } from '../deck/DeckContext'

/* Example analytics visual (a self-drawing dashboard mock). ONLY use it when
   the deck is genuinely about data — otherwise build a topic-fit visual in the
   same .vframe shell. Draws in when its slide becomes active. */
const bars = [44, 62, 55, 78, 96, 70, 58]
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function VisualDashboard() {
  const { isStatic } = useDeck()
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(isStatic)

  useEffect(() => {
    if (isStatic) { setShown(true); return }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setShown(true) }),
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [isStatic])

  return (
    <div ref={ref} className={'vframe' + (shown ? ' shown' : '')} style={{ width: 470, maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className="vtitle" style={{ display: 'flex', gap: 9, alignItems: 'center' }}><span className="ddot" />Overview <span className="vmeta">· Last 30 days</span></div>
        <div className="dlive"><span />Live</div>
      </div>
      <div className="dkpis">
        <div className="dkpi"><div className="dkpi-l">Revenue</div><div className="dkpi-v"><CountUp to={1.24} decimals={2} prefix="$" suffix="M" /></div><div className="dkpi-d">▲ 18.2%</div></div>
        <div className="dkpi"><div className="dkpi-l">Active users</div><div className="dkpi-v"><CountUp to={48210} /></div><div className="dkpi-d">▲ 9.4%</div></div>
        <div className="dkpi"><div className="dkpi-l">Churn</div><div className="dkpi-v"><CountUp to={1.9} decimals={1} suffix="%" /></div><div className="dkpi-d">▼ 0.6%</div></div>
      </div>
      <svg viewBox="0 0 420 150" preserveAspectRatio="none" style={{ width: '100%', height: 112, display: 'block' }}>
        <defs>
          <linearGradient id="dfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient>
        </defs>
        <path className="dfill-area" d="M0,118 L35,108 L70,114 L105,86 L140,94 L175,66 L210,74 L245,48 L280,56 L315,32 L350,40 L385,18 L420,24 L420,150 L0,150 Z" fill="url(#dfill)" />
        <path className="dline" pathLength={1} d="M0,118 L35,108 L70,114 L105,86 L140,94 L175,66 L210,74 L245,48 L280,56 L315,32 L350,40 L385,18 L420,24" fill="none" stroke="var(--primary)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="dbars">
        {bars.map((h, i) => (
          <div key={i} className="dbar"><div className="dbar-track"><span style={{ height: `${h}%`, animationDelay: `${i * 0.06}s` }} /></div><div className="dbar-k">{days[i]}</div></div>
        ))}
      </div>
    </div>
  )
}
