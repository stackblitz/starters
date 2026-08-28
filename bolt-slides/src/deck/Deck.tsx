import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Variants,
} from 'motion/react';
import type { SlideData } from '../data/types';
import { useStore } from '../data/store';
import { isPresenterRoute } from '../data/shell';
import SlideView from '../slide/SlideView';
import { DeckCtx } from './DeckContext';
import Annotator from './Annotator';
import { loadAnnotations, type Stroke } from './annotationInk';
import Presenter from './Presenter';
import Dock from './Dock';
import { DockPopoverProvider } from './DockPopover';
import SlideBrowser from './SlideBrowser';
import { STAGE_LAYOUT_ID, STAGE_LAYOUT_TRANSITION } from './stageLayout';
import {
  useDeckBroadcastSync,
  useDeckHashSync,
  useDeckKeyboard,
  useFullscreenState,
  useIdleCursorNearDock,
  useStageEntrance,
} from './deckHooks';

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
  const mutable = !!onExit;
  const isPresenter = useMemo(
    () => allowPresenter && isPresenterRoute(),
    [allowPresenter]
  );
  const canOpenPresenter = allowPresenter && !isPresenter;

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
  const dockRef = useRef<HTMLDivElement>(null);
  const { nearDock, cursorIdle } = useIdleCursorNearDock(dockRef);

  // per-slide build maxima (so going back restores the right click state) and
  // per-slide annotations (so drawings persist on the slide they were made).
  const buildMaxBySlide = useRef<Record<number, number>>({});
  const annotationsBySlide = useRef<Record<number, Stroke[]>>(
    loadAnnotations()
  );
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

  const syncStoreCurrent = useCallback(
    (index: number) => {
      if (mutable) useStore.getState().setCurrent(index);
    },
    [mutable]
  );

  const go = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(slideCount - 1, index));
      setSlideIndex(nextIndex);
      setClicks(0);
      setBuildMax(buildMaxBySlide.current[nextIndex] || 0);
      syncStoreCurrent(nextIndex);
    },
    [slideCount, syncStoreCurrent]
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
      syncStoreCurrent(nextIndex);
    }
  }, [clicks, buildMax, slideIndex, slideCount, syncStoreCurrent]);
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
      syncStoreCurrent(prevIndex);
    }
  }, [clicks, slideIndex, syncStoreCurrent]);

  useEffect(() => {
    if (!mutable) return;
    const storeCurrent = useStore.getState().current;
    if (storeCurrent !== slideIndex && slides[storeCurrent]) go(storeCurrent);
    else if (!slides[slideIndex] && slides.length)
      go(Math.min(slideIndex, slides.length - 1));
  }, [slides, mutable, slideIndex, go]);

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
      <DockPopoverProvider>
        <div className={'deck' + (cursorHidden ? ' nocursor' : '')}>
          <motion.div
            layout
            layoutId={STAGE_LAYOUT_ID}
            className="deck-live-stage"
            transition={{ layout: STAGE_LAYOUT_TRANSITION }}
          >
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
          </motion.div>

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

          <SlideBrowser
            slides={slides}
            current={slideIndex}
            browse={browse}
            mutable={mutable}
            navLabel={navLabel}
            onGo={go}
            onClose={closeBrowse}
          />

          <Dock
            ref={dockRef}
            mode={onExit ? 'editor-present' : 'audience'}
            slideIndex={slideIndex}
            slideCount={slideCount}
            hasPrev={hasPrev}
            hasNext={hasNext}
            railOpen={railOpen}
            gridOpen={gridOpen}
            hidden={hideUI}
            drawing={drawing}
            isFullscreen={isFullscreen}
            onToggleRail={toggleRail}
            onToggleGrid={toggleGrid}
            onPrev={prev}
            onNext={next}
            onAnnotate={() => setDrawing((open) => !open)}
            onFullscreen={toggleFullscreen}
            onPresenter={canOpenPresenter ? openPresenter : undefined}
            onBack={onExit ? () => onExit(slideIndex) : undefined}
          />
        </div>
      </DockPopoverProvider>
    </MotionConfig>
  );
}
