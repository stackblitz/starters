import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DeckCtx, type DeckCtxValue } from './DeckContext';

const THUMB_VW = 1280;
const THUMB_VH = 720;

export default function Thumb({
  children,
  ctx,
}: {
  children: ReactNode;
  ctx?: DeckCtxValue;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.15);

  useEffect(() => {
    const el = frameRef.current;

    if (!el) return;

    const update = () => {
      const fw = Math.max(1, el.clientWidth);
      const fh = Math.max(1, el.clientHeight);

      setScale(Math.min(fw / THUMB_VW, fh / THUMB_VH));
    };

    update();

    const ro = new ResizeObserver(update);

    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  return (
    <div className="noir-thumb-frame" ref={frameRef}>
      <DeckCtx.Provider value={ctx ?? { clicks: 9999, isStatic: true }}>
        <div
          className="noir-thumb-scale"
          style={{
            width: THUMB_VW,
            height: THUMB_VH,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </DeckCtx.Provider>
    </div>
  );
}
