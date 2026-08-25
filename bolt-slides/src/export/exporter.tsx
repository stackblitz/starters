/* Export — PDF of the whole deck, and the first slide → public/og.png.
   Slides are responsive (vw/vh-driven type), so each one is rendered inside
   an off-screen IFRAME at the exact target size, then rasterized.

   html-to-image reads styles via the PARENT window.getComputedStyle, which
   drops styling on iframe nodes, and SVG foreignObject cannot paint
   background-clip:text (accent / figures). We inline the iframe's computed
   styles, flatten clipped text to a solid color, move the tree into the
   parent document, then snapshot. */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { SlideData } from '../data/types';
import SlideView from '../slide/SlideView';
import { api } from '../data/store';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/* SVG foreignObject skips background-clip:text; the computed color is
   transparent so those runs vanish. Use the clipped fill as a real color. */
function flattenClipText(el: HTMLElement, cs: CSSStyleDeclaration) {
  const clip = `${cs.getPropertyValue('-webkit-background-clip')} ${
    cs.backgroundClip
  }`;
  if (!clip.includes('text')) return;
  const fill = paintColor(cs);
  if (!fill) return;
  el.style.setProperty('background-image', 'none');
  el.style.setProperty('background-color', 'transparent');
  el.style.setProperty('-webkit-background-clip', 'border-box');
  el.style.setProperty('background-clip', 'border-box');
  el.style.setProperty('color', fill);
  el.style.setProperty('-webkit-text-fill-color', fill);
}

function inlineComputed(root: HTMLElement, view: Window) {
  const Html = (view as unknown as { HTMLElement: typeof HTMLElement })
    .HTMLElement;
  const walk = (node: Element) => {
    if (node instanceof Html) {
      const cs = view.getComputedStyle(node);
      if (cs.cssText) node.style.cssText = cs.cssText;
      else {
        for (let i = 0; i < cs.length; i++) {
          const name = cs.item(i);
          node.style.setProperty(
            name,
            cs.getPropertyValue(name),
            cs.getPropertyPriority(name)
          );
        }
      }
      flattenClipText(node, view.getComputedStyle(node));
    }
    Array.from(node.children).forEach(walk);
  };
  walk(root);
}

function bakeCanvases(root: HTMLElement, doc: Document) {
  for (const canvas of Array.from(root.querySelectorAll('canvas'))) {
    try {
      const img = doc.createElement('img');
      img.src = canvas.toDataURL();
      img.alt = '';
      img.style.cssText = canvas.style.cssText;
      img.style.width = `${canvas.offsetWidth}px`;
      img.style.height = `${canvas.offsetHeight}px`;
      canvas.replaceWith(img);
    } catch {
      /* tainted canvas — leave it */
    }
  }
}

async function renderSlidePng(
  slide: SlideData,
  w: number,
  h: number,
  pixelRatio: number
): Promise<string> {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-100000px;top:0;width:${w}px;height:${h}px;border:0;`;
  document.body.appendChild(iframe);
  let host: HTMLElement | null = null;
  try {
    const doc = iframe.contentDocument!;
    const view = iframe.contentWindow!;
    // carry the app's styles (Vite-injected <style> + any stylesheet links) over
    document.head
      .querySelectorAll('style, link[rel="stylesheet"]')
      .forEach((n) => {
        doc.head.appendChild(n.cloneNode(true));
      });
    doc.body.style.margin = '0';
    const mount = doc.createElement('div');
    mount.style.cssText = `width:${w}px;height:${h}px;`;
    doc.body.appendChild(mount);

    const root = createRoot(mount);
    flushSync(() => {
      root.render(<SlideView slide={slide} />); // default contexts → fully static
    });
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

    bakeCanvases(mount, doc);
    inlineComputed(mount, view);

    host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-100000px;top:0;width:${w}px;height:${h}px;overflow:hidden;`;
    host.appendChild(document.importNode(mount, true));
    document.body.appendChild(host);

    const bg =
      opaqueColor(view.getComputedStyle(doc.body).backgroundColor) ||
      getComputedStyle(document.body).backgroundColor;
    const png = await toPng(host, {
      width: w,
      height: h,
      pixelRatio,
      backgroundColor: bg,
    });
    root.unmount();
    return png;
  } finally {
    host?.remove();
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
    const png = await renderSlidePng(slides[i], W, H, 2);
    if (i > 0) pdf.addPage([W, H], 'landscape');
    pdf.addImage(png, 'PNG', 0, 0, W, H);
  }
  onProgress('Writing PDF…');
  pdf.save(
    `${(title || 'deck').replace(/[^\w\- ]+/g, '').trim() || 'deck'}.pdf`
  );
}

/* First slide → /og.png (1200×630), wired to the OpenGraph tags in index.html. */
export async function updateOgImage(first: SlideData): Promise<void> {
  const png = await renderSlidePng(first, 1200, 630, 1);
  await api('/og', 'POST', { dataUrl: png });
}
