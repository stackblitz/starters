// == ** _ {c:} {s:} (legacy ++ ~~)
import { Fragment, type ReactNode } from 'react';

const TOKEN =
  /(==[^=]+==|\*\*[^*]+\*\*|\+\+[^+]+\+\+|~~[^~]+~~|_[^_]+_|\{c:[^}]+\}[\s\S]+?\{\/c\}|\{s:[^}]+\}[\s\S]+?\{\/s\})/g;

export const ALIGNS: Record<string, 'left' | 'center' | 'right'> = {
  l: 'left',
  c: 'center',
  r: 'right',
};

function splitAlign(text: string): {
  align: 'l' | 'c' | 'r' | null;
  rest: string;
} {
  const m = text.match(/^\{a:([lcr])\}/);

  return m
    ? { align: m[1] as 'l' | 'c' | 'r', rest: text.slice(m[0].length) }
    : { align: null, rest: text };
}

export const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|accent)$/;

export const clampEm = (n: number) => Math.min(4, Math.max(0.4, n));

export const colorValue = (c: string) =>
  c === 'accent' ? 'var(--primary)' : c;

function braceParts(
  seg: string,
  tag: 'c' | 's'
): { value: string; inner: string } | null {
  const m = seg.match(
    new RegExp(`^\\{${tag}:([^}]+)\\}([\\s\\S]+)\\{\\/${tag}\\}$`)
  );

  return m ? { value: m[1], inner: m[2] } : null;
}

function renderLine(line: string): ReactNode {
  return line.split(TOKEN).map((seg, i) => {
    if (seg.startsWith('{c:')) {
      const p = braceParts(seg, 'c');

      if (p && COLOR_RE.test(p.value)) {
        return (
          <span
            key={i}
            data-color={p.value}
            style={{ color: colorValue(p.value) }}
          >
            {renderLine(p.inner)}
          </span>
        );
      }
    }

    if (seg.startsWith('{s:')) {
      const p = braceParts(seg, 's');
      const em = p ? clampEm(parseFloat(p.value)) : NaN;

      if (p && Number.isFinite(em)) {
        return (
          <span key={i} data-fs={em} style={{ fontSize: `${em}em` }}>
            {renderLine(p.inner)}
          </span>
        );
      }
    }

    if (seg.length >= 4) {
      if (seg.startsWith('==') && seg.endsWith('=='))
        return (
          <span key={i} className="accent-text">
            {renderLine(seg.slice(2, -2))}
          </span>
        );

      if (seg.startsWith('**') && seg.endsWith('**'))
        return <strong key={i}>{renderLine(seg.slice(2, -2))}</strong>;

      if (seg.startsWith('++') && seg.endsWith('++'))
        return (
          <span key={i} data-size="up" style={{ fontSize: '1.3em' }}>
            {renderLine(seg.slice(2, -2))}
          </span>
        );

      if (seg.startsWith('~~') && seg.endsWith('~~'))
        return (
          <span key={i} data-size="down" style={{ fontSize: '0.75em' }}>
            {renderLine(seg.slice(2, -2))}
          </span>
        );
    }

    if (seg.length >= 3 && seg.startsWith('_') && seg.endsWith('_'))
      return <em key={i}>{renderLine(seg.slice(1, -1))}</em>;

    return <Fragment key={i}>{seg}</Fragment>;
  });
}

const WRAPPED = /\{([cs]):([^}]+)\}([\s\S]*?)\{\/\1\}/g;
const NESTED_SIZE = /\{s:([^}]+)\}\{s:[^}]+\}([\s\S]*?)\{\/s\}\{\/s\}/g;

function flattenNestedSize(text: string): string {
  let prev = '';
  let cur = text;

  while (cur !== prev) {
    prev = cur;
    cur = cur.replace(NESTED_SIZE, '{s:$1}$2{/s}');
    cur = cur.replace(/\{\/s\}\{\/s\}/g, '{/s}');
  }

  return cur;
}

export function balanceLines(text: string): string {
  let out = flattenNestedSize(text);

  for (let pass = 0; pass < 3; pass++) {
    const next = out.replace(
      WRAPPED,
      (whole, tag: string, val: string, inner: string) =>
        inner.includes('\n')
          ? inner
              .split('\n')
              .map((line) => (line ? `{${tag}:${val}}${line}{/${tag}}` : ''))
              .join('\n')
          : whole
    );

    if (next === out) break;

    out = next;
  }

  return out;
}

export function renderRich(text: string | null | undefined): ReactNode {
  if (!text) return null;

  const { align, rest } = splitAlign(balanceLines(text));
  const body = rest.split('\n').map((line, li, lines) => (
    <Fragment key={li}>
      {renderLine(line)}
      {li < lines.length - 1 && <br />}
    </Fragment>
  ));

  if (!align) return body;

  return (
    <span
      data-align={align}
      style={{ display: 'block', textAlign: ALIGNS[align] }}
    >
      {body}
    </span>
  );
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function lineToHtml(line: string): string {
  return line
    .split(TOKEN)
    .map((seg) => {
      if (seg.startsWith('{c:')) {
        const p = braceParts(seg, 'c');

        if (p && COLOR_RE.test(p.value))
          return `<span data-color="${p.value}" style="color:${colorValue(
            p.value
          )}">${lineToHtml(p.inner)}</span>`;
      }

      if (seg.startsWith('{s:')) {
        const p = braceParts(seg, 's');
        const em = p ? clampEm(parseFloat(p.value)) : NaN;

        if (p && Number.isFinite(em))
          return `<span data-fs="${em}" style="font-size:${em}em">${lineToHtml(
            p.inner
          )}</span>`;
      }

      if (seg.length >= 4) {
        if (seg.startsWith('==') && seg.endsWith('=='))
          return `<span class="accent-text">${lineToHtml(
            seg.slice(2, -2)
          )}</span>`;

        if (seg.startsWith('**') && seg.endsWith('**'))
          return `<strong>${lineToHtml(seg.slice(2, -2))}</strong>`;

        if (seg.startsWith('++') && seg.endsWith('++'))
          return `<span data-size="up" style="font-size:1.3em">${lineToHtml(
            seg.slice(2, -2)
          )}</span>`;

        if (seg.startsWith('~~') && seg.endsWith('~~'))
          return `<span data-size="down" style="font-size:0.75em">${lineToHtml(
            seg.slice(2, -2)
          )}</span>`;
      }

      if (seg.length >= 3 && seg.startsWith('_') && seg.endsWith('_'))
        return `<em>${lineToHtml(seg.slice(1, -1))}</em>`;

      return esc(seg);
    })
    .join('');
}

export function richToHtml(text: string | null | undefined): string {
  if (!text) return '';

  const { align, rest } = splitAlign(balanceLines(text));
  const body = rest.split('\n').map(lineToHtml).join('<br>');

  if (!align) return body;

  return `<span data-align="${align}" style="display:block;text-align:${ALIGNS[align]}">${body}</span>`;
}

export function stripRich(text: string): string {
  let prev = '';
  let cur = text.replace(/\{a:[lcr]\}/g, '');

  while (cur !== prev) {
    prev = cur;
    cur = cur.replace(TOKEN, (m) => {
      if (m.startsWith('{c:')) return braceParts(m, 'c')?.inner ?? m;

      if (m.startsWith('{s:')) return braceParts(m, 's')?.inner ?? m;

      return m.startsWith('_') ? m.slice(1, -1) : m.slice(2, -2);
    });
  }

  return cur;
}
