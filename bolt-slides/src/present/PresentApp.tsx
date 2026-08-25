/* Present mode — full-screen engine. Opened in-place from the editor (no
   URL change), at `/` on the published origin (audience deck), or at
   /present for presenter-console and leftover present share links. */
import { useEffect } from 'react';
import Deck from '../deck/Deck';
import SlideView from '../slide/SlideView';
import { useStore } from '../data/store';
import { useDeckSync } from '../data/useDeckSync';
import Gate from '../data/Gate';
import { applyFont, applyAccent } from '../data/fonts';
import { stripRich } from '../edit/rich';
import { LAYOUTS } from '../layouts/registry';

export default function PresentApp({
  embedded,
  onExit,
}: {
  embedded?: boolean;
  onExit?: (slideIndex: number) => void;
}) {
  const loaded = useStore((s) => s.loaded);
  const denied = useStore((s) => s.denied);
  const bootError = useStore((s) => s.bootError);
  const slides = useStore((s) => s.slides);
  const deck = useStore((s) => s.deck);
  const patchSlide = useStore((s) => s.patchSlide);
  const mode = useStore((s) => s.mode);
  const current = useStore((s) => s.current);

  useDeckSync({ enabled: !embedded });
  useEffect(() => {
    document.title = deck.title || 'Slides';
  }, [deck.title]);
  useEffect(() => {
    applyFont(deck.font);
  }, [deck.font]);
  useEffect(() => {
    applyAccent(deck.accent);
  }, [deck.accent]);

  if (denied) return <Gate />;
  if (bootError) return <div className="boot-screen">{bootError}</div>;
  if (!loaded) return <div className="boot-screen">Loading deck…</div>;
  if (!slides.length)
    return (
      <div className="boot-screen">
        This deck has no slides yet — add some in the editor.
        {onExit && (
          <button
            type="button"
            className="ghost-btn"
            style={{ marginTop: 16 }}
            onClick={() => onExit(0)}
          >
            Back to editor
          </button>
        )}
      </div>
    );

  return (
    <Deck
      transition={deck.transition}
      allowPresenter={mode !== 'present'}
      initialSlide={embedded && onExit ? current : undefined}
      onExit={onExit}
      /* notes writes are owner / edit / presenter only — present-share
         must not PATCH even if someone mounts the console */
      onNotes={
        mode === 'present'
          ? undefined
          : (i, text) => {
              const s = slides[i];
              if (s) patchSlide(s.id, { notes: text });
            }
      }
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
          : LAYOUTS[s.layout]?.label;
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
