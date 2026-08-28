import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { renderRich, richToHtml } from './rich';

/* Speaker-notes markup: plain text in deck.json, read-only in the presenter
   console, and the serialization target for NotesEditor.

     # heading        - bullet        1. numbered
     > callout        **bold**        _italic_        ==accent==        `code`
*/

export type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'h'; lines: string[] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

export function parseNotes(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ kind: 'p', lines: para });
      para = [];
    }
  };
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const head = /^\s*(#{1,3})\s+(.*)$/.exec(line);
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (!line.trim()) {
      flush();
      continue;
    }
    if (head) {
      flush();
      blocks.push({ kind: 'h', lines: [head[2]] });
      continue;
    }
    if (quote) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last && last.kind === 'quote') last.lines.push(quote[1]);
      else blocks.push({ kind: 'quote', lines: [quote[1]] });
      continue;
    }
    if (bullet || num) {
      flush();
      const kind: 'ul' | 'ol' = bullet ? 'ul' : 'ol';
      const last = blocks[blocks.length - 1];
      const item = (bullet ?? num)![1];
      if (
        last &&
        (last.kind === 'ul' || last.kind === 'ol') &&
        last.kind === kind
      )
        last.items.push(item);
      else
        blocks.push(
          kind === 'ul'
            ? { kind: 'ul', items: [item] }
            : { kind: 'ol', items: [item] }
        );
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/* Notes speak the deck's rich marks plus two of their own: `code`, and
   {hl:#rrggbbaa}…{/hl} for highlighter (the deck has no highlight mark —
   notes do, because that is how people mark up what they'll say). */
const HL_TOKEN = /(\{hl:[^}]+\}[\s\S]*?\{\/hl\})/g;
const HL_ONE = /^\{hl:([^}]+)\}([\s\S]*)\{\/hl\}$/;
const HEX = /^#[0-9a-fA-F]{3,8}$/;

function inlineCode(text: string): ReactNode {
  return text.split(/(`[^`]+`)/g).map((seg, i) =>
    seg.startsWith('`') && seg.endsWith('`') && seg.length > 2 ? (
      <code className="note-code" key={i}>
        {seg.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{renderRich(seg)}</Fragment>
    )
  );
}
function inline(text: string): ReactNode {
  return text.split(HL_TOKEN).map((seg, i) => {
    const m = HL_ONE.exec(seg);
    if (m && HEX.test(m[1]))
      return (
        <mark className="note-hl" key={i} style={{ background: m[1] }}>
          {inlineCode(m[2])}
        </mark>
      );
    return <Fragment key={i}>{inlineCode(seg)}</Fragment>;
  });
}

export function NotesView({ text }: { text: string }) {
  const blocks = parseNotes(text);
  if (!blocks.length) return null;
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === 'h')
          return (
            <h3 className="note-h" key={i}>
              {inline(b.lines[0])}
            </h3>
          );
        if (b.kind === 'quote')
          return (
            <blockquote className="note-quote" key={i}>
              {b.lines.map((l, j) => (
                <p key={j}>{inline(l)}</p>
              ))}
            </blockquote>
          );
        if (b.kind === 'ul')
          return (
            <ul className="note-list" key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{inline(it)}</li>
              ))}
            </ul>
          );
        if (b.kind === 'ol')
          return (
            <ol className="note-list" key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{inline(it)}</li>
              ))}
            </ol>
          );
        return (
          <p className="note-p" key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

const codeHtml = (s: string) =>
  s
    .split(/(`[^`]+`)/g)
    .map((seg) =>
      seg.startsWith('`') && seg.endsWith('`') && seg.length > 2
        ? `<code>${richToHtml(seg.slice(1, -1))}</code>`
        : richToHtml(seg)
    )
    .join('');
const codeToHtml = (s: string) =>
  s
    .split(HL_TOKEN)
    .map((seg) => {
      const m = HL_ONE.exec(seg);
      return m && HEX.test(m[1])
        ? `<span data-hl="${m[1]}" class="note-hl" style="background:${
            m[1]
          }">${codeHtml(m[2])}</span>`
        : codeHtml(seg);
    })
    .join('');

export function notesToHtml(text: string): string {
  const blocks = parseNotes(text);
  if (!blocks.length) return '<div><br></div>';
  return blocks
    .map((b) => {
      if (b.kind === 'h') return `<h3>${codeToHtml(b.lines[0])}</h3>`;
      if (b.kind === 'quote')
        return `<blockquote>${b.lines
          .map(codeToHtml)
          .join('<br>')}</blockquote>`;
      if (b.kind === 'ul')
        return `<ul>${b.items
          .map((i) => `<li>${codeToHtml(i)}</li>`)
          .join('')}</ul>`;
      if (b.kind === 'ol')
        return `<ol>${b.items
          .map((i) => `<li>${codeToHtml(i)}</li>`)
          .join('')}</ol>`;
      return `<div>${b.lines.map(codeToHtml).join('<br>')}</div>`;
    })
    .join('');
}

/* the edited DOM back to plain text with markers */
function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
  if (!(node instanceof HTMLElement)) return '';
  if (node.tagName === 'BR') return '\n';
  const inner = Array.from(node.childNodes).map(inlineText).join('');
  if (!inner.trim()) return inner;
  const tag = node.tagName;
  if (tag === 'STRONG' || tag === 'B') return `**${inner}**`;
  if (tag === 'EM' || tag === 'I') return `_${inner}_`;
  if (tag === 'CODE') return '`' + inner + '`';
  if (node.classList.contains('accent-text')) return `==${inner}==`;
  if (node.dataset.hl && HEX.test(node.dataset.hl))
    return `{hl:${node.dataset.hl}}${inner}{/hl}`;
  if (node.dataset.color && HEX.test(node.dataset.color))
    return `{c:${node.dataset.color}}${inner}{/c}`;
  return inner;
}
const prefixLines = (s: string, p: string) =>
  s
    .split('\n')
    .map((l) => p + l)
    .join('\n');

export function htmlToNotes(root: HTMLElement): string {
  const out: string[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.nodeValue ?? '';
      if (t.trim()) out.push(t.trim());
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    const tag = node.tagName;
    if (/^H[1-6]$/.test(tag)) {
      out.push('# ' + inlineText(node).trim());
      continue;
    }
    if (tag === 'BLOCKQUOTE') {
      out.push(prefixLines(inlineText(node).trim(), '> '));
      continue;
    }
    if (tag === 'UL' || tag === 'OL') {
      const items = Array.from(node.querySelectorAll(':scope > li'));
      out.push(
        items
          .map(
            (li, i) =>
              (tag === 'UL' ? '- ' : `${i + 1}. `) +
              inlineText(li).replace(/\n/g, ' ').trim()
          )
          .join('\n')
      );
      continue;
    }
    out.push(inlineText(node));
  }
  /* Each top-level element is its own PARAGRAPH, so blocks join with a blank
     line — the format's paragraph separator. Joining with a single newline
     (as this used to) made every paragraph merge back into one on save, which
     read as "my line breaks got eaten". A <br> inside a block stays a single
     newline: a soft break within one paragraph, which is exactly what it is. */
  return out
    .map((s) => s.replace(/^\n+|\n+$/g, '').replace(/[ \t]+$/gm, ''))
    .filter((s) => s.length)
    .join('\n\n')
    .trim();
}
