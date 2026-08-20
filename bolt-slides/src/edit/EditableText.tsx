/* T — every piece of slide text renders through this. Outside the editor it's
   just the rich-rendered string; on the editor canvas it becomes click-to-edit
   WYSIWYG: the text stays fully styled while you type (no visible markers).
   Formatting (selection → floating menu, or Cmd+B / Cmd+I) wraps the selection
   in real styled elements; on blur the DOM serializes back to the marker
   string (==accent==, **bold**, _italic_, ++larger++, ~~smaller~~) that the
   store and the skill both speak. */
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useStore, getPath } from '@/data/store';
import { useEdit } from './EditContext';
import {
  renderRich,
  richToHtml,
  balanceLines,
  clampEm,
  colorValue,
  COLOR_RE,
  ALIGNS,
} from './rich';

interface Bar {
  x: number;
  y: number;
  below: boolean;
  marks: string[];
  /** current font-size multiplier at the caret (1 = base) */
  sizeEm: number;
  /** current color at the caret: hex, 'accent', or null (theme default) */
  color: string | null;
  /** whole-field alignment override, or null (layout default) */
  align: 'l' | 'c' | 'r' | null;
}

const PALETTE = [
  '#ffffff',
  '#9aa3b2',
  '#1688FC',
  '#4fe5b0',
  '#eab308',
  '#fb923c',
  '#f87171',
  '#a78bfa',
  '#f472b6',
  '#34d399',
];

/* the five formats: how to create each wrapper element, how to recognize it */
const WRAPPERS: Record<
  string,
  { make: () => HTMLElement; match: (el: HTMLElement) => boolean }
> = {
  '**': {
    make: () => document.createElement('strong'),
    match: (el) => el.tagName === 'STRONG' || el.tagName === 'B',
  },
  _: {
    make: () => document.createElement('em'),
    match: (el) => el.tagName === 'EM' || el.tagName === 'I',
  },
  '==': {
    make: () => {
      const s = document.createElement('span');
      s.className = 'accent-text';
      return s;
    },
    match: (el) => el.classList.contains('accent-text'),
  },
  '++': {
    make: () => {
      const s = document.createElement('span');
      s.dataset.size = 'up';
      s.style.fontSize = '1.3em';
      return s;
    },
    match: (el) => el.dataset.size === 'up',
  },
  '~~': {
    make: () => {
      const s = document.createElement('span');
      s.dataset.size = 'down';
      s.style.fontSize = '0.75em';
      return s;
    },
    match: (el) => el.dataset.size === 'down',
  },
};

/* edited DOM → marker string */
function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
  if (!(node instanceof HTMLElement)) return '';
  if (node.tagName === 'BR') return '\n';
  const inner = Array.from(node.childNodes).map(serialize).join('');
  if (!inner) return node.tagName === 'DIV' || node.tagName === 'P' ? '\n' : '';
  if (node.dataset.align) return `{a:${node.dataset.align}}${inner}`; // hoisted to the front on commit
  if (node.dataset.color && COLOR_RE.test(node.dataset.color))
    return `{c:${node.dataset.color}}${inner}{/c}`;
  if (node.dataset.fs) return `{s:${node.dataset.fs}}${inner}{/s}`;
  for (const [marker, w] of Object.entries(WRAPPERS)) {
    if (w.match(node)) return marker + inner + marker;
  }
  if (node.tagName === 'DIV' || node.tagName === 'P') return '\n' + inner; // contentEditable line blocks
  return inner;
}

const IconBold = (
  <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden>
    <path
      d="M6.2 3.6h4.6a3.1 3.1 0 0 1 0 6.2H6.2zM6.2 9.8h5.4a3.3 3.3 0 0 1 0 6.6H6.2z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
  </svg>
);
const IconItalic = (
  <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden>
    <path
      d="M8.6 3.6h7M4.4 16.4h7M12.4 3.6l-4.4 12.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
  </svg>
);
const IconClear = (
  <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden>
    <path
      d="M5 4.6h10M10 4.6l-2.2 10.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    <path
      d="M12.4 12.4l4 4M16.4 12.4l-4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);
const alignIcon = (kind: 'l' | 'c' | 'r') => {
  const x2 = (w: number) =>
    kind === 'l'
      ? [3, 3 + w]
      : kind === 'r'
      ? [17 - w, 17]
      : [10 - w / 2, 10 + w / 2];
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden>
      {[
        [14, 4.5],
        [9, 9.5],
        [12, 14.5],
      ].map(([w, y], i) => {
        const [a, b] = x2(w);
        return (
          <path
            key={i}
            d={`M${a} ${y}h${b - a}`}
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};

/* The text bar — anchored under the text block (stable while you select and
   type, like Pitch/Framer), visible the whole time the block is focused.
   [ − 100% + | A color ▾ | B I | clear ]. With nothing selected, actions
   style the entire block. */
function FormatMenu({
  bar,
  inline,
  onBeforeAction,
  onApply,
  onClear,
  onSize,
  onColor,
  onAlign,
}: {
  bar: Bar;
  /** called the instant the bar is touched, while the selection is still live */
  onBeforeAction?: () => void;
  /** render in-flow inside the field (sidebar) instead of floating (canvas) */
  inline?: boolean;
  onApply: (marker: string) => void;
  onClear: () => void;
  onSize: (em: number) => void;
  onColor: (color: string | null) => void;
  onAlign: (a: 'l' | 'c' | 'r' | null) => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const pct = Math.round(bar.sizeEm * 100);
  const step = (dir: 1 | -1) =>
    onSize(clampEm(Math.round((bar.sizeEm + dir * 0.1) * 10) / 10));
  const btn = (props: {
    title: string;
    cls?: string;
    on?: boolean;
    act: () => void;
    children: ReactNode;
    disabled?: boolean;
  }) => (
    <button
      className={'fmt-btn ' + (props.cls ?? '') + (props.on ? ' on' : '')}
      title={props.title}
      disabled={props.disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!props.disabled) props.act();
      }}
    >
      {props.children}
    </button>
  );
  const body = (
    <div
      className={
        inline
          ? 'fmt-menu fmt-inline'
          : 'fmt-menu fmt-bar' + (bar.below ? ' below' : '')
      }
      style={inline ? undefined : { left: bar.x, top: bar.y }}
      contentEditable={false}
      /* bank the live selection before anything here can disturb it, then
         keep focus alive; both must happen on the way DOWN */
      onPointerDownCapture={() => onBeforeAction?.()}
      onMouseDown={(e) => e.preventDefault()} // keep focus + selection alive
    >
      {btn({
        title: 'Smaller (−10%)',
        act: () => step(-1),
        disabled: bar.sizeEm <= 0.4,
        children: '−',
      })}
      <span className="fmt-size">{pct}%</span>
      {btn({
        title: 'Larger (+10%)',
        act: () => step(1),
        disabled: bar.sizeEm >= 4,
        children: '+',
      })}
      <span className="fmt-sep" />
      <button
        className={'fmt-btn fmt-a' + (bar.color ? ' on' : '')}
        title="Text color"
        style={bar.color ? { color: colorValue(bar.color) } : undefined}
        onMouseDown={(e) => {
          e.preventDefault();
          setColorOpen((v) => !v);
          setAlignOpen(false);
        }}
      >
        A
      </button>
      <span className="fmt-sep" />
      {btn({
        title: 'Bold (⌘B)',
        on: bar.marks.includes('**'),
        act: () => onApply('**'),
        children: IconBold,
      })}
      {btn({
        title: 'Italic (⌘I)',
        on: bar.marks.includes('_'),
        act: () => onApply('_'),
        children: IconItalic,
      })}
      <span className="fmt-sep" />
      <span className="fmt-drop">
        {btn({
          title: 'Alignment',
          on: bar.align !== null,
          act: () => {
            setAlignOpen((v) => !v);
            setColorOpen(false);
          },
          children: alignIcon(bar.align ?? 'l'),
        })}
        {alignOpen && (
          <span className="fmt-pop" onMouseDown={(e) => e.preventDefault()}>
            {(['l', 'c', 'r'] as const).map((a) =>
              btn({
                title: { l: 'Align left', c: 'Align center', r: 'Align right' }[
                  a
                ],
                on: bar.align === a,
                act: () => {
                  onAlign(bar.align === a ? null : a);
                  setAlignOpen(false);
                }, // active again → layout default
                children: alignIcon(a),
              })
            )}
          </span>
        )}
      </span>
      <span className="fmt-sep" />
      {btn({
        title: 'Clear formatting',
        act: () => {
          setColorOpen(false);
          onClear();
        },
        children: IconClear,
      })}

      {colorOpen && (
        <div className="color-pop" onMouseDown={(e) => e.preventDefault()}>
          <div className="color-row-label">Theme</div>
          <div className="color-row">
            <button
              className={'color-swatch' + (bar.color === null ? ' on' : '')}
              title="Default (theme ink)"
              style={{ background: 'var(--fg)' }}
              onMouseDown={(e) => {
                e.preventDefault();
                onColor(null);
                setColorOpen(false);
              }}
            />
            <button
              className={'color-swatch' + (bar.color === 'accent' ? ' on' : '')}
              title="Accent"
              style={{ background: 'var(--primary)' }}
              onMouseDown={(e) => {
                e.preventDefault();
                onColor('accent');
                setColorOpen(false);
              }}
            />
          </div>
          <div className="color-row-label">Colors</div>
          <div className="color-row">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={'color-swatch' + (bar.color === c ? ' on' : '')}
                title={c}
                style={{ background: c }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onColor(c);
                  setColorOpen(false);
                }}
              />
            ))}
            <label className="color-swatch color-custom" title="Custom color">
              +
              <input
                type="color"
                onChange={(e) => {
                  onColor(e.target.value);
                  setColorOpen(false);
                }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
  return inline ? body : createPortal(body, document.body);
}

export default function T({
  path,
  placeholder = 'Edit…',
  block,
  inlineBar,
}: {
  /** dot path into the slide's props, e.g. "title" or "items.0.title" */
  path: string;
  placeholder?: string;
  /** multi-line: Enter inserts a line break instead of committing */
  block?: boolean;
  /** render the format toolbar in-flow inside the field (sidebar fields) */
  inlineBar?: boolean;
}) {
  const { editable, slideId, slide: ctxSlide } = useEdit();
  const setProp = useStore((s) => s.setProp);
  /* the last real (non-collapsed) selection inside this field. Clicking a
     swatch or opening the colour popover can drop the live selection, and the
     fallback below then styles the WHOLE block — which is why colouring used
     to hit the wrong text. We restore this instead. */
  const lastRange = useRef<Range | null>(null);
  const storeValue: string | null = useStore((s) => {
    const slide = s.slides.find((sl) => sl.id === slideId);
    return slide ? String(getPath(slide.props, path) ?? '') : null;
  });
  // slides not in the store (add-slide previews) resolve from the context row
  const value: string =
    storeValue ?? String(getPath(ctxSlide?.props ?? {}, path) ?? '');
  const [focused, setFocused] = useState(false);
  const [bar, setBar] = useState<Bar | null>(null);
  // emptiness must track the LIVE DOM while typing (the store value lags
  // until blur), or the CSS placeholder overlays what's being typed
  const [domEmpty, setDomEmpty] = useState(!value);
  const ref = useRef<HTMLElement | null>(null);
  const blockStyle = block ? { display: 'block' as const } : undefined;

  // the text bar: anchored under the element for the whole edit session;
  // active-format marks refresh as the caret/selection moves
  useEffect(() => {
    if (!focused) {
      setBar(null);
      return;
    }
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const s = document.getSelection();
      const marks: string[] = [];
      let sizeEm = 1;
      let color: string | null = null;
      if (s && s.rangeCount > 0 && el.contains(s.anchorNode)) {
        let n: Node | null = s.anchorNode;
        while (n && n !== el) {
          if (n instanceof HTMLElement) {
            for (const [marker, w] of Object.entries(WRAPPERS))
              if (w.match(n)) marks.push(marker);
            if (n.dataset.fs && sizeEm === 1)
              sizeEm = clampEm(parseFloat(n.dataset.fs));
            if (n.dataset.size === 'up' && sizeEm === 1) sizeEm = 1.3;
            if (n.dataset.size === 'down' && sizeEm === 1) sizeEm = 0.75;
            if (n.dataset.color && !color) color = n.dataset.color;
            if (n.classList.contains('accent-text') && !color) color = 'accent';
          }
          n = n.parentNode;
        }
      }
      const r = el.getBoundingClientRect();
      const below = r.bottom + 60 < window.innerHeight; // room under the block?
      setBar({
        x: Math.min(Math.max(r.left, 10), window.innerWidth - 380),
        y: below ? r.bottom + 8 : r.top - 8,
        below,
        marks,
        sizeEm,
        color,
        align:
          ((el.querySelector('[data-align]') as HTMLElement | null)?.dataset
            .align as 'l' | 'c' | 'r' | undefined) ?? null,
      });
    };
    document.addEventListener('selectionchange', update);
    update();
    return () => document.removeEventListener('selectionchange', update);
  }, [focused]);

  if (!editable || !slideId)
    return <span style={blockStyle}>{renderRich(value)}</span>;

  const rememberSelection = () => {
    const r = liveRange();
    lastRange.current = r ? r.cloneRange() : lastRange.current;
  };

  const commit = () => {
    setFocused(false);
    setBar(null);
    lastRange.current = null;
    const el = ref.current;
    if (!el) return;
    let raw = balanceLines(
      Array.from(el.childNodes)
        .map(serialize)
        .join('')
        .replace(/^\n/, '')
        .replace(/\n$/, '')
    );
    // the alignment tag is a whole-field prefix — hoist it to the front
    const am = raw.match(/\{a:([lcr])\}/);
    if (am) raw = `{a:${am[1]}}` + raw.replace(/\{a:[lcr]\}/g, '');
    if (raw !== value) setProp(slideId, path, raw);
  };

  const liveRange = () => {
    const el = ref.current;
    const s = document.getSelection();
    if (!el || !s || s.rangeCount === 0 || s.isCollapsed) return null;
    const r = s.getRangeAt(0);
    return el.contains(r.commonAncestorContainer) ? r : null;
  };
  /* Target for a formatting action, in order of preference:
       1. what is selected right now
       2. what was selected when the format bar was last touched
       3. nothing selected at all → the whole block                        */
  const ensureRange = () => {
    const el = ref.current;
    const s = document.getSelection();
    if (!el || !s) return;
    if (liveRange()) return;
    const saved = lastRange.current;
    if (
      saved &&
      el.contains(saved.commonAncestorContainer) &&
      !saved.collapsed
    ) {
      s.removeAllRanges();
      s.addRange(saved);
      return;
    }
    const r = document.createRange();
    r.selectNodeContents(el);
    s.removeAllRanges();
    s.addRange(r);
  };

  /* WYSIWYG toggle: unwrap when the selection sits inside this format,
     otherwise wrap the selected content in the real styled element. */
  const applyMarker = (m: string) => {
    ensureRange();
    const el = ref.current;
    const s = document.getSelection();
    const w = WRAPPERS[m];
    if (!el || !s || s.rangeCount === 0 || s.isCollapsed || !w) return;
    const range = s.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;

    // already inside this format? → unwrap that element
    let anc: Node | null = range.commonAncestorContainer;
    while (anc && anc !== el) {
      if (anc instanceof HTMLElement && w.match(anc)) {
        const parent = anc.parentNode;
        if (!parent) return;
        while (anc.firstChild) parent.insertBefore(anc.firstChild, anc);
        parent.removeChild(anc);
        parent.normalize();
        return;
      }
      anc = anc.parentNode;
    }

    const frag = range.extractContents();
    const wrap = w.make();
    wrap.appendChild(frag);
    range.insertNode(wrap);
    const r2 = document.createRange();
    r2.selectNodeContents(wrap);
    s.removeAllRanges();
    s.addRange(r2);
  };

  /* shared bits for the parameterized wrappers (size / color) */
  const findAncestor = (
    test: (el: HTMLElement) => boolean
  ): HTMLElement | null => {
    const el = ref.current;
    const s = document.getSelection();
    if (!el || !s || s.rangeCount === 0) return null;
    let n: Node | null = s.anchorNode;
    while (n && n !== el) {
      if (n instanceof HTMLElement && test(n)) return n;
      n = n.parentNode;
    }
    return null;
  };
  const unwrapEl = (target: HTMLElement) => {
    const parent = target.parentNode;
    if (!parent) return;
    while (target.firstChild) parent.insertBefore(target.firstChild, target);
    parent.removeChild(target);
    if (parent instanceof HTMLElement) parent.normalize();
  };
  const wrapSelection = (make: () => HTMLElement) => {
    ensureRange();
    const el = ref.current;
    const s = document.getSelection();
    if (!el || !s || s.rangeCount === 0 || s.isCollapsed) return;
    const range = s.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    const frag = range.extractContents();
    const wrap = make();
    wrap.appendChild(frag);
    range.insertNode(wrap);
    const r2 = document.createRange();
    r2.selectNodeContents(wrap);
    s.removeAllRanges();
    s.addRange(r2);
  };

  /* granular font size — updates the wrapper in place when one exists */
  const setSize = (em: number) => {
    ensureRange();
    const cur = findAncestor((n) => !!n.dataset.fs);
    if (cur) {
      if (Math.abs(em - 1) < 0.05) {
        unwrapEl(cur);
        return;
      }
      cur.dataset.fs = String(em);
      cur.style.fontSize = `${em}em`;
      setBar((b) => (b ? { ...b, sizeEm: em } : b));
      return;
    }
    // convert a legacy ++/~~ wrapper into a granular one
    const legacy = findAncestor(
      (n) => n.dataset.size === 'up' || n.dataset.size === 'down'
    );
    if (legacy) unwrapEl(legacy);
    if (Math.abs(em - 1) < 0.05) return;
    wrapSelection(() => {
      const sp = document.createElement('span');
      sp.dataset.fs = String(em);
      sp.style.fontSize = `${em}em`;
      return sp;
    });
  };

  /* text color — hex, 'accent', or null to clear */
  const setColor = (color: string | null) => {
    ensureRange();
    const cur = findAncestor(
      (n) => !!n.dataset.color || n.classList.contains('accent-text')
    );
    if (cur) {
      if (!color) {
        unwrapEl(cur);
        return;
      }
      if (cur.dataset.color) {
        cur.dataset.color = color;
        cur.style.color = colorValue(color);
        setBar((b) => (b ? { ...b, color } : b));
        return;
      }
      unwrapEl(cur); // was ==accent== — replace with an explicit color span
    }
    if (!color) return;
    wrapSelection(() => {
      const sp = document.createElement('span');
      sp.dataset.color = color;
      sp.style.color = colorValue(color);
      return sp;
    });
  };

  /* strip every format from the selection — it becomes plain text */
  const clearFormat = () => {
    ensureRange();
    const el = ref.current;
    const s = document.getSelection();
    if (!el || !s || s.rangeCount === 0 || s.isCollapsed) return;
    const range = s.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    // if the selection sits inside wrappers, unwrap those first
    let n: Node | null = range.commonAncestorContainer;
    while (n && n !== el) {
      const parent: Node | null = n.parentNode;
      if (
        n instanceof HTMLElement &&
        (n.dataset.color ||
          n.dataset.fs ||
          Object.values(WRAPPERS).some((w) => w.match(n as HTMLElement)))
      ) {
        while (n.firstChild) parent!.insertBefore(n.firstChild, n);
        parent!.removeChild(n);
      }
      n = parent;
    }
    const text = range.toString();
    if (!text) return;
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    const r2 = document.createRange();
    r2.selectNodeContents(node);
    s.removeAllRanges();
    s.addRange(r2);
    el.normalize();
  };

  /* whole-field alignment — a single wrapper span around all content */
  const setAlign = (a: 'l' | 'c' | 'r' | null) => {
    const el = ref.current;
    if (!el) return;
    const cur = el.querySelector('[data-align]') as HTMLElement | null;
    if (a === null) {
      if (cur) unwrapEl(cur);
    } else if (cur) {
      cur.dataset.align = a;
      cur.style.textAlign = ALIGNS[a];
    } else {
      const sp = document.createElement('span');
      sp.dataset.align = a;
      sp.style.display = 'block';
      sp.style.textAlign = ALIGNS[a];
      while (el.firstChild) sp.appendChild(el.firstChild);
      el.appendChild(sp);
    }
    setBar((b) => (b ? { ...b, align: a } : b));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation(); // keep slide navigation off while typing
    if (e.key === 'Escape') {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === 'Enter' && !block) {
      e.preventDefault();
      ref.current?.blur();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyMarker('**');
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyMarker('_');
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault(); // select THIS text, scoped, in every browser
      const el = ref.current;
      if (!el) return;
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = document.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
    }
  };

  const empty = focused ? domEmpty : !value;

  return (
    <>
      {/* innerHTML is set wholesale from the value — React must never
          reconcile individual children the browser has been typing into,
          or committed text duplicates alongside browser-created nodes */}
      <span
        ref={(el: HTMLElement | null) => {
          ref.current = el;
        }}
        style={blockStyle}
        className={
          't-edit' + (focused ? ' focused' : '') + (empty ? ' empty' : '')
        }
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-placeholder={placeholder}
        onFocus={() => {
          setFocused(true);
          setDomEmpty(!ref.current?.textContent);
        }}
        onBlur={commit}
        onInput={() => setDomEmpty(!ref.current?.textContent)}
        onKeyDown={onKeyDown}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onSelect={rememberSelection}
        onMouseDown={(e) => e.stopPropagation()}
        onPaste={(e) => {
          e.preventDefault(); // plain text only — no foreign HTML in the deck
          document.execCommand(
            'insertText',
            false,
            e.clipboardData.getData('text/plain')
          );
          setDomEmpty(!ref.current?.textContent);
        }}
        dangerouslySetInnerHTML={{ __html: richToHtml(value) }}
      />
      {focused && bar && (
        <FormatMenu
          bar={bar}
          inline={inlineBar}
          onBeforeAction={rememberSelection}
          onApply={applyMarker}
          onClear={clearFormat}
          onSize={setSize}
          onColor={setColor}
          onAlign={setAlign}
        />
      )}
    </>
  );
}
