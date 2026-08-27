/* Export — PDF of the whole deck.
   Slides are responsive (vw/vh-driven type), so each one is rendered inside
   an off-screen IFRAME at the exact target size, then rasterized.

   SVG foreignObject cannot paint background-clip:text (accent, figures),
   so those runs compute to transparent and vanish. Flatten them to a solid
   color in the iframe before snapshot. Do not inline all computed styles or
   move the tree into the parent — that produced empty black pages. */
import { createRoot } from 'react-dom/client';
import { toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { SlideData } from '../data/types';
import SlideView from '../slide/SlideView';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function yieldToUi() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

const YIELD_BUDGET_MS = 8;

async function yieldIfDue(state: { t: number }) {
  if (performance.now() - state.t < YIELD_BUDGET_MS) return;
  await yieldToUi();
  state.t = performance.now();
}

function opaqueColor(c: string): string | null {
  if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return null;
  const m = c.match(
    /rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/
  );
  if (m && Number(m[1]) < 0.01) return null;
  return c;
}

function paintColor(cs: CSSStyleDeclaration): string | null {
  return (
    opaqueColor(cs.backgroundColor) ||
    cs.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/)?.[0] ||
    null
  );
}

async function flattenClipText(root: HTMLElement, view: Window) {
  const Html = (view as unknown as { HTMLElement: typeof HTMLElement })
    .HTMLElement;
  const due = { t: performance.now() };
  const walk = async (node: Element) => {
    if (node instanceof Html) {
      const cs = view.getComputedStyle(node);
      const clip = `${cs.getPropertyValue('-webkit-background-clip')} ${
        cs.backgroundClip
      }`;
      if (clip.includes('text')) {
        const fill = paintColor(cs);
        if (fill) {
          node.style.backgroundImage = 'none';
          node.style.backgroundColor = 'transparent';
          node.style.setProperty('-webkit-background-clip', 'border-box');
          node.style.backgroundClip = 'border-box';
          node.style.color = fill;
          node.style.setProperty('-webkit-text-fill-color', fill);
        }
      }
    }
    const kids = Array.from(node.children);
    for (const child of kids) {
      await yieldIfDue(due);
      await walk(child);
    }
  };
  await walk(root);
}

function loadSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      img
        .decode()
        .catch(() => undefined)
        .then(() => resolve(img));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function canvasPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png'
    );
  });
}

async function rasterSlide(
  slide: SlideData,
  w: number,
  h: number,
  pixelRatio: number
): Promise<HTMLCanvasElement> {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-100000px;top:0;width:${w}px;height:${h}px;border:0;`;
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    const view = iframe.contentWindow!;
    // carry the app's styles (Vite-injected <style> + any stylesheet links) over
    document.head
      .querySelectorAll('style, link[rel="stylesheet"]')
      .forEach((n) => {
        doc.head.appendChild(n.cloneNode(true));
      });
    /* applyAccent / applyFont write --accent, --primary, and the font tokens
       onto the live <html> style. Cloned sheets only have tokens.css defaults,
       so without this a themed deck exports as Bolt blue / Inter. */
    doc.documentElement.style.cssText = document.documentElement.style.cssText;
    doc.body.style.margin = '0';
    const mount = doc.createElement('div');
    mount.style.cssText = `width:${w}px;height:${h}px;`;
    doc.body.appendChild(mount);

    const root = createRoot(mount);
    root.render(<SlideView slide={slide} />); // default contexts → fully static
    await sleep(60);
    try {
      await (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts
        ?.ready;
    } catch {
      /* offline fonts are fine */
    }
    await Promise.all(
      Array.from(doc.images).map((img) =>
        img.complete
          ? null
          : new Promise((r) => {
              img.onload = img.onerror = r;
            })
      )
    );
    await sleep(240); // let canvases (globe) and charts paint
    await yieldToUi();

    await flattenClipText(mount, view);
    await yieldToUi();

    const bg = getComputedStyle(document.body).backgroundColor;
    const svg = await toSvg(mount, {
      width: w,
      height: h,
      pixelRatio,
      backgroundColor: bg,
    });
    await yieldToUi();

    const img = await loadSvgImage(svg);
    await yieldToUi();

    const canvas = document.createElement('canvas');
    canvas.width = w * pixelRatio;
    canvas.height = h * pixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    await yieldToUi();

    root.unmount();
    return canvas;
  } finally {
    iframe.remove();
  }
}

export async function exportPdf(
  slides: SlideData[],
  title: string,
  onProgress: (msg: string) => void
): Promise<void> {
  const W = 1280,
    H = 720;
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [W, H],
    compress: true,
  });
  for (let i = 0; i < slides.length; i++) {
    onProgress(`Rendering slide ${i + 1} / ${slides.length}…`);
    await yieldToUi();
    const canvas = await rasterSlide(slides[i], W, H, 2);
    const blob = await canvasPngBlob(canvas);
    await yieldToUi();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (i > 0) pdf.addPage([W, H], 'landscape');
    pdf.addImage(bytes, 'PNG', 0, 0, W, H);
  }
  onProgress('Writing PDF…');
  await yieldToUi();
  pdf.save(
    `${(title || 'deck').replace(/[^\w\- ]+/g, '').trim() || 'deck'}.pdf`
  );
}
