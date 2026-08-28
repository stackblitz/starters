/* Studio canvas — the current slide at presentation size, scaled to fit.
   The slide renders LIVE (count-ups, staggers, the slide's animation mode
   all play, like in present mode). The shared dock pages the deck and
   carries speaker notes, Present, Presenter, and Export as… */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore, serializeDeck } from '../data/store';
import { DeckCtx } from '../deck/DeckContext';
import Dock from '../deck/Dock';
import type { BrowseMode } from '../deck/SlideBrowser';
import SlideView from '../slide/SlideView';
import { NotesEditor } from './notes';
import { exportPdf } from '../export/exporter';
import type { MenuButtonItem } from './MenuButton';

function downloadJson(title: string) {
  const file = serializeDeck();
  const blob = new Blob([JSON.stringify(file, null, 2) + '\n'], {
    type: 'application/json',
  });
  const anchor = document.createElement('a');
  const name = (title || 'deck').replace(/[^\w\- ]+/g, '').trim() || 'deck';
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${name}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export default function Canvas({
  browse,
  onToggleRail,
  onToggleGrid,
  onCloseBrowse,
}: {
  browse: BrowseMode;
  onToggleRail: () => void;
  onToggleGrid: () => void;
  onCloseBrowse: () => void;
}) {
  const slides = useStore((state) => state.slides);
  const current = useStore((state) => state.current);
  const setCurrent = useStore((state) => state.setCurrent);
  const setPresenting = useStore((state) => state.setPresenting);
  const title = useStore((state) => state.deck.title);
  const slide = slides[current];

  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const notesId = useId();
  const notesBtnRef = useRef<HTMLButtonElement>(null);
  const notesPopRef = useRef<HTMLDivElement>(null);

  const closeNotes = (restore: boolean) => {
    setNotesOpen(false);
    if (restore) notesBtnRef.current?.focus();
  };

  const note = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2600);
  };

  const onPdf = async () => {
    if (busy || !slides.length) return;
    try {
      await exportPdf(slides, title, setBusy);
      note('PDF downloaded');
    } catch (err) {
      note('PDF export failed: ' + String(err));
    } finally {
      setBusy(null);
    }
  };

  const onJson = () => {
    if (!slides.length && !title) return;
    downloadJson(title);
    note('JSON downloaded');
  };

  const exportItems: MenuButtonItem[] = [
    {
      id: 'pdf',
      label: 'PDF',
      disabled: !slides.length,
      onSelect: () => void onPdf(),
    },
    {
      id: 'json',
      label: 'JSON',
      onSelect: onJson,
    },
  ];

  const boxRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ vw: 1280, vh: 720, scale: 0.5 });
  const liveCtx = useMemo(() => ({ clicks: 9999, isStatic: false }), []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const vw = window.innerWidth,
        vh = window.innerHeight;
      const pad = 48;
      const scale = Math.min(
        (el.clientWidth - pad) / vw,
        (el.clientHeight - pad) / vh
      );
      setFrame({ vw, vh, scale });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      )
        return;
      if (notesOpen) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (document.querySelector('[role="menu"]')) return;
      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        onToggleRail();
        return;
      }
      if (event.key === 'g' || event.key === 'G') {
        event.preventDefault();
        onToggleGrid();
        return;
      }
      if (event.key === 'p' || event.key === 'P') {
        event.preventDefault();
        if (slides.length)
          window.open(`/?presenter=1#${current + 1}`, 'deck-presenter');
        return;
      }
      if (event.key === 'Escape') {
        if (browse !== 'none') {
          event.preventDefault();
          onCloseBrowse();
        }
        return;
      }
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowRight' ||
        event.key === 'PageDown'
      ) {
        event.preventDefault();
        setCurrent(current + 1);
      }
      if (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowLeft' ||
        event.key === 'PageUp'
      ) {
        event.preventDefault();
        setCurrent(current - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    browse,
    current,
    notesOpen,
    onCloseBrowse,
    onToggleGrid,
    onToggleRail,
    setCurrent,
    slides.length,
  ]);

  useEffect(() => {
    if (!notesOpen) return;
    const onPtr = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        notesPopRef.current?.contains(target) ||
        notesBtnRef.current?.contains(target)
      )
        return;
      closeNotes(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      closeNotes(true);
    };
    document.addEventListener('pointerdown', onPtr);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPtr);
      document.removeEventListener('keydown', onKey);
    };
  }, [notesOpen]);

  const dock = (
    <Dock
      mode="editor"
      slideIndex={current}
      slideCount={slides.length}
      hasPrev={current > 0}
      hasNext={current < slides.length - 1}
      railOpen={browse === 'rail'}
      gridOpen={browse === 'grid'}
      notesOpen={notesOpen}
      exportBusy={busy}
      exportFlash={flash}
      onToggleRail={onToggleRail}
      onToggleGrid={onToggleGrid}
      onPrev={() => setCurrent(current - 1)}
      onNext={() => setCurrent(current + 1)}
      onNotes={
        slide
          ? () => {
              if (notesOpen) closeNotes(true);
              else setNotesOpen(true);
            }
          : undefined
      }
      notesBtnRef={notesBtnRef}
      notesId={notesId}
      notesSlot={
        notesOpen && slide ? (
          <div
            ref={notesPopRef}
            id={notesId}
            className="notes-pop"
            role="dialog"
            aria-modal="false"
            aria-label="Speaker notes"
          >
            <NotesEditor
              key={slide.id}
              autoFocus
              value={slide.notes}
              onChange={(text) => {
                if (text !== slide.notes)
                  useStore.getState().patchSlide(slide.id, { notes: text });
              }}
              onDone={() => closeNotes(true)}
              placeholder="Speaker notes — what to SAY on this slide."
            />
            <p className="notes-pop-hint">
              Shown in the presenter console while you present.
            </p>
          </div>
        ) : null
      }
      onPresenter={() => {
        if (slides.length)
          window.open(`/?presenter=1#${current + 1}`, 'deck-presenter');
      }}
      onPresent={() => setPresenting(true)}
      exportItems={exportItems}
    />
  );

  const canvasClass = 'ed-canvas' + (browse === 'rail' ? ' rail-open' : '');

  if (!slide) {
    return (
      <div className={canvasClass} ref={boxRef}>
        <div className="ed-empty">This deck has no slides.</div>
        {dock}
      </div>
    );
  }

  return (
    <div className={canvasClass} ref={boxRef}>
      <div
        className="ed-frame"
        style={{
          width: frame.vw * frame.scale,
          height: frame.vh * frame.scale,
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide.id}
            className="ed-frame-inner"
            style={{
              width: frame.vw,
              height: frame.vh,
              transform: `scale(${frame.scale})`,
              ['--inv' as never]: String(1 / Math.max(0.05, frame.scale)),
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <DeckCtx.Provider value={liveCtx}>
              <SlideView slide={slide} />
            </DeckCtx.Provider>
          </motion.div>
        </AnimatePresence>
      </div>
      {dock}
    </div>
  );
}
