/* Stroke model, persistence, and content-anchored geometry for Annotator.
   The React layer (toolbar, pointer, canvas paint) stays in Annotator.tsx. */

export type Tool =
  | 'pen'
  | 'highlighter'
  | 'laser'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'eraser';
/* x/y are relative to the stroke's anchor box (0..1); w = width factor */
export type Pt = { x: number; y: number; w?: number };
export type Stroke = {
  tool: Tool;
  color: string;
  size: number;
  points: Pt[];
  anchor?: string;
  /** the anchor's box as viewport fractions when the stroke was drawn — used
      to place the stroke if its anchor element can no longer be resolved */
  abox?: [number, number, number, number];
};
type Box = { left: number; top: number; width: number; height: number };
export type Trail = { x: number; y: number; t: number };

export const ERASER_R = 14;
export const LASER_LIFE = 650; // ms the trail lingers behind the dot

/* ── persistence (survives a reload, like presenter notes) ─────────── */
const LS_KEY = 'deck:annotations';
export function loadAnnotations(): Record<number, Stroke[]> {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    const out: Record<number, Stroke[]> = {};
    for (const k of Object.keys(raw))
      if (Array.isArray(raw[k])) out[Number(k)] = raw[k];
    return out;
  } catch {
    return {};
  }
}
export function saveAnnotations(store: Record<number, Stroke[]>) {
  try {
    const keep: Record<number, Stroke[]> = {};
    for (const k of Object.keys(store)) {
      const list = store[Number(k)].filter((s) => s.tool !== 'laser');
      if (list.length) keep[Number(k)] = list;
    }
    if (Object.keys(keep).length)
      localStorage.setItem(LS_KEY, JSON.stringify(keep));
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* quota / private mode — annotations just stay in memory */
  }
}

/* ── content anchoring ─────────────────────────────────────────────── */
export function slideStage() {
  return document.querySelector('.slide-stage');
}
export const viewportBox = (): Box => ({
  left: 0,
  top: 0,
  width: window.innerWidth,
  height: window.innerHeight,
});

/* child-index path from the stage root, e.g. "0.2.1" ("" = the stage itself) */
function pathOf(el: Element): string {
  const root = slideStage();
  const parts: number[] = [];
  let cur: Element | null = el;
  while (cur && cur !== root) {
    const parent: Element | null = cur.parentElement;
    if (!parent) return '';
    parts.unshift(Array.prototype.indexOf.call(parent.children, cur));
    cur = parent;
  }
  return cur === root ? parts.join('.') : '';
}
export function resolveAnchor(path?: string): Box | null {
  if (path === undefined) return null;
  const root = slideStage();
  if (!root) return null;
  let cur: Element = root;
  if (path !== '') {
    for (const i of path.split('.').map(Number)) {
      const next = cur.children[i];
      if (!next) return null;
      cur = next;
    }
  }
  const r = cur.getBoundingClientRect();
  return r.width > 4 && r.height > 4 ? r : null;
}
/* the block element under a client point (skipping the canvas + chrome) */
export function anchorAt(cx: number, cy: number): string {
  for (const el of document.elementsFromPoint(cx, cy)) {
    if (!el.closest('.slide-stage')) continue;
    let block: Element | null = el;
    while (
      block &&
      block !== slideStage() &&
      getComputedStyle(block).display === 'inline'
    )
      block = block.parentElement;
    return block ? pathOf(block) : '';
  }
  return '';
}
/* Anchor boxes are read once per frame, not once per stroke: a redraw with
   many strokes would otherwise fire a getBoundingClientRect per stroke and
   thrash layout while drawing. */
let boxCache: Map<string, Box> | null = null;

export function withStrokeBoxCache<T>(fn: () => T): T {
  boxCache = new Map();
  try {
    return fn();
  } finally {
    boxCache = null;
  }
}

/* the box a stroke's points are relative to, at the CURRENT layout: its
   anchor element if that still resolves, else the box it was drawn against
   (as viewport fractions), else the viewport */
function strokeBox(s: Stroke): Box {
  const key = s.anchor ?? '~';
  const cached = boxCache?.get(key);
  if (cached) return cached;
  const box = measureBox(s);
  boxCache?.set(key, box);
  return box;
}
function measureBox(s: Stroke): Box {
  const r = resolveAnchor(s.anchor);
  if (r) return r;
  if (s.abox) {
    const v = viewportBox();
    return {
      left: s.abox[0] * v.width,
      top: s.abox[1] * v.height,
      width: s.abox[2] * v.width,
      height: s.abox[3] * v.height,
    };
  }
  return viewportBox();
}
/* a stroke's points mapped to client pixels at the CURRENT layout */
export function clientPts(s: Stroke): Pt[] {
  const r = strokeBox(s);
  return s.points.map((p) => ({
    x: r.left + p.x * r.width,
    y: r.top + p.y * r.height,
    w: p.w,
  }));
}
/* a cheap fingerprint of where every anchor currently sits — while a slide
   animates in, this keeps changing; once it stops changing, the layout has
   settled and the ink is in its final place */
export function geometrySignature(list: Stroke[]): string {
  const v = viewportBox();
  let sig = `${v.width}x${v.height}`;
  const seen = new Set<string>();
  for (const s of list) {
    const key = s.anchor ?? '~';
    if (seen.has(key)) continue;
    seen.add(key);
    const r = measureBox(s);
    sig += `|${Math.round(r.left)},${Math.round(r.top)},${Math.round(
      r.width
    )},${Math.round(r.height)}`;
  }
  return sig;
}

/* ── geometry ──────────────────────────────────────────────────────── */
function distToSeg(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const dx = bx - ax,
    dy = by - ay;
  const len = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function outline(tool: Tool, pts: Pt[]): Pt[] {
  if (pts.length < 2) return pts;
  const a = pts[0],
    b = pts[pts.length - 1];
  if (tool === 'rect') return [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a];
  if (tool === 'ellipse') {
    const cx = (a.x + b.x) / 2,
      cy = (a.y + b.y) / 2,
      rx = Math.abs(b.x - a.x) / 2,
      ry = Math.abs(b.y - a.y) / 2;
    return Array.from({ length: 25 }, (_, i) => ({
      x: cx + rx * Math.cos((i / 24) * 2 * Math.PI),
      y: cy + ry * Math.sin((i / 24) * 2 * Math.PI),
    }));
  }
  return pts;
}
export function hits(s: Stroke, x: number, y: number, r: number) {
  const pts = outline(s.tool, clientPts(s));
  const w = s.tool === 'highlighter' ? s.size * 3.2 : s.size;
  if (pts.length === 1) return Math.hypot(pts[0].x - x, pts[0].y - y) < r + w;
  for (let i = 0; i < pts.length - 1; i++)
    if (
      distToSeg(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <
      r + w / 2
    )
      return true;
  return false;
}
/* shift-constrain: 45° steps for lines, a perfect square/circle for shapes */
export function constrain(tool: Tool, a: Pt, b: Pt): Pt {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  if (tool === 'line' || tool === 'arrow') {
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.hypot(dx, dy);
    return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
  }
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: a.x + Math.sign(dx || 1) * side,
    y: a.y + Math.sign(dy || 1) * side,
  };
}

/* ── cursors ───────────────────────────────────────────────────────── */
const svgCursor = (svg: string, cx: number, cy: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${cx} ${cy}, crosshair`;
export function cursorFor(tool: Tool, size: number, color: string) {
  if (tool === 'laser') {
    // an aiming reticle so you can place the beam before pressing
    const d = 22,
      c = d / 2;
    return svgCursor(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${c}" cy="${c}" r="7" fill="none" stroke="white" stroke-opacity="0.55" stroke-width="1.2"/><circle cx="${c}" cy="${c}" r="3.2" fill="${color}"/><circle cx="${c}" cy="${c}" r="1.2" fill="white"/></svg>`,
      c,
      c
    );
  }
  if (tool === 'eraser') {
    const d = ERASER_R * 2 + 4;
    return svgCursor(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${
        d / 2
      }" cy="${
        d / 2
      }" r="${ERASER_R}" fill="rgba(255,255,255,0.14)" stroke="white" stroke-width="1.5"/></svg>`,
      d / 2,
      d / 2
    );
  }
  if (tool === 'pen' || tool === 'highlighter') {
    const r = Math.max(3, (tool === 'highlighter' ? size * 3.2 : size) / 2);
    const d = Math.ceil(r * 2 + 4);
    return svgCursor(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${
        d / 2
      }" cy="${
        d / 2
      }" r="${r}" fill="${color}" fill-opacity="0.5" stroke="white" stroke-width="1.2"/></svg>`,
      d / 2,
      d / 2
    );
  }
  return 'crosshair';
}
