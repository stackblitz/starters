/* Studio canvas — the current slide at presentation size, scaled to fit.
   The slide renders LIVE (count-ups, staggers, the slide's animation mode
   all play, like in present mode). The bottom bar pages the deck and
   carries speaker notes, Present, and Download as (PDF / JSON). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore, serializeDeck } from '../data/store';
import { DeckCtx } from '../deck/DeckContext';
import SlideView from '../slide/SlideView';
import { NotesEditor } from './notes';
import MenuButton from './MenuButton';
import { exportPdf } from '../export/exporter';

function downloadJson(title: string) {
  const file = serializeDeck();
  const blob = new Blob([JSON.stringify(file, null, 2) + '\n'], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  const name = (title || 'deck').replace(/[^\w\- ]+/g, '').trim() || 'deck';
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Canvas() {
  const slides = useStore((s) => s.slides);
  const current = useStore((s) => s.current);
  const setCurrent = useStore((s) => s.setCurrent);
  const setPresenting = useStore((s) => s.setPresenting);
  const title = useStore((s) => s.deck.title);
  const slide = slides[current];

  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const note = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2600);
  };

  const onPdf = async () => {
    if (busy || !slides.length) return;
    try {
      await exportPdf(slides, title, setBusy);
      note('PDF downloaded');
    } catch (e) {
      note('PDF export failed: ' + String(e));
    } finally {
      setBusy(null);
    }
  };

  const onJson = () => {
    if (!slides.length && !title) return;
    downloadJson(title);
    note('JSON downloaded');
  };

  const boxRef = useRef<HTMLDivElement>(null);
  const [d, setD] = useState({ vw: 1280, vh: 720, scale: 0.5 });
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
      setD({ vw, vh, scale });
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
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'TEXTAREA' ||
          t.tagName === 'INPUT' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (document.querySelector('[role="menu"]')) return;
      if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowRight' ||
        e.key === 'PageDown'
      ) {
        e.preventDefault();
        setCurrent(current + 1);
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrent(current - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, setCurrent]);

  if (!slide) {
    return (
      <div className="ed-canvas" ref={boxRef}>
        <div className="ed-empty">This deck has no slides.</div>
      </div>
    );
  }

  return (
    <div className="ed-canvas" ref={boxRef}>
      <div
        className="ed-frame"
        style={{ width: d.vw * d.scale, height: d.vh * d.scale }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide.id}
            className="ed-frame-inner"
            style={{
              width: d.vw,
              height: d.vh,
              transform: `scale(${d.scale})`,
              ['--inv' as never]: String(1 / Math.max(0.05, d.scale)),
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
      <div className="ed-canvas-nav">
        <span
          className={'nav-toast' + (busy ? ' busy' : '')}
          role="status"
          aria-live="polite"
        >
          {busy ?? flash}
        </span>
        <button
          className="ghost-btn"
          data-tip={current === 0 ? undefined : 'Previous slide'}
          disabled={current === 0}
          onClick={() => setCurrent(current - 1)}
        >
          ←
        </button>
        <span className="ed-counter">
          {current + 1} / {slides.length}
        </span>
        <button
          className="ghost-btn"
          data-tip={current >= slides.length - 1 ? undefined : 'Next slide'}
          disabled={current >= slides.length - 1}
          onClick={() => setCurrent(current + 1)}
        >
          →
        </button>
        <button
          className={'icon-btn' + (notesOpen ? ' on' : '')}
          data-tip="Speaker notes"
          type="button"
          aria-label="Edit speaker notes for this slide"
          aria-pressed={notesOpen}
          onClick={() => setNotesOpen((v) => !v)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="M8 9.5h8M8 13h8M8 16.5h4.5" />
          </svg>
        </button>
        <span className="nav-sep" aria-hidden />
        <MenuButton
          label="Download as"
          tip={busy ? undefined : 'Download the deck as PDF or JSON'}
          disabled={!!busy}
          items={[
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
          ]}
        />
        <button
          className="icon-btn"
          data-tip={slides.length ? 'Present' : undefined}
          type="button"
          aria-label="Present this deck"
          disabled={!slides.length}
          onClick={() => setPresenting(true)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M7 4.5v15c0 0.9 1 1.45 1.77 0.97l11.5-7.5a1.15 1.15 0 0 0 0-1.94L8.77 3.53C8 3.05 7 3.6 7 4.5Z" />
          </svg>
        </button>
      </div>
      {notesOpen && (
        <div className="notes-pop">
          <NotesEditor
            key={slide.id}
            value={slide.notes}
            onChange={(text) => {
              if (text !== slide.notes)
                useStore.getState().patchSlide(slide.id, { notes: text });
            }}
            onDone={() => setNotesOpen(false)}
            placeholder="Speaker notes — what to SAY on this slide."
          />
          <p className="notes-pop-hint">
            Shown in the presenter console while you present.
          </p>
        </div>
      )}
    </div>
  );
}
