import { useEffect, useRef, useState } from 'react';
import { useDeck } from './DeckContext';

export function useInView<T extends Element>(threshold = 0.3) {
  const { isStatic } = useDeck();
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(isStatic);

  useEffect(() => {
    if (isStatic) {
      setInView(true);
      return;
    }

    const el = ref.current;

    if (!el) return;

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setInView(true);
        }),
      { threshold }
    );

    io.observe(el);

    return () => io.disconnect();
  }, [isStatic, threshold]);

  return { ref, inView };
}
