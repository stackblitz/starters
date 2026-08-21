/* Present mode (/present) — the untouched premium engine (dock, thumbnail
   rail, click-builds, presenter view, annotator), fed from the database. */
import { useEffect } from 'react';
import Deck from '@/deck/Deck';
import SlideView from '@/slide/SlideView';
import { useStore } from '@/data/store';
import Gate from '@/data/Gate';
import NoDatabase from '@/data/NoDatabase';
import { applyFont, applyAccent } from '@/data/fonts';
import { stripRich } from '@/edit/rich';
import { LAYOUTS } from '@/layouts/registry';

export default function PresentApp() {
  const loaded = useStore((s) => s.loaded);
  const denied = useStore((s) => s.denied);
  const problem = useStore((s) => s.problem);
  const slides = useStore((s) => s.slides);
  const deck = useStore((s) => s.deck);
  const load = useStore((s) => s.load);
  const watch = useStore((s) => s.watch);
  const patchSlide = useStore((s) => s.patchSlide);
  const mode = useStore((s) => s.mode);

  useEffect(() => {
    load().catch(() => {
      /* the gate or the no-database screen explains why */
    });
  }, [load]);
  /* Presenting a deck someone is still editing: the slides keep up. */
  useEffect(() => watch(), [watch]);
  useEffect(() => {
    document.title = deck.title || 'Slides';
  }, [deck.title]);
  useEffect(() => {
    applyFont(deck.font);
  }, [deck.font]);
  useEffect(() => {
    applyAccent(deck.accent);
  }, [deck.accent]);

  if (problem) return <NoDatabase />;
  if (denied) return <Gate />;
  if (!loaded) return <div className="boot-screen">Loading deck…</div>;
  if (!slides.length)
    return (
      <div className="boot-screen">
        This deck has no slides yet — add some in the editor.
      </div>
    );

  return (
    <Deck
      transition={deck.transition}
      allowPresenter={mode !== 'present'}
      /* the presenter console edits the deck's real notes — the same rows the
         editor's Notes tab writes, and the only thing a presenter link may
         write */
      onNotes={(i, text) => {
        const s = slides[i];
        if (s) patchSlide(s.id, { notes: text });
      }}
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
