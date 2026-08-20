import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DeckCtx, type DeckCtxValue } from './DeckContext';

/* A slide rendered at true viewport size, then scaled into whatever box it is
   given — so responsive vw/vh units stay faithful instead of reflowing into a
   tiny layout. Used by the overview panel, the grid and the presenter console.

   `ctx` decides what it shows: the default is a static, fully-revealed slide
   (thumbnails); pass the deck's LIVE context to mirror exactly what the
   audience sees right now, builds and all. */
export default function Thumb({
  children,
  ctx,
}: {
  children: ReactNode;
  ctx?: DeckCtxValue;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [d, setD] = useState({ vw: 1280, vh: 720, scale: 0.15 });
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () =>
      setD({
        vw: window.innerWidth,
        vh: window.innerHeight,
        scale: el.clientWidth / window.innerWidth,
      });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
  return (
    <div
      className="noir-thumb-frame"
      ref={frameRef}
      style={{ aspectRatio: `${d.vw} / ${d.vh}` }}
    >
      <DeckCtx.Provider value={ctx ?? { clicks: 9999, isStatic: true }}>
        <div
          className="noir-thumb-scale"
          style={{ width: d.vw, height: d.vh, transform: `scale(${d.scale})` }}
        >
          {children}
        </div>
      </DeckCtx.Provider>
    </div>
  );
}
