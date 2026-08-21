/* Export — PDF of the whole deck. Slides are responsive (vw/vh-driven type), so
   each one is rendered inside an off-screen IFRAME at the exact target size,
   then rasterized. */
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { SlideData } from '@/data/types';
import SlideView from '@/slide/SlideView';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function renderSlidePng(
  slide: SlideData,
  w: number,
  h: number,
  pixelRatio: number
): Promise<string> {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-100000px;top:0;width:${w}px;height:${h}px;border:0;`;
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
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

    const bg = getComputedStyle(document.body).backgroundColor;
    const png = await toPng(mount, {
      width: w,
      height: h,
      pixelRatio,
      backgroundColor: bg,
    });
    root.unmount();
    return png;
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
    const png = await renderSlidePng(slides[i], W, H, 2);
    if (i > 0) pdf.addPage([W, H], 'landscape');
    pdf.addImage(png, 'PNG', 0, 0, W, H);
  }
  onProgress('Writing PDF…');
  pdf.save(
    `${(title || 'deck').replace(/[^\w\- ]+/g, '').trim() || 'deck'}.pdf`
  );
}
