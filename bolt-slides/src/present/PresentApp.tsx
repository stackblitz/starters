/* Present mode — full-screen engine. Opened in-place from the studio (no
   URL change), at `/` on the published origin (audience deck), or at
   /present?presenter=1 for the presenter console. Dock P opens the
   console in a new tab on the current origin. */
import { useEffect } from 'react';
import Deck from '../deck/Deck';
import { useStore } from '../data/store';
import { applyFont, applyAccent } from '../data/fonts';
import { stripRich } from '../edit/rich';
import { LAYOUTS, resolveLayoutType } from '../layouts/registry';

export default function PresentApp({
  embedded,
  onExit,
}: {
  embedded?: boolean;
  onExit?: (slideIndex: number) => void;
}) {
  const loaded = useStore((state) => state.loaded);
  const bootError = useStore((state) => state.bootError);
  const slides = useStore((state) => state.slides);
  const deck = useStore((state) => state.deck);
  const current = useStore((state) => state.current);

  useEffect(() => {
    document.title = deck.title || 'Slides';
  }, [deck.title]);
  useEffect(() => {
    applyFont(deck.font);
  }, [deck.font]);
  useEffect(() => {
    applyAccent(deck.accent);
  }, [deck.accent]);

  if (bootError) return <div className="boot-screen">{bootError}</div>;
  if (!loaded) return <div className="boot-screen">Loading deck…</div>;
  if (!slides.length)
    return (
      <div className="boot-screen">
        This deck has no slides.
        {onExit && (
          <button
            type="button"
            className="ghost-btn"
            style={{ marginTop: 16 }}
            onClick={() => onExit(0)}
          >
            Back to studio
          </button>
        )}
      </div>
    );

  return (
    <Deck
      slides={slides}
      transition={deck.transition}
      initialSlide={embedded && onExit ? current : undefined}
      onExit={onExit}
      navLabel={(index) => {
        const slide = slides[index];
        if (!slide) return undefined;
        const raw =
          slide.props?.title ??
          slide.props?.text ??
          slide.props?.value ??
          slide.props?.name;
        const plain =
          typeof raw === 'string'
            ? stripRich(raw).replace(/\s+/g, ' ').trim()
            : '';
        return plain
          ? plain.length > 52
            ? plain.slice(0, 52) + '…'
            : plain
          : LAYOUTS[resolveLayoutType(slide.layout)]?.label;
      }}
    />
  );
}
