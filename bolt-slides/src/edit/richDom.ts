import { balanceLines, COLOR_RE } from './rich';

const INSPECTOR_PASSTHROUGH = new Set([
  'data-bolt-visual-edit-text',
  'data-bolt-visual-edit-link',
  'data-bolt-visual-edit-list',
]);

const INSPECTOR_SKIP = new Set([
  'data-bolt-visual-edit-marker',
  'data-bolt-inspector',
]);

function isInspectorPassthrough(el: HTMLElement) {
  for (const attr of INSPECTOR_PASSTHROUGH) {
    if (el.hasAttribute(attr)) return true;
  }

  return false;
}

function isInspectorChrome(el: HTMLElement) {
  for (const attr of INSPECTOR_SKIP) {
    if (el.hasAttribute(attr)) return true;
  }

  return false;
}

/** Inverse of `renderRich` / `richToHtml`. Inspector wrappers are transparent. */
export function serializeRichNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';

  if (!(node instanceof HTMLElement)) return '';

  if (node.tagName === 'BR') return '\n';

  if (isInspectorChrome(node)) return '';

  const inner = Array.from(node.childNodes).map(serializeRichNode).join('');

  if (isInspectorPassthrough(node)) return inner;

  if (!inner) return node.tagName === 'DIV' || node.tagName === 'P' ? '\n' : '';

  if (node.dataset.align) return `{a:${node.dataset.align}}${inner}`;

  if (node.dataset.color && COLOR_RE.test(node.dataset.color))
    return `{c:${node.dataset.color}}${inner}{/c}`;

  if (node.dataset.fs) return `{s:${node.dataset.fs}}${inner}{/s}`;

  if (node.classList.contains('accent-text')) return `==${inner}==`;

  if (node.tagName === 'STRONG' || node.tagName === 'B') return `**${inner}**`;

  if (node.tagName === 'EM' || node.tagName === 'I') return `_${inner}_`;

  if (node.dataset.size === 'up') return `++${inner}++`;

  if (node.dataset.size === 'down') return `~~${inner}~~`;

  if (node.tagName === 'DIV' || node.tagName === 'P') return '\n' + inner;

  return inner;
}

export function serializeRichRoot(el: HTMLElement): string {
  let raw = balanceLines(
    Array.from(el.childNodes)
      .map(serializeRichNode)
      .join('')
      .replace(/^\n/, '')
      .replace(/\n$/, '')
  );
  const am = raw.match(/\{a:([lcr])\}/);

  if (am) raw = `{a:${am[1]}}` + raw.replace(/\{a:[lcr]\}/g, '');

  return raw;
}

/** Code windows split source into highlighted lines; round-trip the visible text. */
export function serializeCodeRoot(el: HTMLElement): string {
  const lines = el.querySelectorAll('.cw-code');

  if (lines.length) {
    return Array.from(lines)
      .map((line) => {
        const text = (line.textContent ?? '').replace(/\u00a0/g, ' ');

        return text === ' ' ? '' : text;
      })
      .join('\n');
  }

  const body = el.querySelector('.cw-body') ?? el.querySelector('pre') ?? el;

  return (body.textContent ?? '').replace(/\u00a0/g, ' ');
}
