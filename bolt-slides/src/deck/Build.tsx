import { motion } from 'framer-motion';
import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useDeck } from './DeckContext';

/* Click-build (the Slidev "v-click"): this element stays hidden until the
   presenter advances to step `at` (1-based) on the current slide, then it
   animates in. Reveal content in beats: <Build at={1}>…</Build>. The deck
   advances builds before moving to the next slide. */
export default function Build({
  at = 1,
  y = 16,
  children,
  className,
  style,
}: {
  at?: number;
  y?: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const { clicks, isStatic, registerMax } = useDeck();
  useEffect(() => {
    registerMax?.(at);
  }, [at, registerMax]);

  if (isStatic)
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );

  const shown = clicks >= at;
  return (
    <motion.div
      className={className}
      style={{ ...style, pointerEvents: shown ? 'auto' : 'none' }}
      initial={false}
      animate={{
        opacity: shown ? 1 : 0,
        y: shown ? 0 : y,
        filter: shown ? 'blur(0px)' : 'blur(3px)',
      }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
