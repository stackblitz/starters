import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Variants,
} from 'motion/react';
import type { SlideData } from '../data/types';
import SlideView from '../slide/SlideView';
import { DeckCtx } from './DeckContext';
import Annotator from './Annotator';
import { loadAnnotations, type Stroke } from './annotationInk';
import Thumb from './Thumb';
import Presenter from './Presenter';
import {
  useDeckBroadcastSync,
  useDeckHashSync,
  useDeckKeyboard,
  useFullscreenState,
  useIdleCursorNearDock,
  useScrolled,
  useStageEntrance,
} from './deckHooks';
import {
  IconGrid,
  IconSidebar,
  IconLeft,
  IconRight,
  IconPencil,
  IconExpand,
  IconShrink,
  IconPresent,
  IconClose,
} from './icons';

/* ── The paged presentation engine + the Slidev-style chrome (dock, side
   panel, grid overview). Pass `slides` as data; Deck renders each SlideView.
     → / ↓ / Space   next (reveals the next <Build>, then the next slide)
     ← / ↑           previous            S side panel   G grid overview
     Home / End      first / last        D draw         F fullscreen
     H  hide/show the UI                 P presenter (new tab)
   While drawing (D), the annotator owns the letter keys: P pen · H highlighter
   · L laser · I line · A arrow · R rect · O ellipse · E eraser · 1–6 colour ·
   [ ] size · ⌘Z / ⇧⌘Z undo+redo · ⌫ clear · D or Esc to finish.
   Copy verbatim; theme only via the :root tokens. ───────────────────────── */

const TRANSITIONS: Record<string, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: 56 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -56 },
  },
  rise: {
    initial: { opacity: 0, y: 44 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -44 },
  },
  zoom: {
    initial: { opacity: 0, scale: 0.965 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.02 },
  },
  none: { initial: {}, animate: {}, exit: {} },
};

function renderSlide(slide: SlideData) {
  return (
    <SlideView
      slide={slide}
      notes={slide.notes}
      transition={slide.transition ?? undefined}
    />
  );
}

export default function Deck({
  slides,
  transition = 'fade',
  navLabel,
  allowPresenter = true,
  initialSlide,
  onExit,
}: {
  slides: SlideData[];
  transition?: string;
  /** false hides the dock P control (the console itself) */
  allowPresenter?: boolean;
  /** optional short name for a slide, shown as "up next" in the console */
  navLabel?: (index: number) => string | undefined;
  /** start here instead of the URL hash (in-place present from the editor) */
  initialSlide?: number;
  /** leave present mode without changing the URL (in-place from the editor) */
  onExit?: (slideIndex: number) => void;
}) {
  const slideCount = slides.length;
  const isPresenter = useMemo(
    () =>
      allowPresenter &&
      new URLSearchParams(window.location.search).has('presenter'),
    [allowPresenter]
  );
  const canOpenPresenter = allowPresenter && !isPresenter;
  const presenterTip = 'Presenter — new tab (P)';

  const [slideIndex, setSlideIndex] = useState(() => {
    if (initialSlide != null)
      return Math.max(0, Math.min(slideCount - 1, initialSlide));
    const hashSlide = parseInt(window.location.hash.slice(1), 10);
    return hashSlide >= 1 && hashSlide <= slideCount ? hashSlide - 1 : 0;
  });
  const [clicks, setClicks] = useState(0);
  const [buildMax, setBuildMax] = useState(0);
  // two ways to browse the deck, mutually exclusive: a persistent side panel
  // (stays open while you jump around) and a full-screen grid overview (a
  // picker — it closes on pick). Opening one closes the other.
  const [browse, setBrowse] = useState<'none' | 'rail' | 'grid'>('none');
  const railOpen = browse === 'rail';
  const gridOpen = browse === 'grid';
  const toggleRail = useCallback(
    () => setBrowse((mode) => (mode === 'rail' ? 'none' : 'rail')),
    []
  );
  const toggleGrid = useCallback(
    () => setBrowse((mode) => (mode === 'grid' ? 'none' : 'grid')),
    []
  );
  const closeBrowse = useCallback(() => setBrowse('none'), []);
  const [drawing, setDrawing] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);

  const { stageIn, setStageIn } = useStageEntrance(slideIndex);
  const { isFullscreen, toggleFullscreen } = useFullscreenState();
  const { nearDock, cursorIdle } = useIdleCursorNearDock();

  // per-slide build maxima (so going back restores the right click state) and
  // per-slide annotations (so drawings persist on the slide they were made).
  const buildMaxBySlide = useRef<Record<number, number>>({});
  const annotationsBySlide = useRef<Record<number, Stroke[]>>(
    loadAnnotations()
  );
  const railRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const slideIndexRef = useRef(slideIndex);
  slideIndexRef.current = slideIndex;

  const registerMax = useCallback((at: number) => {
    const maxima = buildMaxBySlide.current;
    maxima[slideIndexRef.current] = Math.max(
      maxima[slideIndexRef.current] || 0,
      at
    );
    setBuildMax((prev) => Math.max(prev, at));
  }, []);

  const go = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(slideCount - 1, index));
      setSlideIndex(nextIndex);
      setClicks(0);
      setBuildMax(buildMaxBySlide.current[nextIndex] || 0);
    },
    [slideCount]
  );
  const next = useCallback(() => {
    if (clicks < buildMax) {
      setClicks(clicks + 1);
      return;
    }
    if (slideIndex < slideCount - 1) {
      const nextIndex = slideIndex + 1;
      setSlideIndex(nextIndex);
      setClicks(0);
      setBuildMax(buildMaxBySlide.current[nextIndex] || 0);
    }
  }, [clicks, buildMax, slideIndex, slideCount]);
  const prev = useCallback(() => {
    if (clicks > 0) {
      setClicks(clicks - 1);
      return;
    }
    if (slideIndex > 0) {
      const prevIndex = slideIndex - 1;
      const restoredBuilds = buildMaxBySlide.current[prevIndex] || 0;
      setSlideIndex(prevIndex);
      setClicks(restoredBuilds);
      setBuildMax(restoredBuilds);
    }
  }, [clicks, slideIndex]);

  const openPresenter = useCallback(() => {
    window.open(`/?presenter=1#${slideIndex + 1}`, 'deck-presenter');
  }, [slideIndex]);

  useDeckKeyboard({
    next,
    prev,
    go,
    slideCount,
    slideIndex,
    toggleFullscreen,
    openPresenter,
    toggleRail,
    toggleGrid,
    closeBrowse,
    drawing,
    browse,
    uiHidden,
    isPresenter,
    canOpenPresenter,
    onExit,
    setDrawing,
    setUiHidden,
  });

  const skipHash = !!onExit && !isPresenter;
  useDeckHashSync({ slideIndex, slideCount, go, skipHash });

  const isLeader = isPresenter || !!onExit;
  useDeckBroadcastSync({
    slideIndex,
    clicks,
    isLeader,
    setSlideIndex,
    setClicks,
  });

  const railScrolled = useScrolled(railRef, railOpen);
  const gridScrolled = useScrolled(gridRef, gridOpen);

  const liveCtx = useMemo(
    () => ({ clicks, isStatic: false, registerMax }),
    [clicks, registerMax]
  );
  const hasPrev = slideIndex > 0 || clicks > 0;
  const hasNext = slideIndex < slideCount - 1 || clicks < buildMax;
  const currentSlide = slides[slideIndex];
  const noteText = currentSlide?.notes ?? '';
  const slideTransition = currentSlide?.transition || transition;
  const hideUI = uiHidden || (isFullscreen && !nearDock);
  const cursorHidden = isFullscreen && cursorIdle && !drawing;
  const showAnnotator =
    drawing || (annotationsBySlide.current[slideIndex]?.length ?? 0) > 0;

  /* Presenter mode is its own screen: a console with the live slide, what is
     next, the notes and the clock — not a second copy of the presentation.
     The audience window stays in step over the BroadcastChannel. */
  if (isPresenter) {
    return (
      <MotionConfig reducedMotion="user">
        <Presenter
          slides={slides}
          slideIndex={slideIndex}
          slideCount={slideCount}
          clicks={clicks}
          buildMax={buildMax}
          liveCtx={liveCtx}
          notes={noteText}
          onGo={go}
          onNext={next}
          onPrev={prev}
          navLabel={navLabel}
          onExit={onExit}
        />
      </MotionConfig>
    );
  }

  const transitionName = slideTransition;
  const variants = TRANSITIONS[transitionName] ?? TRANSITIONS.fade;

  return (
    <MotionConfig reducedMotion="user">
      <div className={'deck' + (cursorHidden ? ' nocursor' : '')}>
        <DeckCtx.Provider value={liveCtx}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="slide-stage"
              key={currentSlide?.id ?? slideIndex}
              style={{ animation: 'none' }}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{
                duration: transitionName === 'none' ? 0 : 0.42,
                ease: [0.16, 1, 0.3, 1],
              }}
              onAnimationComplete={(definition) => {
                if (definition === 'animate') setStageIn(true);
              }}
            >
              {currentSlide ? renderSlide(currentSlide) : null}
            </motion.div>
          </AnimatePresence>
        </DeckCtx.Provider>

        {showAnnotator && (
          <Annotator
            key={slideIndex}
            slide={slideIndex}
            store={annotationsBySlide.current}
            active={drawing}
            onDone={() => setDrawing(false)}
            hold={!stageIn}
          />
        )}

        <aside
          className={'noir-rail' + (railOpen ? ' open' : '')}
          ref={railRef}
        >
          <div className={'noir-rail-head' + (railScrolled ? ' scrolled' : '')}>
            <span className="noir-rail-title">Slides</span>
            <button
              className="noir-icon-btn sm"
              data-tip="Close"
              aria-label="Close the slide panel"
              onClick={closeBrowse}
            >
              <IconClose />
            </button>
          </div>
          {/* picking a slide does NOT close the panel — it stays open so you can
              keep browsing; close it deliberately (button, S, Esc). */}
          <div className="noir-rail-list">
            {railOpen &&
              slides.map((slide, i) => (
                <button
                  key={slide.id}
                  className={'noir-thumb' + (i === slideIndex ? ' active' : '')}
                  aria-label={`Go to slide ${i + 1}${
                    navLabel?.(i) ? ' — ' + navLabel(i) : ''
                  }`}
                  aria-current={i === slideIndex ? 'true' : undefined}
                  onClick={() => go(i)}
                >
                  <span className="noir-thumb-no">{i + 1}</span>
                  <Thumb>{renderSlide(slide)}</Thumb>
                </button>
              ))}
          </div>
        </aside>

        {/* Grid overview — a full-screen picker; it covers the slide, so
            choosing one closes it. */}
        <AnimatePresence>
          {gridOpen && (
            <motion.div
              className="noir-grid"
              ref={gridRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div
                className={'noir-grid-head' + (gridScrolled ? ' scrolled' : '')}
              >
                <span className="noir-rail-title">
                  All slides · {slideCount}
                </span>
                <button
                  className="noir-icon-btn sm"
                  data-tip="Close"
                  aria-label="Close the grid overview"
                  onClick={closeBrowse}
                >
                  <IconClose />
                </button>
              </div>
              <div className="noir-grid-list">
                {slides.map((slide, i) => (
                  <button
                    key={slide.id}
                    className={
                      'noir-thumb noir-thumb-grid' +
                      (i === slideIndex ? ' active' : '')
                    }
                    aria-label={`Go to slide ${i + 1}${
                      navLabel?.(i) ? ' — ' + navLabel(i) : ''
                    }`}
                    aria-current={i === slideIndex ? 'true' : undefined}
                    onClick={() => {
                      go(i);
                      closeBrowse();
                    }}
                  >
                    <Thumb>{renderSlide(slide)}</Thumb>
                    <span className="noir-thumb-no">{i + 1}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={'noir-dock' + (hideUI ? ' hidden' : '')}>
          <div className="noir-bar">
            {onExit && (
              <>
                <button
                  className="noir-icon-btn"
                  data-tip="Back to editor (Esc)"
                  aria-label="Back to the editor"
                  onClick={() => onExit(slideIndex)}
                >
                  <IconClose />
                </button>
                <span className="noir-sep" />
              </>
            )}
            <button
              className={'noir-icon-btn' + (railOpen ? ' on' : '')}
              data-tip="Side panel (S)"
              aria-label="Slide panel"
              aria-pressed={railOpen}
              onClick={toggleRail}
            >
              <IconSidebar />
            </button>
            <button
              className={'noir-icon-btn' + (gridOpen ? ' on' : '')}
              data-tip="Grid overview (G)"
              aria-label="Grid overview"
              aria-pressed={gridOpen}
              onClick={toggleGrid}
            >
              <IconGrid />
            </button>
            <span className="noir-sep" />
            <button
              className="noir-icon-btn"
              data-tip={hasPrev ? 'Previous' : undefined}
              aria-label="Previous slide"
              disabled={!hasPrev}
              onClick={prev}
            >
              <IconLeft />
            </button>
            <div className="noir-counter">
              <span className="noir-counter-now">{slideIndex + 1}</span>
              <span className="noir-counter-tot">/ {slideCount}</span>
            </div>
            <button
              className="noir-icon-btn"
              data-tip={hasNext ? 'Next' : undefined}
              aria-label="Next slide"
              disabled={!hasNext}
              onClick={next}
            >
              <IconRight />
            </button>
            <span className="noir-sep" />
            <button
              className={'noir-icon-btn noir-optional' + (drawing ? ' on' : '')}
              data-tip="Annotate (D)"
              aria-label="Annotate the slide"
              aria-pressed={drawing}
              onClick={() => setDrawing((open) => !open)}
            >
              <IconPencil />
            </button>
            <button
              className="noir-icon-btn"
              data-tip={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <IconShrink /> : <IconExpand />}
            </button>
            {canOpenPresenter && (
              <button
                className="noir-icon-btn noir-optional"
                data-tip={presenterTip}
                aria-label={presenterTip}
                onClick={openPresenter}
              >
                <IconPresent />
              </button>
            )}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
