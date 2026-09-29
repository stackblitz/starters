import {
  Component,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode as RN,
} from 'react';
import { motion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';
import type { Background, SlideData } from '../data/types';
import { effectiveImageDim, slideHasImage } from '../data/imageDim';
import { DeckCtx, useDeck } from '../deck/DeckContext';
import { SlideScope } from '../copy/SlideScope';
import { RenderSlide } from './registry';
import { FALLBACK, stageUpscale } from './stage';

function BackgroundLayer({ bg }: { bg: Background | undefined }) {
  const base = { position: 'absolute', inset: 0, zIndex: 0 } as const;

  if (!bg || bg.type === 'none') {
    return <div aria-hidden style={{ ...base, background: 'var(--bg)' }} />;
  }

  if (bg.type === 'color')
    return <div aria-hidden style={{ ...base, background: bg.color }} />;

  if (bg.type === 'gradient') {
    return (
      <div
        aria-hidden
        style={{
          ...base,
          background: `linear-gradient(${bg.angle ?? 135}deg, ${bg.from}, ${
            bg.to
          })`,
        }}
      />
    );
  }

  return (
    <div
      aria-hidden
      style={{
        ...base,
        isolation: 'isolate',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {bg.url ? (
        <img
          src={bg.url}
          alt=""
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#15161b',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(0,0,0,${effectiveImageDim(bg.dim)})`,
        }}
      />
    </div>
  );
}

const STATIC_CTX = { clicks: 9999, isStatic: true };

function useStageUpscale<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [upscale, setUpscale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;

    if (!el) return;

    const apply = (width: number, height: number) =>
      setUpscale(stageUpscale(width, height));

    apply(el.clientWidth, el.clientHeight);

    if (typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries)
        apply(entry.contentRect.width, entry.contentRect.height);
    });

    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  return { ref, upscale };
}


class SlideBoundary extends Component<
  { children: RN },
  { err: string | null }
> {
  state = { err: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { err: String(error) };
  }

  componentDidUpdate(prev: { children: RN }) {
    if (this.state.err && prev.children !== this.props.children)
      this.setState({ err: null });
  }

  render() {
    if (this.state.err) {
      return (
        <div className="slide center" style={FALLBACK}>
          <div style={{ opacity: 0.6, marginBottom: 12 }}>
            This slide hit an error
          </div>
          <p style={{ maxWidth: '46ch' }}>{this.state.err}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const ENTRANCES: Record<string, Variants> = {
  rise: { initial: { opacity: 0, y: 34 }, animate: { opacity: 1, y: 0 } },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  zoom: {
    initial: { opacity: 0, scale: 0.94 },
    animate: { opacity: 1, scale: 1 },
  },
};

/* Dev-only guard: a paged slide cannot scroll, so any content that leaves
   the stage is simply not shown. Measure the live slide after its entrance
   settles and report offenders on the console, where Bolt's agent sees
   them. Decorative elements (no text, no media) are ignored so off-stage
   washes and blobs do not trip it. */
const OUT_OF_VIEW_TOLERANCE = 2;

function hasContent(el: Element): boolean {
  const tag = el.tagName;

  if (tag === 'IMG' || tag === 'VIDEO' || tag === 'svg' || tag === 'CANVAS')
    return true;

  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      return true;
  }

  return false;
}

function measureOutOfView(stage: HTMLElement) {
  const box = stage.getBoundingClientRect();
  let count = 0;
  let bottom = 0;
  let right = 0;
  let top = 0;
  let left = 0;

  for (const el of stage.querySelectorAll('*')) {
    if (!(el instanceof HTMLElement || el instanceof SVGElement)) continue;
    if (!hasContent(el)) continue;

    const r = el.getBoundingClientRect();

    if (r.width === 0 || r.height === 0) continue;

    const dBottom = r.bottom - box.bottom;
    const dRight = r.right - box.right;
    const dTop = box.top - r.top;
    const dLeft = box.left - r.left;

    if (
      dBottom > OUT_OF_VIEW_TOLERANCE ||
      dRight > OUT_OF_VIEW_TOLERANCE ||
      dTop > OUT_OF_VIEW_TOLERANCE ||
      dLeft > OUT_OF_VIEW_TOLERANCE
    ) {
      count++;
      bottom = Math.max(bottom, dBottom);
      right = Math.max(right, dRight);
      top = Math.max(top, dTop);
      left = Math.max(left, dLeft);
    }
  }

  return { count, bottom, right, top, left, box };
}

function useOutOfViewGuard(
  ref: React.RefObject<HTMLElement | null>,
  slide: SlideData,
  enabled: boolean,
  upscale: number
) {
  useEffect(() => {
    if (!enabled || !import.meta.env.DEV) return;

    const stage = ref.current;

    if (!stage) return;

    const timer = window.setTimeout(() => {
      const m = measureOutOfView(stage);

      if (!m.count) return;

      const sides = [
        m.bottom > OUT_OF_VIEW_TOLERANCE && `${Math.round(m.bottom / upscale)}px below`,
        m.right > OUT_OF_VIEW_TOLERANCE && `${Math.round(m.right / upscale)}px past the right edge`,
        m.top > OUT_OF_VIEW_TOLERANCE && `${Math.round(m.top / upscale)}px above`,
        m.left > OUT_OF_VIEW_TOLERANCE && `${Math.round(m.left / upscale)}px past the left edge`,
      ]
        .filter(Boolean)
        .join(', ');
      const w = Math.round(m.box.width / upscale);
      const h = Math.round(m.box.height / upscale);

      console.error(
        `[bolt-slides] Slide "${slide.id}" (src/slides/${slide.layout}.tsx) ` +
          `has content out of view: ${m.count} element${m.count === 1 ? '' : 's'} ` +
          `${sides} on a ${w}×${h} stage. A slide cannot scroll — anything ` +
          `outside the stage is not shown. Split the slide or resize its ` +
          `content; do not hide the overflow.`
      );
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [ref, slide, enabled, upscale]);
}

export default function SlideView({
  slide,
}: {
  slide: SlideData;
  notes?: string;
  transition?: string;
}) {
  const parent = useDeck();
  const live = !parent.isStatic;
  const mode = slide.animation ?? 'cascade';
  const { ref: stageRef, upscale } = useStageUpscale<HTMLDivElement>();

  useOutOfViewGuard(stageRef, slide, live, upscale);
  const textScale =
    slide.props?.scale === 'xl' ? 1.3 : slide.props?.scale === 'lg' ? 1.15 : 1;
  const zoom = textScale * upscale;
  let content: ReactNode = (
    <SlideBoundary>
      <RenderSlide slide={slide} />
    </SlideBoundary>
  );

  if (live && mode !== 'cascade') {
    content = <DeckCtx.Provider value={STATIC_CTX}>{content}</DeckCtx.Provider>;

    if (mode !== 'none') {
      const variants = ENTRANCES[mode] ?? ENTRANCES.fade;

      content = (
        <motion.div
          style={{ width: '100%', height: '100%' }}
          variants={variants}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {content}
        </motion.div>
      );
    }
  }

  return (
    <SlideScope.Provider value={{ slideId: slide.id, slide }}>
      <div
        ref={stageRef}
        className={'slide-view' + (slideHasImage(slide) ? ' has-image' : '')}
        data-deck-slide={slide.id}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <BackgroundLayer bg={slide.background} />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: 'top left',
            /* `cqw` / `cqh` and @container queries in slide components
               measure this box — the slide's own stage, not the window. */
            containerType: 'size',
            containerName: 'slide',
          }}
        >
          {content}
        </div>
      </div>
    </SlideScope.Provider>
  );
}
