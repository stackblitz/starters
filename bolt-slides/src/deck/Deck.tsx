import { Children, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react'
import { DeckCtx } from '@/deck/DeckContext'
import Annotator, { loadAnnotations, type Stroke } from '@/deck/Annotator'
import Thumb from '@/deck/Thumb'
import Presenter from '@/deck/Presenter'
import { IconGrid, IconSidebar, IconLeft, IconRight, IconPencil, IconExpand, IconShrink, IconPresent, IconClose } from '@/deck/icons'

/* ── The paged presentation engine + the Slidev-style chrome (dock, side
   panel, grid overview).
   Wrap your <Slide>/<Bento>/… in <Deck>. Each top-level child is one slide.
     → / ↓ / Space   next (reveals the next <Build>, then the next slide)
     ← / ↑           previous            S side panel   G grid overview
     Home / End      first / last        D draw         F fullscreen
     H  hide/show the UI                 P presenter (new tab)
   While drawing (D), the annotator owns the letter keys: P pen · H highlighter
   · L laser · I line · A arrow · R rect · O ellipse · E eraser · 1–6 colour ·
   [ ] size · ⌘Z / ⇧⌘Z undo+redo · ⌫ clear · D or Esc to finish.
   Copy verbatim; theme only via the :root tokens. ───────────────────────── */

/* True once a scroll container has moved off the top — the sticky heads stay
   fully transparent until something actually scrolls under them. */
function useScrolled(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!active || !el) { setScrolled(false); return }
    const onScroll = () => setScrolled(el.scrollTop > 0)
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [ref, active])
  return scrolled
}

/* Slide-to-slide transition variants. The deck default comes from the
   `transition` prop; a slide can override it via a `transition` prop on the
   slide element itself (SlideView passes the row's value through). */
const TRANSITIONS: Record<string, Variants> = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  slide: { initial: { opacity: 0, x: 56 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -56 } },
  rise: { initial: { opacity: 0, y: 44 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -44 } },
  zoom: { initial: { opacity: 0, scale: 0.965 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.02 } },
  none: { initial: {}, animate: {}, exit: {} },
}

export default function Deck({
  children, transition = 'fade', onNotes, navLabel, allowPresenter = true,
}: {
  children: ReactNode
  transition?: string
  /** false on an audience share link — the console shows speaker notes */
  allowPresenter?: boolean
  /** persist a slide's speaker notes (presenter console edits) */
  onNotes?: (index: number, text: string) => void
  /** optional short name for a slide, shown as "up next" in the console */
  navLabel?: (index: number) => string | undefined
}) {
  const slides = useMemo(() => Children.toArray(children) as ReactElement[], [children])
  const total = slides.length
  const isPresenter = useMemo(() => new URLSearchParams(window.location.search).has('presenter'), [])

  const [slide, setSlide] = useState(() => {
    const h = parseInt(window.location.hash.slice(1), 10)
    return h >= 1 && h <= total ? h - 1 : 0
  })
  const [clicks, setClicks] = useState(0)
  const [curMax, setCurMax] = useState(0)
  // two ways to browse the deck, mutually exclusive: a persistent side panel
  // (stays open while you jump around) and a full-screen grid overview (a
  // picker — it closes on pick). Opening one closes the other.
  const [browse, setBrowse] = useState<'none' | 'rail' | 'grid'>('none')
  const railOpen = browse === 'rail'
  const gridOpen = browse === 'grid'
  const toggleRail = useCallback(() => setBrowse((b) => (b === 'rail' ? 'none' : 'rail')), [])
  const toggleGrid = useCallback(() => setBrowse((b) => (b === 'grid' ? 'none' : 'grid')), [])
  const closeBrowse = useCallback(() => setBrowse('none'), [])
  const [drawing, setDrawing] = useState(false)
  // false while the incoming slide is still animating — annotations wait for it
  const [stageIn, setStageIn] = useState(false)
  const [fs, setFs] = useState(false)
  const [uiHidden, setUiHidden] = useState(false)
  const [nearDock, setNearDock] = useState(false)
  const [cursorIdle, setCursorIdle] = useState(false)

  // per-slide build maxima (so going back restores the right click state) and
  // per-slide annotations (so drawings persist on the slide they were made).
  const maxMap = useRef<Record<number, number>>({})
  const annStore = useRef<Record<number, Stroke[]>>(loadAnnotations())
  const railRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const slideRef = useRef(slide)
  slideRef.current = slide

  const registerMax = useCallback((at: number) => {
    const m = maxMap.current
    m[slideRef.current] = Math.max(m[slideRef.current] || 0, at)
    setCurMax((c) => Math.max(c, at))
  }, [])

  const go = useCallback((i: number) => {
    const n = Math.max(0, Math.min(total - 1, i))
    setSlide(n); setClicks(0); setCurMax(maxMap.current[n] || 0)
  }, [total])
  const next = useCallback(() => {
    if (clicks < curMax) { setClicks(clicks + 1); return }
    if (slide < total - 1) { const n = slide + 1; setSlide(n); setClicks(0); setCurMax(maxMap.current[n] || 0) }
  }, [clicks, curMax, slide, total])
  const prev = useCallback(() => {
    if (clicks > 0) { setClicks(clicks - 1); return }
    if (slide > 0) { const n = slide - 1; const m = maxMap.current[n] || 0; setSlide(n); setClicks(m); setCurMax(m) }
  }, [clicks, slide])

  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }, [])
  const openPresenter = useCallback(() => {
    if (isPresenter) return
    const params = new URLSearchParams(window.location.search)
    params.set('presenter', '1')
    const url = `${window.location.pathname}?${params}${window.location.hash}`
    window.open(url, 'deck-presenter')
  }, [isPresenter])

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown': e.preventDefault(); next(); break
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': e.preventDefault(); prev(); break
        case 'Home': e.preventDefault(); go(0); break
        case 'End': e.preventDefault(); go(total - 1); break
        // while drawing, the annotator owns the letter keys it uses (O, P, H
        // are ellipse / pen / highlighter there) — D and Escape still exit
        case 'o': case 'O': if (drawing) break; toggleRail(); break
        case 's': case 'S': toggleRail(); break
        case 'g': case 'G': toggleGrid(); break
        case 'f': case 'F': toggleFs(); break
        case 'd': case 'D': if (isPresenter) break; setDrawing((v) => !v); break
        case 'p': case 'P': if (drawing || !allowPresenter) break; openPresenter(); break
        case 'h': case 'H': if (drawing) break; setUiHidden((v) => !v); break
        case 'Escape': closeBrowse(); setDrawing(false); setUiHidden(false); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, go, total, toggleFs, openPresenter, toggleRail, toggleGrid, closeBrowse, drawing, isPresenter, allowPresenter])

  // the slide's entrance owns the screen first: hold the ink until the stage
  // has finished animating in (with a safety net if no animation ever runs)
  useEffect(() => {
    setStageIn(false)
    const t = window.setTimeout(() => setStageIn(true), 1000)
    return () => clearTimeout(t)
  }, [slide])

  // URL hash sync (initial slide comes from the hash via useState above)
  useEffect(() => { const want = String(slide + 1); if (window.location.hash.slice(1) !== want) history.replaceState(null, '', '#' + want) }, [slide])
  useEffect(() => {
    const onHash = () => { const h = parseInt(window.location.hash.slice(1), 10); if (h >= 1 && h <= total && h - 1 !== slide) go(h - 1) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [slide, total, go])

  // cross-tab sync (audience ⇄ presenter), via BroadcastChannel
  const chan = useRef<BroadcastChannel | null>(null)
  const applyingRemote = useRef(false)
  useEffect(() => {
    const c = new BroadcastChannel('deck-sync')
    chan.current = c
    c.onmessage = (e) => {
      if (e.data?.type === 'state') { applyingRemote.current = true; setSlide(e.data.slide); setClicks(e.data.clicks) }
    }
    return () => c.close()
  }, [])
  useEffect(() => {
    if (applyingRemote.current) { applyingRemote.current = false; return }
    chan.current?.postMessage({ type: 'state', slide, clicks })
  }, [slide, clicks])

  // fullscreen flag, presenter timer, idle auto-hide
  useEffect(() => { const h = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h) }, [])
  // mouse-driven only: keyboard nav keeps the UI hidden; the dock returns when
  // the pointer nears the bottom (where it lives); the cursor hides on idle.
  useEffect(() => {
    let t = 0
    const onMove = (e: MouseEvent) => {
      setCursorIdle(false)
      setNearDock(e.clientY > window.innerHeight - 150)
      clearTimeout(t); t = window.setTimeout(() => setCursorIdle(true), 2600)
    }
    window.addEventListener('mousemove', onMove)
    return () => { clearTimeout(t); window.removeEventListener('mousemove', onMove) }
  }, [])

  const railScrolled = useScrolled(railRef, railOpen)
  const gridScrolled = useScrolled(gridRef, gridOpen)

  const liveCtx = useMemo(() => ({ clicks, isStatic: false, registerMax }), [clicks, registerMax])
  const hasPrev = slide > 0 || clicks > 0
  const hasNext = slide < total - 1 || clicks < curMax
  const noteText = (slides[slide]?.props as { notes?: string } | undefined)?.notes ?? ''
  const slideTransition = ((slides[slide]?.props as { transition?: string } | undefined)?.transition) || transition
  const hideUI = uiHidden || (fs && !nearDock)
  const cursorHidden = fs && cursorIdle && !drawing
  const showAnnotator = drawing || (annStore.current[slide]?.length ?? 0) > 0

  /* Presenter mode is its own screen: a console with the live slide, what is
     next, the notes and the clock — not a second copy of the presentation.
     The audience window stays in step over the BroadcastChannel. */
  if (isPresenter) {
    return (
      <MotionConfig reducedMotion="user">
        <Presenter
          slides={slides}
          slide={slide}
          total={total}
          clicks={clicks}
          curMax={curMax}
          liveCtx={liveCtx}
          notes={noteText}
          onNotes={onNotes}
          onGo={go}
          onNext={next}
          onPrev={prev}
          navLabel={navLabel}
        />
      </MotionConfig>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={'deck' + (cursorHidden ? ' nocursor' : '')}>
        <DeckCtx.Provider value={liveCtx}>
          <AnimatePresence mode="wait" initial={false}>
            {(() => {
              const t = slideTransition
              const v = TRANSITIONS[t] ?? TRANSITIONS.fade
              return (
                <motion.div
                  className="slide-stage"
                  key={slide}
                  style={{ animation: 'none' }}
                  variants={v}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: t === 'none' ? 0 : 0.42, ease: [0.16, 1, 0.3, 1] }}
                  onAnimationComplete={(d) => { if (d === 'animate') setStageIn(true) }}
                >
                  {slides[slide]}
                </motion.div>
              )
            })()}
          </AnimatePresence>
        </DeckCtx.Provider>

        {showAnnotator && (
          <Annotator
            key={slide}
            slide={slide}
            store={annStore.current}
            active={drawing}
            onDone={() => setDrawing(false)}
            hold={!stageIn}
          />
        )}

        <aside className={'noir-rail' + (railOpen ? ' open' : '')} ref={railRef}>
          <div className={'noir-rail-head' + (railScrolled ? ' scrolled' : '')}>
            <span className="noir-rail-title">Slides</span>
            <button className="noir-icon-btn sm" data-tip="Close" aria-label="Close the slide panel" onClick={closeBrowse}><IconClose /></button>
          </div>
          {/* picking a slide does NOT close the panel — it stays open so you can
              keep browsing; close it deliberately (button, S, Esc). */}
          <div className="noir-rail-list">
            {railOpen && slides.map((s, i) => (
              <button
                key={i}
                className={'noir-thumb' + (i === slide ? ' active' : '')}
                aria-label={`Go to slide ${i + 1}${navLabel?.(i) ? ' — ' + navLabel(i) : ''}`}
                aria-current={i === slide ? 'true' : undefined}
                onClick={() => go(i)}
              >
                <span className="noir-thumb-no">{i + 1}</span>
                <Thumb>{s}</Thumb>
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
              <div className={'noir-grid-head' + (gridScrolled ? ' scrolled' : '')}>
                <span className="noir-rail-title">All slides · {total}</span>
                <button className="noir-icon-btn sm" data-tip="Close" aria-label="Close the grid overview" onClick={closeBrowse}><IconClose /></button>
              </div>
              <div className="noir-grid-list">
                {slides.map((s, i) => (
                  <button
                    key={i}
                    className={'noir-thumb noir-thumb-grid' + (i === slide ? ' active' : '')}
                    aria-label={`Go to slide ${i + 1}${navLabel?.(i) ? ' — ' + navLabel(i) : ''}`}
                    aria-current={i === slide ? 'true' : undefined}
                    onClick={() => { go(i); closeBrowse() }}
                  >
                    <Thumb>{s}</Thumb>
                    <span className="noir-thumb-no">{i + 1}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={'noir-dock' + (hideUI ? ' hidden' : '')}>
          <div className="noir-bar">
            <button className={'noir-icon-btn' + (railOpen ? ' on' : '')} data-tip="Side panel (S)" aria-label="Slide panel" aria-pressed={railOpen} onClick={toggleRail}><IconSidebar /></button>
            <button className={'noir-icon-btn' + (gridOpen ? ' on' : '')} data-tip="Grid overview (G)" aria-label="Grid overview" aria-pressed={gridOpen} onClick={toggleGrid}><IconGrid /></button>
            <span className="noir-sep" />
            <button className="noir-icon-btn" data-tip="Previous" aria-label="Previous slide" disabled={!hasPrev} onClick={prev}><IconLeft /></button>
            <div className="noir-counter"><span className="noir-counter-now">{slide + 1}</span><span className="noir-counter-tot">/ {total}</span></div>
            <button className="noir-icon-btn" data-tip="Next" aria-label="Next slide" disabled={!hasNext} onClick={next}><IconRight /></button>
            <span className="noir-sep" />
            <button className={'noir-icon-btn noir-optional' + (drawing ? ' on' : '')} data-tip="Annotate (D)" aria-label="Annotate the slide" aria-pressed={drawing} onClick={() => setDrawing((v) => !v)}><IconPencil /></button>
            <button className="noir-icon-btn" data-tip={fs ? 'Exit fullscreen (F)' : 'Fullscreen (F)'} aria-label={fs ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFs}>{fs ? <IconShrink /> : <IconExpand />}</button>
            {allowPresenter && (
              <button className="noir-icon-btn noir-optional" data-tip="Presenter — new tab (P)" aria-label="Open the presenter console in a new window" onClick={openPresenter}><IconPresent /></button>
            )}
          </div>
        </div>
      </div>
    </MotionConfig>
  )
}
