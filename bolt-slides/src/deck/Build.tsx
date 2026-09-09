import { motion } from 'motion/react';
import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useDeck } from './DeckContext';

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
