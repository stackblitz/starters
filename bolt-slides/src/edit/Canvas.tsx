/* Studio canvas — the current slide at presentation size, scaled to fit.
   Speaker notes pin under the slide. The shared dock pages the deck and
   carries Present, Presenter, and Download. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore, serializeDeck } from '../data/store';
import { openPresentWindow, openPresenterWindow } from '../data/shell';
import { DeckCtx } from '../deck/DeckContext';
import Dock from '../deck/Dock';
import type { BrowseMode } from '../deck/SlideBrowser';
import {
  STAGE_LAYOUT_ID,
  STAGE_LAYOUT_TRANSITION,
  fitScaleForArea,
  readStoredFit,
  rememberFit,
} from '../deck/stageLayout';
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
  gridFocus,
  onToggleRail,
  onToggleGrid,
  onCloseBrowse,
}: {
  browse: BrowseMode;
  gridFocus: number;
  onToggleRail: () => void;
  onToggleGrid: () => void;
  onCloseBrowse: () => void;
}) {
  const slides = useStore((state) => state.slides);
  const current = useStore((state) => state.current);
  const setCurrent = useStore((state) => state.setCurrent);
  const title = useStore((state) => state.deck.title);
  const slide = slides[current];

  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

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

  const stageRef = useRef<HTMLDivElement>(null);
  const railOpen = browse === 'rail';
  const gridOpen = browse === 'grid';
  const presentFrom =
    gridOpen && slides.length
      ? Math.max(0, Math.min(gridFocus, slides.length - 1))
      : current;

  const startFromSelection = (presenter: boolean) => {
    if (!slides.length) return;
    if (presentFrom !== current) setCurrent(presentFrom);
    if (presenter) openPresenterWindow(presentFrom);
    else openPresentWindow(presentFrom);
  };
  const [canvasBox, setCanvasBox] = useState({ w: 0, h: 0 });
  const liveCtx = useMemo(() => ({ clicks: 9999, isStatic: false }), []);

  const frame = useMemo(() => {
    const next =
      canvasBox.w > 0
        ? fitScaleForArea(canvasBox.w, canvasBox.h)
        : readStoredFit(railOpen);
    rememberFit(next);
    return next;
  }, [railOpen, canvasBox]);

  useLayoutEffect(() => {
    const slot = stageRef.current;
    if (!slot) return;
    const syncBox = () => {
      const w = slot.clientWidth;
      const h = slot.clientHeight;
      setCanvasBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    syncBox();
    const ro = new ResizeObserver(syncBox);
    ro.observe(slot);
    window.addEventListener('resize', syncBox);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncBox);
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
        startFromSelection(true);
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
        if (browse === 'grid') return;
        event.preventDefault();
        setCurrent(current + 1);
      }
      if (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowLeft' ||
        event.key === 'PageUp'
      ) {
        if (browse === 'grid') return;
        event.preventDefault();
        setCurrent(current - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    browse,
    current,
    onCloseBrowse,
    onToggleGrid,
    onToggleRail,
    setCurrent,
    startFromSelection,
    slides.length,
  ]);

  const dock = (
    <Dock
      mode="editor"
      slideIndex={current}
      slideCount={slides.length}
      hasPrev={current > 0}
      hasNext={current < slides.length - 1}
      railOpen={browse === 'rail'}
      gridOpen={gridOpen}
      exportBusy={busy}
      exportFlash={flash}
      onToggleRail={onToggleRail}
      onToggleGrid={onToggleGrid}
      onPrev={() => setCurrent(current - 1)}
      onNext={() => setCurrent(current + 1)}
      onPresenter={() => startFromSelection(true)}
      onPresent={() => startFromSelection(false)}
      exportItems={exportItems}
    />
  );

  const canvasClass = 'ed-canvas' + (railOpen ? ' rail-open' : '');
  const frameW = frame.vw * frame.scale;
  const frameH = frame.vh * frame.scale;

  return (
    <div className={canvasClass}>
      <div className="ed-stage" inert={gridOpen || undefined}>
        <div
          className={'ed-slide-slot' + (slide ? '' : ' empty')}
          ref={stageRef}
        >
          {slide ? (
            <motion.div
              layout
              layoutId={STAGE_LAYOUT_ID}
              className="ed-frame"
              style={{
                width: frameW,
                height: frameH,
                borderRadius: 12,
              }}
              transition={{ layout: STAGE_LAYOUT_TRANSITION }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={slide.id}
                  className="ed-frame-inner"
                  style={{
                    width: frame.vw,
                    height: frame.vh,
                    transform: `scale(${frame.scale})`,
                    transformOrigin: 'top left',
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
            </motion.div>
          ) : (
            <div className="ed-empty">This deck has no slides.</div>
          )}
        </div>
        {slide ? (
          <motion.div
            className="ed-notes"
            layout
            style={{ width: frameW }}
            transition={{ layout: STAGE_LAYOUT_TRANSITION }}
          >
            <div className="ed-notes-label">Speaker notes</div>
            <NotesEditor
              key={slide.id}
              value={slide.notes}
              onChange={(text) => {
                if (text !== slide.notes)
                  useStore.getState().patchSlide(slide.id, { notes: text });
              }}
              placeholder="What to say on this slide — shown in the presenter console."
            />
          </motion.div>
        ) : null}
      </div>
      {dock}
    </div>
  );
}
