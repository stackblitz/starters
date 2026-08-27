import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { renderRich, richToHtml } from './rich';

/* Speaker notes — authored in the studio popover, shown read-only in the
   presenter console.

   Notes are stored as plain text (the skill authors them, the CLI exports
   them, a human can read the file), but nobody types syntax: NotesEditor is a
   WYSIWYG contentEditable with a formatting bar, and it serializes back to
   that plain text on the way out. The convention is the one the rest of the
   deck already speaks:

     # heading        - bullet        1. numbered
     > callout        **bold**        _italic_        ==accent==        `code`
*/

/* ── text → blocks ─────────────────────────────────────────────────── */
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

/* ── read-only render ──────────────────────────────────────────────── */
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

/* ── text ⇄ editable HTML ──────────────────────────────────────────── */
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

/* ── the WYSIWYG ───────────────────────────────────────────────────── */
type Cmd = {
  id: string;
  label: string;
  hint: string;
  run: () => void;
  icon: ReactNode;
};
/* text colours, and highlighter washes (translucent, so the text stays legible
   on either surface) */
const TEXT_COLORS = [
  '#ffffff',
  '#ef4444',
  '#f5b73a',
  '#4fe5b0',
  '#4aa8ff',
  '#c084fc',
];
const HL_COLORS = [
  '#f5b73a55',
  '#4fe5b04d',
  '#4aa8ff4d',
  '#f472b64d',
  '#c084fc4d',
];
const svg = (d: string, extra?: ReactNode) => (
  <svg
    viewBox="0 0 20 20"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
    {extra}
  </svg>
);

export function NotesEditor({
  value,
  onChange,
  onDone,
  placeholder,
  style,
  className = '',
}: {
  value: string;
  onChange: (text: string) => void;
  onDone?: () => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const colorBtn = useRef<HTMLButtonElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const panned = useRef(false);

  const startPan = (e: React.PointerEvent) => {
    if (e.button > 0 || !bar.current) return;
    drag.current = { x: e.clientX, left: bar.current.scrollLeft };
    panned.current = false;
  };
  const pan = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !bar.current) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) {
      panned.current = true; // a drag, not a click on the button underneath
      bar.current.setPointerCapture?.(e.pointerId);
    }
    if (panned.current) bar.current.scrollLeft = d.left - dx;
  };
  const endPan = (e: React.PointerEvent) => {
    drag.current = null;
    bar.current?.releasePointerCapture?.(e.pointerId);
  };
  const [empty, setEmpty] = useState(!value.trim());
  // the palette is positioned in viewport space so the tool bar can scroll
  // sideways in a narrow panel without clipping it
  const [palette, setPalette] = useState<{ x: number; y: number } | null>(null);
  const paletteOpen = !!palette;
  const togglePalette = () => {
    if (palette) {
      setPalette(null);
      return;
    }
    const r = colorBtn.current?.getBoundingClientRect();
    if (r) setPalette({ x: r.left, y: r.bottom + 8 });
  };

  // uncontrolled while focused: set the HTML once per value change from outside
  useEffect(() => {
    const el = ref.current;
    if (!el || el.contains(document.activeElement)) return;
    el.innerHTML = notesToHtml(value);
    setEmpty(!value.trim());
  }, [value]);

  // clicking anywhere else closes the palette
  useEffect(() => {
    if (!paletteOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest?.('.note-wyg-pop') && !t?.closest?.('.note-wyg-colorbtn'))
        setPalette(null);
    };
    const close = () => setPalette(null);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', close);
    };
  }, [paletteOpen]);

  const commit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const text = htmlToNotes(el);
    setEmpty(!text.trim());
    if (text !== value) onChange(text);
  }, [onChange, value]);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    // tags, not inline styles — <b>/<i> are what the serializer reads
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(cmd, false, arg);
    commit();
  };
  /* wrap the selection in a styled span — the deck accent, or a specific
     colour, both of which the marker format already understands */
  const wrap = (open: string) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      ref.current?.focus();
      return;
    }
    const box = document.createElement('div');
    box.appendChild(sel.getRangeAt(0).cloneContents());
    document.execCommand('insertHTML', false, `${open}${box.innerHTML}</span>`);
    commit();
  };
  const accent = () => wrap('<span class="accent-text">');
  const paint = (hex: string) =>
    wrap(`<span data-color="${hex}" style="color:${hex}">`);
  const mark = (hex: string) =>
    wrap(`<span data-hl="${hex}" class="note-hl" style="background:${hex}">`);
  /* strip colour / accent / highlight from the selection, leaving bold, italic
     and the rest of the structure alone */
  const strip = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      ref.current?.focus();
      return;
    }
    const box = document.createElement('div');
    box.appendChild(sel.getRangeAt(0).cloneContents());
    box
      .querySelectorAll('[data-hl], [data-color], .accent-text')
      .forEach((el) => {
        el.replaceWith(...Array.from(el.childNodes));
      });
    document.execCommand('insertHTML', false, box.innerHTML);
    commit();
  };
  const code = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const t = sel
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    document.execCommand('insertHTML', false, `<code>${t}</code>`);
    commit();
  };

  const cmds: Cmd[] = [
    {
      id: 'b',
      label: 'Bold',
      hint: '⌘B',
      run: () => exec('bold'),
      icon: svg(
        'M6.2 3.6h4.6a3.1 3.1 0 0 1 0 6.2H6.2zM6.2 9.8h5.4a3.3 3.3 0 0 1 0 6.6H6.2z'
      ),
    },
    {
      id: 'i',
      label: 'Italic',
      hint: '⌘I',
      run: () => exec('italic'),
      icon: svg('M8.6 3.6h7M4.4 16.4h7M12.4 3.6l-4.4 12.8'),
    },
    {
      id: 'h',
      label: 'Heading',
      hint: '',
      run: () => exec('formatBlock', '<h3>'),
      icon: svg('M5 4v12M13 4v12M5 10h8'),
    },
    {
      id: 'ul',
      label: 'Bullets',
      hint: '',
      run: () => exec('insertUnorderedList'),
      icon: svg('M7.5 5h9M7.5 10h9M7.5 15h9M3.6 5h.01M3.6 10h.01M3.6 15h.01'),
    },
    {
      id: 'ol',
      label: 'Numbered',
      hint: '',
      run: () => exec('insertOrderedList'),
      icon: svg(
        'M8 5h8.5M8 10h8.5M8 15h8.5M3 4.4h1v3M3 9.2h1.6L3 11.6h1.6M3 13.6h1.5v1.2H3.4v1.2H4.9'
      ),
    },
    {
      id: 'q',
      label: 'Callout',
      hint: '',
      run: () => exec('formatBlock', '<blockquote>'),
      icon: svg('M4 5v10M8 6.5h8M8 10h8M8 13.5h5'),
    },
    {
      id: 'c',
      label: 'Code',
      hint: '',
      run: code,
      icon: svg('M7 6.5L3.5 10 7 13.5M13 6.5L16.5 10 13 13.5'),
    },
    {
      id: 'x',
      label: 'Clear formatting',
      hint: '',
      run: () => exec('removeFormat'),
      icon: svg('M5 4.6h10M10 4.6l-2.2 10.8M12.4 12.4l4 4M16.4 12.4l-4 4'),
    },
  ];
  const history: Cmd[] = [
    {
      id: 'undo',
      label: 'Undo',
      hint: '⌘Z',
      run: () => exec('undo'),
      icon: svg('M7.5 6.5L4 10l3.5 3.5M4 10h7.5a4 4 0 1 1 0 8H9'),
    },
    {
      id: 'redo',
      label: 'Redo',
      hint: '⇧⌘Z',
      run: () => exec('redo'),
      icon: svg('M12.5 6.5L16 10l-3.5 3.5M16 10H8.5a4 4 0 1 0 0 8H11'),
    },
  ];

  return (
    <div className={'note-wyg-wrap ' + className}>
      {/* in a narrow panel the bar scrolls: drag it, or use a plain wheel —
          sideways scrolling shouldn't need a trackpad */}
      <div
        ref={bar}
        className="note-wyg-bar"
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={startPan}
        onPointerMove={pan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onClickCapture={(e) => {
          if (panned.current) {
            e.preventDefault();
            e.stopPropagation();
            panned.current = false;
          }
        }}
        onWheel={(e) => {
          if (bar.current && Math.abs(e.deltaY) > Math.abs(e.deltaX))
            bar.current.scrollLeft += e.deltaY;
        }}
      >
        {cmds.slice(0, 2).map((c) => (
          <button
            key={c.id}
            className="note-wyg-btn"
            data-tip={c.hint ? `${c.label} (${c.hint})` : c.label}
            aria-label={c.label}
            onClick={c.run}
          >
            {c.icon}
          </button>
        ))}

        {/* colour lives behind one button, the way every editor does it */}
        <div className="note-wyg-pop-wrap">
          <button
            ref={colorBtn}
            className={
              'note-wyg-btn note-wyg-colorbtn' + (paletteOpen ? ' on' : '')
            }
            data-tip="Colour & highlight"
            aria-label="Colour and highlight"
            aria-expanded={paletteOpen}
            aria-haspopup="true"
            onClick={togglePalette}
          >
            {/* the colour bar lives INSIDE the glyph, so the button is the
                same 28px square as every other one on the bar */}
            {svg(
              'M4.3 13.8L10 3.2l5.7 10.6M6.5 10.4h7',
              <rect
                x="3.6"
                y="16.2"
                width="12.8"
                height="2.6"
                rx="1.3"
                fill="var(--primary)"
                stroke="none"
              />
            )}
          </button>
          {palette && (
            <div
              className="note-wyg-pop"
              role="dialog"
              aria-label="Colour and highlight"
              style={{ top: palette.y, left: palette.x }}
            >
              <div className="note-wyg-pop-label">Text</div>
              <div className="note-wyg-pop-row">
                <button
                  className="note-wyg-swatch is-accent-swatch"
                  data-tip="Deck accent"
                  aria-label="Deck accent"
                  onClick={() => {
                    accent();
                    setPalette(null);
                  }}
                />
                {TEXT_COLORS.map((hex) => (
                  <button
                    key={hex}
                    className="note-wyg-swatch"
                    style={{ background: hex }}
                    aria-label={`Text ${hex}`}
                    onClick={() => {
                      paint(hex);
                      setPalette(null);
                    }}
                  />
                ))}
              </div>
              <div className="note-wyg-pop-label">Highlight</div>
              <div className="note-wyg-pop-row">
                {HL_COLORS.map((hex) => (
                  <button
                    key={hex}
                    className="note-wyg-swatch is-hl"
                    style={{ background: hex }}
                    aria-label={`Highlight ${hex}`}
                    onClick={() => {
                      mark(hex);
                      setPalette(null);
                    }}
                  />
                ))}
                <button
                  className="note-wyg-swatch is-none"
                  data-tip="Remove colour"
                  aria-label="Remove colour and highlight"
                  onClick={() => {
                    strip();
                    setPalette(null);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {cmds.slice(2).map((c) => (
          <button
            key={c.id}
            className="note-wyg-btn"
            data-tip={c.hint ? `${c.label} (${c.hint})` : c.label}
            aria-label={c.label}
            onClick={c.run}
          >
            {c.icon}
          </button>
        ))}
        <span className="note-wyg-sep" />
        {history.map((c) => (
          <button
            key={c.id}
            className="note-wyg-btn"
            data-tip={`${c.label} (${c.hint})`}
            aria-label={c.label}
            onClick={c.run}
          >
            {c.icon}
          </button>
        ))}
        {onDone && (
          <button
            className="note-wyg-done"
            onClick={() => {
              commit();
              onDone();
            }}
          >
            Done
          </button>
        )}
      </div>
      <div
        ref={ref}
        className={'note-wyg' + (empty ? ' is-empty' : '')}
        style={style}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        spellCheck
        onInput={() => setEmpty(!ref.current?.innerText.trim())}
        onPaste={(e) => {
          e.preventDefault(); // plain text only — same rule as EditableText
          document.execCommand(
            'insertText',
            false,
            e.clipboardData.getData('text/plain')
          );
          setEmpty(!ref.current?.innerText.trim());
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation(); // never let slide navigation see typing
          if (e.key === 'Escape') {
            commit();
            onDone?.();
          }
        }}
      />
    </div>
  );
}
