import type { CSSProperties, ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Reveal from '../deck/Reveal';
import { useDeck } from '../deck/DeckContext';

export type BentoTile = {
  k?: string;
  fig?: ReactNode;
  title?: string;
  body?: string;
  c?: number;
  r?: number;
  variant?: 'accent' | 'glow';
  img?: string;
};

export default function Bento({
  kicker,
  title,
  tiles,
}: {
  kicker?: string;
  title?: string;
  tiles: BentoTile[];
}) {
  const { isStatic } = useDeck();
  const reduce = useReducedMotion();
  const animate = !isStatic && !reduce;

  return (
    <div className="slide">
      <div className="container">
        <Reveal>
          {kicker && (
            <div className="kicker" style={{ marginBottom: 10 }}>
              {kicker}
            </div>
          )}
          {title && (
            <h2
              className="headline"
              style={{ marginBottom: 'clamp(20px,3vh,34px)', maxWidth: '24ch' }}
            >
              {title}
            </h2>
          )}
        </Reveal>
        <div className="bento">
          {tiles.map((t, i) => (
            <motion.div
              key={i}
              className="bento-cell"
              style={{ '--c': t.c ?? 4, '--r': t.r ?? 1 } as CSSProperties}
              initial={animate ? { opacity: 0, y: 26, scale: 0.985 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.55,
                delay: 0.16 + i * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div
                className={
                  'btile mat' +
                  (t.variant ? ` ${t.variant}` : '') +
                  (t.img ? ' has-img' : '')
                }
              >
                {t.img && (
                  <>
                    <img className="btile-img" src={t.img} alt="" aria-hidden />
                    <span className="btile-scrim" aria-hidden />
                  </>
                )}
                {(t.k || t.fig != null) && !t.img && (
                  <div className="btile-head">
                    {t.fig != null && <span className="tick" />}
                    {t.k && <div className="btile-k">{t.k}</div>}
                  </div>
                )}
                <div>
                  {t.img && t.k && (
                    <div className="btile-k" style={{ marginBottom: 6 }}>
                      {t.k}
                    </div>
                  )}
                  {t.fig != null && (
                    <div
                      className={
                        'btile-fig' + (t.variant === 'accent' ? '' : ' grad')
                      }
                    >
                      {t.fig}
                    </div>
                  )}
                  {t.title && <h3>{t.title}</h3>}
                  {t.body && <p>{t.body}</p>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
