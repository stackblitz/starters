import { useRef, type ReactNode } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from 'framer-motion';
import { useDeck } from '../deck/DeckContext';

/* Mouse-tracked 3D tilt + glare, smoothed with springs. The pointer is
   measured against a STATIC outer frame — never the tilting element itself —
   so the tilt can't feed back into its own hit-box and wobble. Wrap ONE hero
   visual per slide. Flat in thumbnails and under reduced motion. */
export default function TiltCard({ children }: { children: ReactNode }) {
  const { isStatic } = useDeck();
  const reduce = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 260, damping: 26, mass: 0.5 });
  const sry = useSpring(ry, { stiffness: 260, damping: 26, mass: 0.5 });

  if (isStatic || reduce) {
    return (
      <div className="tilt-frame">
        <div className="tilt">
          {children}
          <span className="tilt-glare" />
        </div>
      </div>
    );
  }

  function move(e: React.MouseEvent) {
    const el = frameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rx.set(-py * 7);
    ry.set(px * 10);
    el.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
  }
  function leave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <div
      ref={frameRef}
      className="tilt-frame"
      onMouseMove={move}
      onMouseLeave={leave}
    >
      <motion.div className="tilt" style={{ rotateX: srx, rotateY: sry }}>
        {children}
        <span className="tilt-glare" />
      </motion.div>
    </div>
  );
}
