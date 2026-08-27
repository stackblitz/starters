/* Present mode — full-screen engine. Opened in-place from the studio (no
   URL change), at `/` on the published origin (audience deck), or at
   /present?presenter=1 for the presenter console. Dock P on the audience
   chrome opens the published bolt.host console when one exists. */
import { useEffect } from 'react';
import Deck from '../deck/Deck';
import SlideView from '../slide/SlideView';
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
  const loaded = useStore((s) => s.loaded);
  const bootError = useStore((s) => s.bootError);
  const slides = useStore((s) => s.slides);
  const deck = useStore((s) => s.deck);
  const current = useStore((s) => s.current);

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
      transition={deck.transition}
      initialSlide={embedded && onExit ? current : undefined}
      onExit={onExit}
      navLabel={(i) => {
        const s = slides[i];
        if (!s) return undefined;
        const raw =
          s.props?.title ?? s.props?.text ?? s.props?.value ?? s.props?.name;
        const plain =
          typeof raw === 'string'
            ? stripRich(raw).replace(/\s+/g, ' ').trim()
            : '';
        return plain
          ? plain.length > 52
            ? plain.slice(0, 52) + '…'
            : plain
          : LAYOUTS[resolveLayoutType(s.layout)]?.label;
      }}
    >
      {slides.map((s) => (
        <SlideView
          key={s.id}
          slide={s}
          notes={s.notes}
          transition={s.transition ?? undefined}
        />
      ))}
    </Deck>
  );
}
