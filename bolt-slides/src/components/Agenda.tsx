import { motion, useReducedMotion } from 'framer-motion';
import Reveal from '../deck/Reveal';
import { useDeck } from '../deck/DeckContext';

/* A table-of-contents slide: hairline-ruled rows with mono accent numbers.
   Pass strings, or { title, hint } for a right-aligned hint (a time, a slide
   count, an owner). Rows cascade in; the block self-centers.
   <Agenda kicker="Agenda" title="What we'll cover." items={['Problem', 'Solution',
     { title: 'The ask', hint: '5 min' }]} /> */
export type AgendaItem = string | { title: string; hint?: string };

export default function Agenda({
  kicker,
  title,
  items,
}: {
  kicker?: string;
  title?: string;
  items: AgendaItem[];
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
                marginBottom: 'clamp(24px,4vh,40px)',
              }}
            >
              {title}
            </h2>
          )}
        </Reveal>
        <div className="agenda">
          {items.map((it, i) => {
            const item = typeof it === 'string' ? { title: it } : it;
            return (
              <motion.div
                key={i}
                className="agenda-row"
                initial={animate ? { opacity: 0, x: -16 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.15 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <span className="agenda-no">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="agenda-t">{item.title}</span>
                {item.hint && <span className="agenda-hint">{item.hint}</span>}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
