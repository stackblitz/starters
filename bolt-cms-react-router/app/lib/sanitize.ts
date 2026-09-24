import DOMPurify from 'dompurify';

let hooked = false;

/**
 * Sanitize imported/edited HTML before rendering. Allows the tags WordPress
 * emits (figures, iframes for embeds, tables) while stripping scripts and
 * event handlers. Safe to call during SSR/prerender: returns the input
 * untouched when no DOM is available (the client re-sanitizes on hydrate).
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined' || !DOMPurify.isSupported) return html;

  if (!hooked) {
    hooked = true;
    // Only allow iframes from common embed providers.
    DOMPurify.addHook('uponSanitizeElement', (node, data) => {
      if (data.tagName !== 'iframe') return;
      const src = (node as Element).getAttribute('src') ?? '';
      if (
        !/^https:\/\/(www\.)?(youtube(-nocookie)?\.com|player\.vimeo\.com|open\.spotify\.com|w\.soundcloud\.com|codepen\.io)\//.test(
          src
        )
      ) {
        node.parentNode?.removeChild(node);
      }
    });
    // Open external links safely.
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (
        node.tagName === 'A' &&
        (node as HTMLAnchorElement).target === '_blank'
      ) {
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe', 'figure', 'figcaption', 'video', 'source', 'audio'],
    ADD_ATTR: [
      'allow',
      'allowfullscreen',
      'frameborder',
      'loading',
      'srcset',
      'sizes',
      'controls',
      'poster',
      'target',
    ],
    FORBID_TAGS: ['style', 'script'],
  });
}
