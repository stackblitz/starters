import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Pt,
  type Stroke,
  type Tool,
  type Trail,
  ERASER_R,
  LASER_LIFE,
  anchorAt,
  clientPts,
  constrain,
  cursorFor,
  geometrySignature,
  hits,
  resolveAnchor,
  saveAnnotations,
  slideStage,
  viewportBox,
  withStrokeBoxCache,
} from './annotationInk';

export type { Stroke, Tool } from './annotationInk';
export { loadAnnotations } from './annotationInk';

/* Annotation layer: a full-screen canvas + a floating tool bar.
   Tools: pen, highlighter, laser, line, arrow, rectangle, ellipse, eraser.
   Strokes are stored as data (per slide, in `store`) so they PERSIST on the
   slide they were made on, survive a reload, and undo / redo / stroke-erase
   work cleanly. The bar + drawing are only interactive when `active`;
   otherwise the canvas just displays the slide's saved annotations.

   INK: pen strokes are drawn as midpoint quadratics with a per-segment width
   that follows stylus pressure (or, for mouse/touch, speed — fast strokes run
   thinner) and tapers at both ends, so ink reads like ink rather than like a
   polyline. The highlighter is one flat translucent path (a single fill, so
   self-crossings don't darken). The laser is never stored: it fades away.

   CONTENT-ANCHORED: when a stroke is committed it is anchored to the block
   element under its center (stored as a child-index path from the slide
   stage) with coordinates relative to THAT element's box. Because the slide
   DOM is identical at every viewport — only CSS reflows it — the same path
   resolves on any screen, so a circle drawn around a stat on a laptop rings
   the same stat on a phone, wherever the layout moved it. Strokes over empty
   background anchor to the stage and scale with the viewport. */

const TOOLS: { id: Tool; label: string; key: string; path: string }[] = [
  {
    id: 'pen',
    label: 'Pen',
    key: 'P',
    path: 'M4 20h4L18 10a2 2 0 0 0-3-3L5 17z',
  },
  {
    id: 'highlighter',
    label: 'Highlighter',
    key: 'H',
    path: 'M4 20h5l8-8-4-4-9 9zM13 7l4 4',
  },
  {
    id: 'laser',
    label: 'Laser pointer',
    key: 'L',
    path: 'M12 3v3M12 18v3M3 12h3M18 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  },
  { id: 'line', label: 'Line', key: 'I', path: 'M5 19L19 5' },
  { id: 'arrow', label: 'Arrow', key: 'A', path: 'M6 18L18 6M18 6h-6M18 6v6' },
  { id: 'rect', label: 'Rectangle', key: 'R', path: 'M4 6h16v12H4z' },
  {
    id: 'ellipse',
    label: 'Ellipse',
    key: 'O',
    path: 'M12 6c4.5 0 8 2.7 8 6s-3.5 6-8 6-8-2.7-8-6 3.5-6 8-6z',
  },
  {
    id: 'eraser',
    label: 'Eraser',
    key: 'E',
    path: 'M8 18l-4-4a2 2 0 0 1 0-3l7-7a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3l-7 7zM7 17h11',
  },
];
const COLORS = [
  'var(--primary)',
  '#ffffff',
  '#ef4444',
  '#f5b73a',
  '#4aa8ff',
  '#c084fc',
];
const SIZES = [2, 4, 7, 12];

const Ico = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);
const IconUndo = () => <Ico d="M9 8L5 12l4 4M5 12h9a4 4 0 1 1 0 8h-3" />;
const IconRedo = () => <Ico d="M15 8l4 4-4 4M19 12h-9a4 4 0 1 0 0 8h3" />;
const IconTrash = () => <Ico d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13" />;
const IconDone = () => <Ico d="M5 12.5l4.5 4.5L19 7" />;

export default function Annotator({
  slide,
  store,
  active,
  onDone,
  hold = false,
}: {
  slide: number;
  store: Record<number, Stroke[]>;
  active: boolean;
  onDone?: () => void;
  /** true while the slide is still animating in — the ink stays hidden */
  hold?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  if (!store[slide]) store[slide] = [];
  const strokes = useRef<Stroke[]>(store[slide]);
  const draft = useRef<Stroke | null>(null); // draft points are raw client px
  const past = useRef<Stroke[][]>([]);
  const future = useRef<Stroke[][]>([]);
  const laser = useRef<Trail[]>([]);
  const laserRaf = useRef(0);
  const laserHeld = useRef(false);
  const raf = useRef(0);
  const lastIn = useRef<{ x: number; y: number; t: number; w: number } | null>(
    null
  );
  const penSeen = useRef(false); // once a stylus is used, ignore touch (palm rejection)
  const eraseBase = useRef<Stroke[] | null>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [styleOpen, setStyleOpen] = useState(false);
  const [drawingNow, setDrawingNow] = useState(false);
  // the ink never beats its slide in: it fades up once the slide's own
  // transition has finished, whatever that transition is
  const [inked, setInked] = useState(false);
  const [, forceHistory] = useState(0); // re-render so undo/redo enable states update
  const toolRef = useRef(tool),
    colorRef = useRef(color),
    sizeRef = useRef(size);
  toolRef.current = tool;
  colorRef.current = color;
  sizeRef.current = size;

  const resolve = (c: string) =>
    c.startsWith('var(')
      ? getComputedStyle(document.documentElement)
          .getPropertyValue('--primary')
          .trim() || '#4fe5b0'
      : c;

  /* ── painting ────────────────────────────────────────────────────── */
  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, s: Stroke, p: Pt[]) => {
      const n = p.length;
      if (!n) return;
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle = resolve(s.color);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = s.size;

      if (s.tool === 'pen') {
        if (n === 1) {
          ctx.beginPath();
          ctx.arc(p[0].x, p[0].y, Math.max(0.5, s.size / 2), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }
        // ends taper; each segment is a midpoint quadratic at its own width, so
        // pressure/speed reads as thick-and-thin ink without any seams
        const taper = (i: number) =>
          0.62 + 0.38 * Math.min(1, (i + 1) / 4, (n - i) / 4);
        for (let i = 0; i < n - 1; i++) {
          const a = p[i],
            b = p[i + 1];
          const from =
            i === 0
              ? a
              : { x: (p[i - 1].x + a.x) / 2, y: (p[i - 1].y + a.y) / 2 };
          const to = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          ctx.lineWidth = Math.max(
            0.6,
            s.size * (((a.w ?? 1) + (b.w ?? 1)) / 2) * taper(i)
          );
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.quadraticCurveTo(a.x, a.y, to.x, to.y);
          ctx.stroke();
        }
        const l = p[n - 1],
          pl = p[n - 2];
        ctx.lineWidth = Math.max(0.6, s.size * (l.w ?? 1) * 0.62);
        ctx.beginPath();
        ctx.moveTo((pl.x + l.x) / 2, (pl.y + l.y) / 2);
        ctx.lineTo(l.x, l.y);
        ctx.stroke();
        ctx.restore();
        return;
      }

      const a = p[0],
        b = p[n - 1];
      if (s.tool === 'highlighter') {
        // ONE path, filled once: overlapping parts of the same stroke stay flat
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = s.size * 3.2;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        for (let i = 1; i < n; i++) ctx.lineTo(p[i].x, p[i].y);
        if (n === 1) ctx.lineTo(a.x + 0.01, a.y);
        ctx.stroke();
        ctx.restore();
        return;
      }
      if (s.tool === 'line' || s.tool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        if (s.tool === 'arrow') {
          const ang = Math.atan2(b.y - a.y, b.x - a.x),
            h = 9 + s.size * 1.9;
          ctx.beginPath();
          ctx.moveTo(
            b.x - h * Math.cos(ang - 0.42),
            b.y - h * Math.sin(ang - 0.42)
          );
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(
            b.x - h * Math.cos(ang + 0.42),
            b.y - h * Math.sin(ang + 0.42)
          );
          ctx.stroke();
        }
      } else if (s.tool === 'rect') {
        const x = Math.min(a.x, b.x),
          y = Math.min(a.y, b.y),
          w = Math.abs(b.x - a.x),
          h = Math.abs(b.y - a.y);
        const r = Math.min(6, w / 2, h / 2);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
        ctx.stroke();
      } else if (s.tool === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(
          (a.x + b.x) / 2,
          (a.y + b.y) / 2,
          Math.abs(b.x - a.x) / 2,
          Math.abs(b.y - a.y) / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
      ctx.restore();
    },
    []
  );

  /* The beam is ONE tapered shape — a comet, not a row of dots: the trail is
     smoothed, offset to a left and a right edge whose half-width grows from
     the tail to the head, then filled in a single pass. No per-segment
     strokes, so no beads, no banding where segments overlap. */
  const paintLaser = useCallback(
    (ctx: CanvasRenderingContext2D, now: number) => {
      const raw = laser.current;
      if (!raw.length) return;
      const head = raw[raw.length - 1];
      const fade = 1 - Math.min(1, (now - head.t) / LASER_LIFE);
      if (fade <= 0) return;
      const c = resolve(colorRef.current);

      ctx.save();
      ctx.shadowColor = c;

      if (raw.length > 2) {
        // smooth the samples so the offsets can't flip on jittery input
        const sm = raw.map((p, i) => {
          const a = raw[Math.max(0, i - 1)],
            b = raw[Math.min(raw.length - 1, i + 1)];
          return { x: (a.x + 2 * p.x + b.x) / 4, y: (a.y + 2 * p.y + b.y) / 4 };
        });
        const n = sm.length;
        const left: { x: number; y: number }[] = [];
        const right: { x: number; y: number }[] = [];
        for (let i = 0; i < n; i++) {
          const p = sm[i],
            a = sm[Math.max(0, i - 1)],
            b = sm[Math.min(n - 1, i + 1)];
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len,
            ny = dx / len;
          // the tail keeps real body instead of thinning away to nothing
          const w = 4.2 * (0.42 + 0.58 * Math.pow(i / (n - 1), 0.7)); // tail → head
          left.push({ x: p.x + nx * w, y: p.y + ny * w });
          right.push({ x: p.x - nx * w, y: p.y - ny * w });
        }
        ctx.beginPath();
        ctx.moveTo(left[0].x, left[0].y);
        for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
        for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
        ctx.closePath();
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.92 * fade;
        ctx.shadowBlur = 16;
        ctx.fill();
      }

      // the dot itself: a soft halo, a solid core, a white centre
      ctx.globalAlpha = 0.5 * fade;
      ctx.shadowBlur = 26;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = fade;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    []
  );

  const redraw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
    withStrokeBoxCache(() => {
      // highlighter first, so ink always reads on top of the wash
      for (const s of strokes.current)
        if (s.tool === 'highlighter') paint(ctx, s, clientPts(s));
      for (const s of strokes.current)
        if (s.tool !== 'highlighter') paint(ctx, s, clientPts(s));
    });
    if (draft.current) paint(ctx, draft.current, draft.current.points);
    paintLaser(ctx, performance.now());
  }, [paint, paintLaser]);

  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      redraw();
    });
  }, [redraw]);

  /* ── history ─────────────────────────────────────────────────────── */
  const apply = useCallback(
    (next: Stroke[], record = true) => {
      if (record) {
        past.current.push(strokes.current);
        future.current = [];
      }
      strokes.current = next;
      store[slide] = next;
      saveAnnotations(store);
      forceHistory((v) => v + 1);
      schedule();
    },
    [schedule, slide, store]
  );

  const undo = useCallback(() => {
    if (!past.current.length) return;
    future.current.push(strokes.current);
    apply(past.current.pop()!, false);
  }, [apply]);
  const redo = useCallback(() => {
    if (!future.current.length) return;
    past.current.push(strokes.current);
    apply(future.current.pop()!, false);
  }, [apply]);
  const clear = useCallback(() => {
    if (strokes.current.length) apply([]);
  }, [apply]);

  /* one eraser drag = one undo step: the pre-drag state is banked on
     pointerdown and pushed to history once, when the drag ends */
  const erase = useCallback(
    (x: number, y: number) => {
      const next = withStrokeBoxCache(() =>
        strokes.current.filter((s) => !hits(s, x, y, ERASER_R))
      );
      if (next.length !== strokes.current.length) apply(next, false);
    },
    [apply]
  );

  /* ── laser animation loop (runs only while a trail is alive) ─────── */
  const pumpLaser = useCallback(() => {
    if (laserRaf.current) return;
    const step = () => {
      const now = performance.now();
      // held still with the button down: keep the dot alive, let the tail expire
      if (laserHeld.current && laser.current.length)
        laser.current[laser.current.length - 1].t = now;
      laser.current = laser.current.filter((p) => now - p.t < LASER_LIFE);
      redraw();
      laserRaf.current = laser.current.length ? requestAnimationFrame(step) : 0;
    };
    laserRaf.current = requestAnimationFrame(step);
  }, [redraw]);

  useEffect(() => {
    if (hold) {
      setInked(false);
      return;
    }
    const t = window.setTimeout(() => setInked(true), 110); // a beat behind the slide
    return () => clearTimeout(t);
  }, [hold]);

  /* ── canvas sizing + following the layout until it settles ───────── */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    let watchRaf = 0;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(window.innerWidth * dpr);
      cv.height = Math.round(window.innerHeight * dpr);
      cv.style.width = window.innerWidth + 'px';
      cv.style.height = window.innerHeight + 'px';
      redraw();
    };
    /* Coming back to a slide replays its entrance motion, so anchor boxes keep
       moving for a while (staggered reveals, transforms, late-loading images).
       Re-place the ink every frame until the geometry stops changing — that is
       what makes returning to a slide land the strokes exactly where they were
       drawn, rather than wherever the layout happened to be at a fixed delay. */
    const watch = () => {
      if (watchRaf) cancelAnimationFrame(watchRaf);
      let sig = '';
      let stableSince = 0;
      const start = performance.now();
      const tick = () => {
        const now = performance.now();
        const next = geometrySignature(strokes.current);
        if (next !== sig) {
          sig = next;
          stableSince = now;
          redraw();
        }
        // keep watching until it has held still for 250ms (2.5s ceiling)
        watchRaf =
          now - stableSince < 250 && now - start < 2500
            ? requestAnimationFrame(tick)
            : 0;
      };
      watchRaf = requestAnimationFrame(tick);
    };
    fit();
    watch();
    const ro = new ResizeObserver(() => {
      schedule();
      watch();
    });
    const st = slideStage();
    if (st) ro.observe(st);
    document.fonts?.ready.then(watch).catch(() => {});
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      if (watchRaf) cancelAnimationFrame(watchRaf);
      window.removeEventListener('resize', fit);
      if (raf.current) cancelAnimationFrame(raf.current);
      if (laserRaf.current) cancelAnimationFrame(laserRaf.current);
    };
  }, [redraw, schedule]);

  /* ── committing a stroke ─────────────────────────────────────────── */
  const commitDraft = useCallback(() => {
    const d = draft.current;
    draft.current = null;
    lastIn.current = null;
    if (!d || !d.points.length) {
      schedule();
      return;
    }
    // anchor to the content under the stroke's center, then store its points
    // relative to that element's box
    const xs = d.points.map((p) => p.x),
      ys = d.points.map((p) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    d.anchor = anchorAt(cx, cy);
    const r = resolveAnchor(d.anchor) ?? viewportBox();
    const v = viewportBox();
    d.abox = [
      r.left / v.width,
      r.top / v.height,
      r.width / v.width,
      r.height / v.height,
    ];
    d.points = d.points.map((p) => ({
      x: (p.x - r.left) / r.width,
      y: (p.y - r.top) / r.height,
      w: p.w,
    }));
    apply([...strokes.current, d]);
  }, [apply, schedule]);

  const endSession = useCallback(() => {
    setDrawingNow(false);
    laserHeld.current = false;
    const base = eraseBase.current;
    eraseBase.current = null;
    if (base && base !== strokes.current) {
      past.current.push(base);
      future.current = [];
      forceHistory((v) => v + 1);
    }
    if (draft.current) commitDraft();
  }, [commitDraft]);

  useEffect(() => {
    window.addEventListener('pointerup', endSession);
    window.addEventListener('pointercancel', endSession);
    return () => {
      window.removeEventListener('pointerup', endSession);
      window.removeEventListener('pointercancel', endSession);
    };
  }, [endSession]);

  // leaving draw mode mid-stroke still commits what was drawn
  useEffect(() => {
    if (!active) {
      endSession();
      setStyleOpen(false);
      laser.current = [];
    }
  }, [active, endSession]);

  // click anywhere else closes the style popover
  useEffect(() => {
    if (!styleOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.('.ann-style'))
        setStyleOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [styleOpen]);

  /* ── keyboard (only while drawing mode is on) ────────────────────── */
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'TEXTAREA' ||
          t.tagName === 'INPUT' ||
          t.isContentEditable)
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const hit = TOOLS.find((x) => x.key.toLowerCase() === k);
      if (hit) {
        e.preventDefault();
        setTool(hit.id);
        return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= COLORS.length) {
        e.preventDefault();
        setColor(COLORS[n - 1]);
        return;
      }
      if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        setSize(
          (s) =>
            SIZES[
              Math.max(
                0,
                Math.min(
                  SIZES.length - 1,
                  SIZES.indexOf(s) + (e.key === ']' ? 1 : -1)
                )
              )
            ]
        );
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        clear();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, undo, redo, clear]);

  /* ── input ───────────────────────────────────────────────────────── */
  /* width factor from stylus pressure, or from speed for mouse/touch
     (a fast stroke runs thinner), damped so it never steps */
  function widthFactor(e: {
    clientX: number;
    clientY: number;
    pressure: number;
    pointerType: string;
  }) {
    const now = performance.now();
    const prev = lastIn.current;
    let w: number;
    if (e.pointerType === 'pen' && e.pressure > 0 && e.pressure !== 0.5) {
      w = 0.35 + e.pressure * 1.05;
    } else if (prev) {
      const v =
        Math.hypot(e.clientX - prev.x, e.clientY - prev.y) /
        Math.max(4, now - prev.t); // px/ms
      w = 1.15 - Math.min(0.62, v * 0.5);
    } else w = 1;
    const damped = prev ? prev.w + (w - prev.w) * 0.4 : w;
    const clamped = Math.max(0.34, Math.min(1.35, damped));
    lastIn.current = { x: e.clientX, y: e.clientY, t: now, w: clamped };
    return clamped;
  }

  const ignore = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen') penSeen.current = true;
    return penSeen.current && e.pointerType === 'touch';
  };

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active || ignore(e) || e.button > 0) return;
    setInked(true); // drawing during the entrance shows immediately
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setStyleOpen(false);
    const t = toolRef.current;
    setDrawingNow(true);
    if (t === 'laser') {
      laserHeld.current = true;
      laser.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      pumpLaser();
      return;
    }
    if (t === 'eraser') {
      eraseBase.current = strokes.current;
      erase(e.clientX, e.clientY);
      return;
    }
    lastIn.current = null;
    draft.current = {
      tool: t,
      color: colorRef.current,
      size: sizeRef.current,
      points: [{ x: e.clientX, y: e.clientY, w: widthFactor(e) }],
    };
    schedule();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active || ignore(e)) return;
    const t = toolRef.current;
    if (t === 'laser') {
      // the beam only fires while the pointer is held down; the cursor
      // reticle is what you aim with before that
      if (!e.buttons || !laser.current.length) return;
      laser.current.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (laser.current.length > 160)
        laser.current.splice(0, laser.current.length - 160);
      pumpLaser();
      return;
    }
    if (t === 'eraser') {
      if (e.buttons) erase(e.clientX, e.clientY);
      return;
    }
    const d = draft.current;
    if (!d) return;
    if (d.tool === 'pen' || d.tool === 'highlighter') {
      // coalesced events keep every sample a high-rate stylus reported
      const evs = e.nativeEvent.getCoalescedEvents?.() ?? [];
      const pts = evs.length ? evs : [e.nativeEvent];
      for (const ev of pts) {
        const w = widthFactor({
          clientX: ev.clientX,
          clientY: ev.clientY,
          pressure: ev.pressure ?? 0.5,
          pointerType: e.pointerType,
        });
        d.points.push({ x: ev.clientX, y: ev.clientY, w });
      }
    } else {
      // hold Shift for 45° lines and perfect squares / circles
      const end = e.shiftKey
        ? constrain(d.tool, d.points[0], { x: e.clientX, y: e.clientY })
        : { x: e.clientX, y: e.clientY };
      d.points = [d.points[0], end];
    }
    schedule();
  }

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;
  const styleTool =
    tool === 'pen' ||
    tool === 'highlighter' ||
    tool === 'line' ||
    tool === 'arrow' ||
    tool === 'rect' ||
    tool === 'ellipse';

  return (
    <>
      <canvas
        ref={canvasRef}
        className="ann-canvas"
        style={{
          pointerEvents: active ? 'auto' : 'none',
          cursor: active ? cursorFor(tool, size, resolve(color)) : 'default',
          opacity: inked ? 1 : 0,
          transition: 'opacity 0.28s ease',
        }}
        onPointerDown={down}
        onPointerMove={move}
      />
      {active && (
        <div
          className={'ann-bar' + (drawingNow ? ' drawing' : '')}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="ann-group"
            role="radiogroup"
            aria-label="Annotation tool"
          >
            {TOOLS.map((t) => (
              <button
                key={t.id}
                className={'ann-btn' + (tool === t.id ? ' on' : '')}
                data-tip={`${t.label} (${t.key})`}
                role="radio"
                aria-checked={tool === t.id}
                aria-label={t.label}
                onClick={() => setTool(t.id)}
              >
                <Ico d={t.path} />
              </button>
            ))}
          </div>

          <span className="ann-sep" />

          <div className="ann-style">
            <button
              className={'ann-swatch' + (styleOpen ? ' on' : '')}
              data-tip="Color & size"
              aria-label="Color and size"
              aria-expanded={styleOpen}
              onClick={() => setStyleOpen((v) => !v)}
            >
              <span
                className="ann-swatch-dot"
                style={{
                  background: color,
                  width: Math.max(8, size + 4),
                  height: Math.max(8, size + 4),
                }}
              />
            </button>
            {styleOpen && (
              <div className="ann-pop">
                <div className="ann-pop-row">
                  {COLORS.map((c, i) => (
                    <button
                      key={c}
                      className={'ann-color' + (color === c ? ' on' : '')}
                      style={{ background: c }}
                      aria-label={`Color ${i + 1}`}
                      aria-pressed={color === c}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
                <div className="ann-pop-row ann-pop-sizes">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      className={'ann-size' + (size === s ? ' on' : '')}
                      aria-label={`Size ${s}`}
                      aria-pressed={size === s}
                      onClick={() => setSize(s)}
                    >
                      <span
                        style={{
                          width: s + 3,
                          height: s + 3,
                          background: color,
                        }}
                      />
                    </button>
                  ))}
                </div>
                <div className="ann-pop-hint">
                  {styleTool
                    ? '1–6 colors · [ ] size'
                    : 'Pick a drawing tool to use these'}
                </div>
              </div>
            )}
          </div>

          <span className="ann-sep" />

          <button
            className="ann-btn"
            data-tip={canUndo ? 'Undo (⌘Z)' : undefined}
            aria-label="Undo"
            disabled={!canUndo}
            onClick={undo}
          >
            <IconUndo />
          </button>
          <button
            className="ann-btn"
            data-tip={canRedo ? 'Redo (⇧⌘Z)' : undefined}
            aria-label="Redo"
            disabled={!canRedo}
            onClick={redo}
          >
            <IconRedo />
          </button>
          <button
            className="ann-btn"
            data-tip={strokes.current.length ? 'Clear slide (⌫)' : undefined}
            aria-label="Clear this slide"
            disabled={!strokes.current.length}
            onClick={clear}
          >
            <IconTrash />
          </button>
          {onDone && (
            <>
              <span className="ann-sep" />
              <button
                className="ann-btn ann-done"
                data-tip="Done (D)"
                aria-label="Exit drawing mode"
                onClick={onDone}
              >
                <IconDone />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
