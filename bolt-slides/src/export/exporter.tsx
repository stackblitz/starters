import { createRoot } from 'react-dom/client';
import { getFontEmbedCSS, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { SlideData } from '../data/types';
import SlideView from '../slide/SlideView';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const W = 1280;
const H = 720;
const PIXEL_RATIO = 1;

function yieldToUi() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

const YIELD_BUDGET_MS = 8;

async function yieldIfDue(state: { lastYieldAt: number }) {
  if (performance.now() - state.lastYieldAt < YIELD_BUDGET_MS) return;

  await yieldToUi();
  state.lastYieldAt = performance.now();
}

function logSlow(stage: string, ms: number) {
  if (ms < 200) return;

  console.info(`[pdf] ${stage} ${Math.round(ms)}ms`);
}

function opaqueColor(color: string): string | null {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)')
    return null;

  const match = color.match(
    /rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/
  );

  if (match && Number(match[1]) < 0.01) return null;

  return color;
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
  const due = { lastYieldAt: performance.now() };
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

const FONT_SHEET = /fonts\.google(?:apis)?\.com|fonts\.gstatic\.com/;

async function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function inlineFontSrc(
  cssText: string,
  baseUrl: string
): Promise<string> {
  const locs = cssText.match(/url\([^)]+\)/g) ?? [];
  let out = cssText;

  for (const loc of locs) {
    const raw = loc.replace(/^url\((['"]?)(.+)\1\)$/, '$2');

    if (raw.startsWith('data:')) continue;

    try {
      const href = new URL(raw, baseUrl).href;
      const res = await fetch(href);

      if (!res.ok) continue;

      const data = await blobDataUrl(await res.blob());

      out = out.replaceAll(loc, `url(${data})`);
    } catch {
      /* offline / CORS — leave the remote url */
    }
  }

  return out;
}

function googleFontUrls(): string[] {
  const urls = new Set<string>();

  document.querySelectorAll('link[rel="stylesheet"]').forEach((n) => {
    const href = (n as HTMLLinkElement).href;

    if (href && FONT_SHEET.test(href)) urls.add(href);
  });

  for (const el of document.querySelectorAll('style')) {
    const text = el.textContent ?? '';

    for (const m of text.matchAll(
      /@import\s+(?:url\(\s*)?['"]?([^'")\s]+)['"]?\s*\)?/g
    )) {
      if (FONT_SHEET.test(m[1])) urls.add(m[1]);
    }
  }

  return [...urls];
}

async function collectFontEmbedCSS(): Promise<string> {
  const chunks: string[] = [];

  try {
    const fromLib = await getFontEmbedCSS(document.body);

    if (fromLib.trim()) chunks.push(fromLib);
  } catch {
    /* sheet.cssRules is often opaque for Google Fonts */
  }

  for (const url of googleFontUrls()) {
    try {
      const css = await (await fetch(url)).text();

      chunks.push(await inlineFontSrc(css, url));
    } catch {
      /* preview may be offline */
    }
  }

  return chunks.join('\n');
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

function canvasJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.92
    );
  });
}

async function rasterSlide(
  slide: SlideData,
  fontEmbedCSS: string,
  index: number
): Promise<HTMLCanvasElement> {
  const iframe = document.createElement('iframe');

  iframe.style.cssText = `position:fixed;left:-100000px;top:0;width:${W}px;height:${H}px;border:0;`;
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument!;
    const view = iframe.contentWindow!;

    document.head
      .querySelectorAll('style, link[rel="stylesheet"]')
      .forEach((n) => {
        doc.head.appendChild(n.cloneNode(true));
      });
    doc.documentElement.style.cssText = document.documentElement.style.cssText;

    if (fontEmbedCSS) {
      const faces = doc.createElement('style');

      faces.textContent = fontEmbedCSS;
      doc.head.appendChild(faces);
    }

    doc.body.style.margin = '0';

    const mount = doc.createElement('div');

    mount.style.cssText = `width:${W}px;height:${H}px;`;
    doc.body.appendChild(mount);

    const root = createRoot(mount);

    root.render(<SlideView slide={slide} />);
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
    await sleep(240);
    await yieldToUi();
    await flattenClipText(mount, view);
    await yieldToUi();

    const bg = getComputedStyle(document.body).backgroundColor;
    const cloneAt = performance.now();
    const svg = await toSvg(mount, {
      width: W,
      height: H,
      pixelRatio: PIXEL_RATIO,
      backgroundColor: bg,
      fontEmbedCSS,
      skipFonts: true,
    });

    logSlow(`clone slide ${index + 1}`, performance.now() - cloneAt);
    await yieldToUi();

    const img = await loadSvgImage(svg);

    await yieldToUi();

    const canvas = document.createElement('canvas');

    canvas.width = W * PIXEL_RATIO;
    canvas.height = H * PIXEL_RATIO;

    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('2d context unavailable');

    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const drawAt = performance.now();

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    logSlow(`drawImage slide ${index + 1}`, performance.now() - drawAt);
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
  onProgress('Embedding fonts…');
  await yieldToUi();

  const fontEmbedCSS = await collectFontEmbedCSS();
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [W, H],
    compress: true,
  });

  for (let i = 0; i < slides.length; i++) {
    onProgress(`Rendering slide ${i + 1} / ${slides.length}…`);
    await yieldToUi();

    const canvas = await rasterSlide(slides[i], fontEmbedCSS, i);
    const encodeAt = performance.now();
    const blob = await canvasJpegBlob(canvas);

    logSlow(`toBlob slide ${i + 1}`, performance.now() - encodeAt);
    await yieldToUi();

    const bytes = new Uint8Array(await blob.arrayBuffer());

    if (i > 0) pdf.addPage([W, H], 'landscape');

    pdf.addImage(bytes, 'JPEG', 0, 0, W, H);
  }

  onProgress('Writing PDF…');
  await yieldToUi();
  pdf.save(
    `${(title || 'deck').replace(/[^\w\- ]+/g, '').trim() || 'deck'}.pdf`
  );
}
