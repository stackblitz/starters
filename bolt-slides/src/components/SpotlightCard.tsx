import { useRef, type ReactNode } from 'react';

/* A card with a cursor-following accent treatment (the Linear/Vercel hover):
   a soft interior bloom AND a border ring that lights up around the pointer.
   Wrap content; it provides the card shell + padding.
   <SpotlightCard><div className="kicker">…</div><h3>…</h3><p>…</p></SpotlightCard> */
export default function SpotlightCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  function move(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }
  return (
    <div ref={ref} className="spot mat" onMouseMove={move}>
      {children}
      <span className="spot-ring" aria-hidden />
    </div>
  );
}
