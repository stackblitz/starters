import type { CSSProperties, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Reveal from '../deck/Reveal';
import { useDeck } from '../deck/DeckContext';

/* A horizontal numbered process (the "how it works" slide): mono number
   rings joined by a connector that draws in left-to-right as each step
   reveals. Stacks vertically on narrow screens (connectors hide).
   <Steps kicker="How it works" title="Three steps to live data." items={[
     { title: 'Connect', body: 'Point it at your warehouse.' }, …]} /> */
export type Step = { title: string; body?: ReactNode };

export default function Steps({
  kicker,
  title,
  items,
}: {
  kicker?: string;
  title?: string;
  items: Step[];
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
                marginBottom: 'clamp(26px,4.5vh,48px)',
              }}
            >
              {title}
            </h2>
          )}
        </Reveal>
        <div className="steps" style={{ '--n': items.length } as CSSProperties}>
          {items.map((s, i) => (
            <motion.div
              key={i}
              className="step"
              initial={animate ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.18 + i * 0.14,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="step-no-row">
                <span className="step-no">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={
                    'step-line' + (i === items.length - 1 ? ' end' : '')
                  }
                >
                  <motion.span
                    initial={animate ? { scaleX: 0 } : false}
                    animate={{ scaleX: 1 }}
                    transition={{
                      duration: 0.6,
                      delay: 0.34 + i * 0.14,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                </span>
              </div>
              <h3>{s.title}</h3>
              {s.body && <p>{s.body}</p>}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
