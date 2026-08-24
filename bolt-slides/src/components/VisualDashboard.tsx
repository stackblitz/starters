import { useEffect, useRef, useState } from 'react';
import CountUp from './CountUp';
import { useDeck } from '../deck/DeckContext';

/* Example analytics visual (a self-drawing dashboard mock): KPI cards with
   live sparklines, a gridded area chart, and a weekly bar row. ONLY use it
   when the deck is genuinely about data — otherwise build a topic-fit visual
   in the same .vframe shell. Draws in when its slide becomes active. */
const bars = [44, 62, 55, 78, 96, 70, 58];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const kpis = [
  {
    l: 'Revenue',
    v: <CountUp to={1.24} decimals={2} prefix="$" suffix="M" />,
    d: '▲ 18.2%',
    spark: 'M1,14 L9,11 L17,12.5 L25,8 L33,9.5 L41,5 L49,3',
  },
  {
    l: 'Active users',
    v: <CountUp to={48210} />,
    d: '▲ 9.4%',
    spark: 'M1,15 L9,13 L17,14 L25,10 L33,11.5 L41,7 L49,4.5',
  },
  {
    l: 'Churn',
    v: <CountUp to={1.9} decimals={1} suffix="%" />,
    d: '▼ 0.6%',
    spark: 'M1,4 L9,6 L17,5 L25,9 L33,8 L41,12 L49,14',
  },
];

export default function VisualDashboard() {
  const { isStatic } = useDeck();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(isStatic);

  useEffect(() => {
    if (isStatic) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setShown(true);
        }),
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isStatic]);

  return (
    <div
      ref={ref}
      className={'vframe mat' + (shown ? ' shown' : '')}
      style={{ width: 470, maxWidth: '100%' }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          className="vtitle"
          style={{ display: 'flex', gap: 9, alignItems: 'center' }}
        >
          <span className="ddot" />
          Overview <span className="vmeta">· Last 30 days</span>
        </div>
        <div className="dlive">
          <span />
          Live
        </div>
      </div>
      <div className="dkpis">
        {kpis.map((k) => (
          <div key={k.l} className="dkpi">
            <div className="dkpi-l">{k.l}</div>
            <div className="dkpi-v">{k.v}</div>
            <div className="dkpi-row">
              <div className="dkpi-d">{k.d}</div>
              <svg className="dspark" viewBox="0 0 50 18" aria-hidden>
                <path
                  pathLength={1}
                  d={k.spark}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        ))}
      </div>
      <svg
        viewBox="0 0 420 150"
        preserveAspectRatio="none"
        style={{ width: '100%', height: 108, display: 'block' }}
      >
        <defs>
          <linearGradient id="dfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[38, 76, 114].map((y) => (
          <line
            key={y}
            className="dgrid"
            x1="0"
            x2="420"
            y1={y}
            y2={y}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          className="dfill-area"
          d="M0,118 L35,108 L70,114 L105,86 L140,94 L175,66 L210,74 L245,48 L280,56 L315,32 L350,40 L385,18 L420,24 L420,150 L0,150 Z"
          fill="url(#dfill)"
        />
        {/* no vectorEffect: it breaks the dash-based draw-in (stroke stops short) */}
        <path
          className="dline"
          pathLength={1}
          d="M0,118 L35,108 L70,114 L105,86 L140,94 L175,66 L210,74 L245,48 L280,56 L315,32 L350,40 L385,18 L420,24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="dbars">
        {bars.map((h, i) => (
          <div key={i} className="dbar">
            <div className="dbar-track">
              <span
                style={{ height: `${h}%`, animationDelay: `${i * 0.06}s` }}
              />
            </div>
            <div className="dbar-k">{days[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
