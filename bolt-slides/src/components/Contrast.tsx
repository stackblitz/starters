import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Reveal from '../deck/Reveal';
import { useDeck } from '../deck/DeckContext';

/* The before/after (problem → solution) slide: a muted panel against an
   accent-lit panel. Left points get faint crosses, right points get accent
   checks; the lit panel lands second, with the glow.
   <Contrast kicker="The shift" title="Stop digging. Start asking."
     left={{ label: 'Before', title: 'Dashboard sprawl', points: ['…'] }}
     right={{ label: 'With Acme', title: 'Answers on tap', points: ['…'] }} /> */
export type ContrastPanel = {
  label?: string;
  title?: string;
  points: ReactNode[];
};

const Cross = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 7l10 10M17 7L7 17" />
  </svg>
);
const Check = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12.5l4.5 4.5L19 6.5" />
  </svg>
);

export default function Contrast({
  kicker,
  title,
  left,
  right,
}: {
  kicker?: string;
  title?: string;
  left: ContrastPanel;
  right: ContrastPanel;
  nav?: string;
  notes?: string;
}) {
  const { isStatic } = useDeck();
  const reduce = useReducedMotion();
  const animate = !isStatic && !reduce;
  const panel = (p: ContrastPanel, lit: boolean, i: number) => (
    <motion.div
      className={'con-panel mat ' + (lit ? 'lit' : 'dim')}
      initial={animate ? { opacity: 0, y: 24 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.55,
        delay: 0.18 + i * 0.14,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {p.label && (
        <span className={'chip' + (lit ? '' : ' dim')}>{p.label}</span>
      )}
      {p.title && <h3>{p.title}</h3>}
      <div className="con-points">
        {p.points.map((pt, pi) => (
          <div key={pi} className="con-point">
            {lit ? <Check /> : <Cross />}
            <span>{pt}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
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
                marginBottom: 'clamp(26px,4.5vh,46px)',
              }}
            >
              {title}
            </h2>
          )}
        </Reveal>
        <div className="contrast">
          {panel(left, false, 0)}
          {panel(right, true, 1)}
        </div>
      </div>
    </div>
  );
}
