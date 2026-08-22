/* Editor canvas — the current slide at presentation size, scaled to fit,
   with inline editing live. The slide renders LIVE (count-ups, staggers, the
   slide's animation mode all play, like in present mode). The bottom bar
   pages the deck and carries the deck actions (Export PDF · Play · Share). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../data/store';
import { useShareOrigin } from '../data/published-origin';
import { DeckCtx } from '../deck/DeckContext';
import SlideView from '../slide/SlideView';
import ContextMenu from './ContextMenu';
import LayoutDataSheet, { hasDataSheet } from './LayoutDataSheet';
import ShareModal from './ShareModal';
import { NotesEditor } from './notes';
import { exportPdf } from '../export/exporter';

export default function Canvas() {
  const slides = useStore((s) => s.slides);
  const current = useStore((s) => s.current);
  const setCurrent = useStore((s) => s.setCurrent);
  const setPresenting = useStore((s) => s.setPresenting);
  const title = useStore((s) => s.deck.title);
  const slide = slides[current];

  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [share, setShare] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const { origin, canCopy } = useShareOrigin();
  const shareTip = canCopy
    ? 'Share links for presenting, the presenter console or editing'
    : 'Publish to share';
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

  const boxRef = useRef<HTMLDivElement>(null);
  const [d, setD] = useState({ vw: 1280, vh: 720, scale: 0.5 });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [dataOpen, setDataOpen] = useState(false);
  // paging away closes the data sheet — it edits the slide it was opened on
  useEffect(() => {
    setDataOpen(false);
    setMenu(null);
  }, [current]);
  useEffect(() => {
    if (!canCopy) setShare(false);
  }, [canCopy]);
  // live context: animations run on the canvas exactly like in present mode
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

  // keyboard paging (skipped while typing in text/fields)
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
        <div className="ed-empty">No slides — add one from the rail.</div>
      </div>
    );
  }

  // right-click on data-bearing layouts (table, chart, insight, comparison)
  // offers the Edit-data sheet. Slide text is contenteditable, so it is NOT
  // exempted (or tables would never trigger); only real form fields keep the
  // native menu, and the grip/cell menus that stopPropagation still win.
  const onCtx = (e: React.MouseEvent) => {
    if (!hasDataSheet(slide)) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea')) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="ed-canvas" ref={boxRef}>
      <div
        className="ed-frame"
        style={{ width: d.vw * d.scale, height: d.vh * d.scale }}
        onContextMenu={onCtx}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide.id}
            className="ed-frame-inner"
            style={{
              width: d.vw,
              height: d.vh,
              transform: `scale(${d.scale})`,
              // editing chrome inside the scaled slide multiplies by this to
              // stay at true screen size (see .li-tools etc. in editor.css)
              ['--inv' as never]: String(1 / Math.max(0.05, d.scale)),
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <DeckCtx.Provider value={liveCtx}>
              <SlideView slide={slide} editable />
            </DeckCtx.Provider>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="ed-canvas-nav">
        <button
          className="ghost-btn"
          data-tip="Previous slide"
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
          data-tip="Next slide"
          disabled={current >= slides.length - 1}
          onClick={() => setCurrent(current + 1)}
        >
          →
        </button>
        <button
          className={'icon-btn' + (notesOpen ? ' on' : '')}
          data-tip="Speaker notes"
          aria-label="Edit speaker notes for this slide"
          aria-pressed={notesOpen}
          onClick={() => {
            setDataOpen(false);
            setNotesOpen((v) => !v);
          }}
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
        <span
          className={'nav-status' + (busy ? ' busy' : '')}
          role="status"
          aria-live="polite"
        >
          {busy ?? flash}
        </span>
        <button
          className="ghost-btn"
          data-tip="Download the deck as a PDF"
          onClick={onPdf}
        >
          Export PDF
        </button>
        <button
          className="icon-btn"
          data-tip="Present"
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
        <span className="ed-tip" data-tip={shareTip}>
          <button
            className="solid-btn"
            aria-label={shareTip}
            aria-haspopup="dialog"
            aria-expanded={share}
            disabled={!canCopy}
            onClick={() => setShare(true)}
          >
            Share
          </button>
        </span>
      </div>
      {share && origin && (
        <ShareModal origin={origin} onClose={() => setShare(false)} />
      )}
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
            Shown in the presenter console while you present. Edits there come
            back here live.
          </p>
        </div>
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={[
            {
              label: 'Edit data…',
              onClick: () => {
                setNotesOpen(false);
                setDataOpen(true);
              },
            },
          ]}
          onClose={() => setMenu(null)}
        />
      )}
      {dataOpen && hasDataSheet(slide) && (
        <LayoutDataSheet
          key={slide.id}
          slide={slide}
          onClose={() => setDataOpen(false)}
        />
      )}
    </div>
  );
}
