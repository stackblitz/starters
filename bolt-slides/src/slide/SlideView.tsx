/* SlideView — the one component that turns a slide ROW into pixels. Used by
   the editor canvas (editable), sidebar thumbnails + overview rail (static),
   present mode (live) and PDF/OG export (static). Applies the slide's
   background and its chosen entrance-animation mode around the layout. */
import { Component, type ReactNode as RN } from 'react'
import { motion, type Variants } from 'motion/react'
import type { ReactNode } from 'react'
import type { Background, SlideData } from '../data/types'
import { DeckCtx, useDeck } from '../deck/DeckContext'
import { EditCtx } from '../edit/EditContext'
import { RenderLayout } from '../layouts/registry'

function BackgroundLayer({ bg }: { bg: Background | undefined }) {
  if (!bg || bg.type === 'none') return null
  const base = { position: 'absolute', inset: 0, zIndex: 0 } as const
  if (bg.type === 'color') return <div aria-hidden style={{ ...base, background: bg.color }} />
  if (bg.type === 'gradient') {
    return <div aria-hidden style={{ ...base, background: `linear-gradient(${bg.angle ?? 135}deg, ${bg.from}, ${bg.to})` }} />
  }
  /* the dim sits in its own stacking context directly over the photo, so
     nothing in the layout can paint between the two */
  return (
    <div aria-hidden style={{ ...base, isolation: 'isolate', pointerEvents: 'none', overflow: 'hidden' }}>
      {bg.url
        ? <img src={bg.url} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ width: '100%', height: '100%', background: 'var(--surface-2, #15161b)' }} />}
      {(bg.dim ?? 0) > 0 && (
        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${bg.dim})` }} />
      )}
    </div>
  )
}

const STATIC_CTX = { clicks: 9999, isStatic: true }

/* one broken slide must never take down the whole editor */
class SlideBoundary extends Component<{ children: RN }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { err: String(e) } }
  componentDidUpdate(prev: { children: RN }) {
    if (this.state.err && prev.children !== this.props.children) this.setState({ err: null })
  }
  render() {
    if (this.state.err) {
      return (
        <div className="slide center">
          <div className="kicker" style={{ marginBottom: 12 }}>This slide hit an error</div>
          <p className="subhead" style={{ maxWidth: '46ch' }}>{this.state.err}</p>
        </div>
      )
    }
    return this.props.children
  }
}

const ENTRANCES: Record<string, Variants> = {
  rise: { initial: { opacity: 0, y: 34 }, animate: { opacity: 1, y: 0 } },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  zoom: { initial: { opacity: 0, scale: 0.94 }, animate: { opacity: 1, scale: 1 } },
}

export default function SlideView({
  slide, editable = false,
}: {
  slide: SlideData
  editable?: boolean
  /* read by the Deck engine off this element's props: */
  notes?: string
  transition?: string
}) {
  const parent = useDeck()
  const live = !parent.isStatic
  const mode = slide.animation ?? 'cascade'
  // universal per-slide text scale (props.scale: 'lg' | 'xl') — compensated
  // zoom, so content reflows larger inside the same frame
  const zoom = slide.props?.scale === 'xl' ? 1.3 : slide.props?.scale === 'lg' ? 1.15 : 1

  let content: ReactNode = <SlideBoundary><RenderLayout slide={slide} /></SlideBoundary>
  if (live && mode !== 'cascade') {
    // suppress the per-layout staggers; the slide enters as one (or instantly)
    content = <DeckCtx.Provider value={STATIC_CTX}>{content}</DeckCtx.Provider>
    if (mode !== 'none') {
      const v = ENTRANCES[mode] ?? ENTRANCES.fade
      content = (
        <motion.div
          style={{ width: '100%', height: '100%' }}
          variants={v}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {content}
        </motion.div>
      )
    }
  }

  return (
    <EditCtx.Provider value={{ editable, slideId: slide.id, slide }}>
      <div className="slide-view" style={{ position: 'relative', width: '100%', height: '100%' }}>
        <BackgroundLayer bg={slide.background} />
        <div
          style={{
            position: 'relative', zIndex: 1,
            width: `${100 / zoom}%`, height: `${100 / zoom}%`,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: 'top left',
          }}
        >
          {content}
        </div>
      </div>
    </EditCtx.Provider>
  )
}
