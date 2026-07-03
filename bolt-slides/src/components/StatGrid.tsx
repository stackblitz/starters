import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Reveal from '../deck/Reveal';
import { useDeck } from '../deck/DeckContext';

/* A full-viewport proof slide: responsive auto-fit stat cards, each with an
   accent tick and a staggered rise-in. Pass a <CountUp> as a stat `value`
   so figures animate in. */
export type Stat = { value?: ReactNode; label: string; caption?: string };

export default function StatGrid({
  kicker,
  title,
  stats,
}: {
  kicker?: string;
  title?: string;
  stats: Stat[];
  nav?: string;
  notes?: string;
}) {
  const { isStatic } = useDeck();
  const reduce = useReducedMotion();
  const animate = !isStatic && !reduce;
  return (
    <div className="slide">
      <div className="container">
        <Reveal>
          {kicker && (
            <div
              className="kicker"
              style={{ marginBottom: 10, textAlign: 'center' }}
            >
              {kicker}
            </div>
          )}
          {title && (
            <h2
              className="headline"
              style={{
                textAlign: 'center',
                marginInline: 'auto',
                marginBottom: 'clamp(24px,4vh,44px)',
              }}
            >
              {title}
            </h2>
          )}
        </Reveal>
        <div className="stat-grid">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              className="stat-cell"
              initial={animate ? { opacity: 0, y: 24 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.18 + i * 0.09,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="stat-card mat">
                <span className="tick" />
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
                {s.caption && <div className="stat-caption">{s.caption}</div>}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
