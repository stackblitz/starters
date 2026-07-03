import { motion, useReducedMotion } from 'framer-motion';
import Reveal from '../deck/Reveal';
import { useDeck } from '../deck/DeckContext';

/* A people-grid slide: photo avatars (or auto-initials on the accent) with
   name + role. Cards rise in staggered; the grid wraps responsively.
   <Team kicker="The team" title="Built by operators." people={[
     { name: 'Dana Kim', role: 'CEO · ex-Stripe' },
     { name: 'Ade Obi', role: 'CTO', img: '/ade.webp' }, …]} /> */
export type Person = { name: string; role?: string; img?: string };

export default function Team({
  kicker,
  title,
  people,
}: {
  kicker?: string;
  title?: string;
  people: Person[];
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
        <div className="team">
          {people.map((p, i) => {
            const initials = p.name
              .split(/\s+/)
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            return (
              <motion.div
                key={i}
                className="person mat"
                initial={animate ? { opacity: 0, y: 22 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.16 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <span className="person-ava">
                  {p.img ? <img src={p.img} alt={p.name} /> : initials}
                </span>
                <div className="person-name">{p.name}</div>
                {p.role && <div className="person-role">{p.role}</div>}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
