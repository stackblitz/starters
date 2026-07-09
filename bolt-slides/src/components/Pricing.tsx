import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Reveal from '../deck/Reveal';
import { useDeck } from '../deck/DeckContext';

/* A pricing slide: 2–4 tier cards, one highlighted with an accent badge.
   Feature lists get accent checks; cards rise in staggered.
   <Pricing kicker="Pricing" title="Simple, honest plans." tiers={[
     { name: 'Starter', price: '$29', period: '/mo', features: ['…'] },
     { name: 'Pro', price: '$79', period: '/mo', features: ['…'], highlight: true, badge: 'Most popular' },
   ]} /> */
export type Tier = {
  name: string;
  price: string;
  period?: string;
  blurb?: string;
  features?: string[];
  highlight?: boolean;
  badge?: string;
};

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

export default function Pricing({
  kicker,
  title,
  tiers,
}: {
  kicker?: string;
  title?: string;
  tiers: Tier[];
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
                marginBottom: 'clamp(26px,4.5vh,46px)',
              }}
            >
              {title}
            </h2>
          )}
        </Reveal>
        <div
          className="pricing"
          style={{ '--tiers': tiers.length } as CSSProperties}
        >
          {tiers.map((t, i) => (
            <motion.div
              key={i}
              className={'tier mat' + (t.highlight ? ' hl' : '')}
              initial={animate ? { opacity: 0, y: 24 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.16 + i * 0.09,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {t.highlight && (
                <span className="tier-badge">{t.badge ?? 'Most popular'}</span>
              )}
              <div className="tier-name">{t.name}</div>
              <div className="tier-price">
                <span className="tier-amount">{t.price}</span>
                {t.period && <span className="tier-period">{t.period}</span>}
              </div>
              {t.blurb && <div className="tier-blurb">{t.blurb}</div>}
              {t.features && t.features.length > 0 && (
                <div className="tier-list">
                  {t.features.map((f, fi) => (
                    <div key={fi} className="tier-feat">
                      <Check />
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
