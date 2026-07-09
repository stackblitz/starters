import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { useDeck } from './DeckContext';

/* Entrance animation: content rises + fades in when its slide becomes active
   (on mount). Wrap a headline, a grid, a card. Static in thumbnails. */
export default function Reveal({
  children,
  y = 26,
  delay = 0,
  className,
  style,
}: {
  children: ReactNode;
  y?: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const { isStatic } = useDeck();
  if (isStatic)
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
