import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useStore, getPath } from '../data/store';
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
  sizeEm: number;
  basePx: number;
  color: string | null;
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

function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';

  if (!(node instanceof HTMLElement)) return '';

  if (node.tagName === 'BR') return '\n';

  const inner = Array.from(node.childNodes).map(serialize).join('');

  if (!inner) return node.tagName === 'DIV' || node.tagName === 'P' ? '\n' : '';

  if (node.dataset.align) return `{a:${node.dataset.align}}${inner}`;

  if (node.dataset.color && COLOR_RE.test(node.dataset.color))
    return `{c:${node.dataset.color}}${inner}{/c}`;

  if (node.dataset.fs) return `{s:${node.dataset.fs}}${inner}{/s}`;

  for (const [marker, w] of Object.entries(WRAPPERS)) {
    if (w.match(node)) return marker + inner + marker;
  }

  if (node.tagName === 'DIV' || node.tagName === 'P') return '\n' + inner;

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

const fieldBasePx = (el: HTMLElement | null) => {
  const n = el ? parseFloat(getComputedStyle(el).fontSize) : NaN;

  return Number.isFinite(n) && n > 0 ? n : 16;
};

const emFromPx = (px: number, basePx: number) =>
  clampEm(Math.round((px / Math.max(basePx, 1)) * 1000) / 1000);

const pxOf = (sizeEm: number, basePx: number) => Math.round(sizeEm * basePx);

const isBaseSize = (em: number, basePx: number) =>
  pxOf(em, basePx) === pxOf(1, basePx);

const SIZE_TYPE_MS = 250;

function SizeField({
  sizeEm,
  basePx,
  menuHeld,
  stepRef,
  onSize,
  onLeaveField,
  onRestoreFocus,
}: {
  sizeEm: number;
  basePx: number;
  menuHeld: { current: boolean };
  stepRef: MutableRefObject<(dir: 1 | -1) => void>;
  onSize: (em: number) => void;
  onLeaveField: () => void;
  onRestoreFocus: () => void;
}) {
  const px = pxOf(sizeEm, basePx);
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipCommit = useRef(false);
  const returnToField = useRef(false);
  const revertPx = useRef(px);
  const shown = draft ?? String(px);

  const clearTypeTimer = () => {
    if (typeTimer.current) {
      clearTimeout(typeTimer.current);
      typeTimer.current = null;
    }
  };

  useEffect(
    () => () => {
      if (typeTimer.current) clearTimeout(typeTimer.current);
    },
    []
  );

  const commitPx = (n: number) => {
    if (!Number.isFinite(n)) return;

    clearTypeTimer();

    const em = emFromPx(n, basePx);
    const next = String(pxOf(em, basePx));

    if (document.activeElement === inputRef.current) setDraft(next);
    else setDraft(null);

    onSize(em);
  };

  const step = (dir: 1 | -1) => {
    const cur = parseInt(shown, 10);

    commitPx((Number.isFinite(cur) ? cur : px) + dir);
  };

  stepRef.current = step;

  const applyDraft = (raw: string | null) => {
    clearTypeTimer();
    setDraft(null);

    if (raw === null || raw === '') return;

    const n = parseInt(raw.replace(/px/gi, ''), 10);

    if (!Number.isFinite(n)) return;

    onSize(emFromPx(n, basePx));
  };

  return (
    <span className="fmt-size">
      <input
        ref={inputRef}
        className="fmt-size-input"
        type="text"
        inputMode="numeric"
        aria-label="Font size in pixels"
        title="Slide type size — stored as em so it stays responsive"
        value={shown}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 4);

          setDraft(raw);
          clearTypeTimer();

          const n = parseInt(raw, 10);

          if (!Number.isFinite(n)) return;

          typeTimer.current = setTimeout(() => {
            typeTimer.current = null;
            onSize(emFromPx(n, basePx));
          }, SIZE_TYPE_MS);
        }}
        onFocus={(e) => {
          revertPx.current = px;
          setDraft(String(px));
          e.currentTarget.select();
        }}
        onBlur={() => {
          if (skipCommit.current) {
            skipCommit.current = false;
            clearTypeTimer();
            setDraft(null);
          } else {
            applyDraft(draft);
          }

          const stay = returnToField.current;

          returnToField.current = false;
          requestAnimationFrame(() => {
            const a = document.activeElement;

            if (menuHeld.current || a?.closest('.fmt-menu')) return;

            if (a?.closest('.t-edit')) return;

            if (stay) {
              onRestoreFocus();
              return;
            }

            onLeaveField();
          });
        }}
        onKeyDown={(e) => {
          e.stopPropagation();

          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            step(e.key === 'ArrowUp' ? 1 : -1);
            return;
          }

          if (e.key === 'Enter') {
            e.preventDefault();
            returnToField.current = true;
            e.currentTarget.blur();
          }

          if (e.key === 'Escape') {
            e.preventDefault();
            skipCommit.current = true;
            returnToField.current = true;
            clearTypeTimer();
            onSize(emFromPx(revertPx.current, basePx));
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <span className="fmt-size-unit" aria-hidden>
        px
      </span>
    </span>
  );
}

function FormatMenu({
  bar,
  inline,
  onBeforeAction,
  onApply,
  onClear,
  onSize,
  onColor,
  onAlign,
  onLeaveField,
  onRestoreFocus,
}: {
  bar: Bar;
  onBeforeAction?: () => void;
  inline?: boolean;
  onApply: (marker: string) => void;
  onClear: () => void;
  onSize: (em: number) => void;
  onColor: (color: string | null) => void;
  onAlign: (a: 'l' | 'c' | 'r' | null) => void;
  onLeaveField: () => void;
  onRestoreFocus: () => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const menuHeld = useRef(false);
  const stepRef = useRef<(dir: 1 | -1) => void>(() => {});

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
      title={props.disabled ? undefined : props.title}
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
      onPointerDownCapture={() => {
        onBeforeAction?.();
        menuHeld.current = true;
      }}
      onPointerUp={() => {
        menuHeld.current = false;
      }}
      onPointerCancel={() => {
        menuHeld.current = false;
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('input')) return;

        e.preventDefault();
      }}
    >
      {btn({
        title: 'Smaller (−1px)',
        act: () => stepRef.current(-1),
        disabled: bar.sizeEm <= 0.4,
        children: '−',
      })}
      <SizeField
        sizeEm={bar.sizeEm}
        basePx={bar.basePx}
        menuHeld={menuHeld}
        stepRef={stepRef}
        onSize={onSize}
        onLeaveField={onLeaveField}
        onRestoreFocus={onRestoreFocus}
      />
      {btn({
        title: 'Larger (+1px)',
        act: () => stepRef.current(1),
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
                },
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
  path: string;
  placeholder?: string;
  block?: boolean;
  inlineBar?: boolean;
}) {
  const { editable, slideId, slide: ctxSlide } = useEdit();
  const setProp = useStore((s) => s.setProp);
  const lastRange = useRef<Range | null>(null);
  const storeValue: string | null = useStore((s) => {
    const slide = s.slides.find((sl) => sl.id === slideId);

    return slide ? String(getPath(slide.props, path) ?? '') : null;
  });
  const value: string =
    storeValue ?? String(getPath(ctxSlide?.props ?? {}, path) ?? '');
  const [focused, setFocused] = useState(false);
  const [bar, setBar] = useState<Bar | null>(null);
  const [domEmpty, setDomEmpty] = useState(!value);
  const ref = useRef<HTMLElement | null>(null);
  const blockStyle = block ? { display: 'block' as const } : undefined;

  useEffect(() => {
    const el = ref.current;

    if (!el || el.contains(document.activeElement)) return;

    el.innerHTML = richToHtml(value);
    setDomEmpty(!value);
  }, [value]);

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
      const below = r.bottom + 60 < window.innerHeight;

      setBar({
        x: Math.min(Math.max(r.left, 10), window.innerWidth - 380),
        y: below ? r.bottom + 8 : r.top - 8,
        below,
        marks,
        sizeEm,
        basePx: fieldBasePx(el),
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

    unwrapNestedSize(el);

    let raw = balanceLines(
      Array.from(el.childNodes)
        .map(serialize)
        .join('')
        .replace(/^\n/, '')
        .replace(/\n$/, '')
    );
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

  const applyMarker = (m: string) => {
    ensureRange();

    const el = ref.current;
    const s = document.getSelection();
    const w = WRAPPERS[m];

    if (!el || !s || s.rangeCount === 0 || s.isCollapsed || !w) return;

    const range = s.getRangeAt(0);

    if (!el.contains(range.commonAncestorContainer)) return;

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

  const findAncestor = (
    test: (el: HTMLElement) => boolean
  ): HTMLElement | null => {
    const el = ref.current;
    const s = document.getSelection();

    if (!el || !s || s.rangeCount === 0) return null;

    const range = s.getRangeAt(0);
    let n: Node | null = range.commonAncestorContainer;

    if (n === el) n = range.startContainer;

    if (n === el) n = el.firstChild;

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

  const unwrapNestedSize = (root: HTMLElement) => {
    root.querySelectorAll('[data-fs] [data-fs]').forEach((inner) => {
      if (inner instanceof HTMLElement) unwrapEl(inner);
    });
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

  const setSize = (em: number) => {
    const el = ref.current;

    if (!el) return;

    ensureRange();

    let cur = findAncestor((n) => !!n.dataset.fs);

    if (!cur) {
      const kids = Array.from(el.childNodes).filter(
        (n) => n.nodeType !== Node.TEXT_NODE || (n.nodeValue ?? '').trim()
      );

      if (
        kids.length === 1 &&
        kids[0] instanceof HTMLElement &&
        kids[0].dataset.fs
      )
        cur = kids[0];
    }

    const basePx = fieldBasePx(el);

    if (cur) {
      if (isBaseSize(em, basePx)) {
        unwrapEl(cur);
        setBar((b) => (b ? { ...b, sizeEm: 1 } : b));
        return;
      }

      cur.dataset.fs = String(em);
      cur.style.fontSize = `${em}em`;
      setBar((b) => (b ? { ...b, sizeEm: em } : b));
      return;
    }

    const legacy = findAncestor(
      (n) => n.dataset.size === 'up' || n.dataset.size === 'down'
    );

    if (legacy) unwrapEl(legacy);

    if (isBaseSize(em, basePx)) return;

    const make = () => {
      const sp = document.createElement('span');

      sp.dataset.fs = String(em);
      sp.style.fontSize = `${em}em`;

      return sp;
    };
    const s = document.getSelection();
    const range = s && s.rangeCount > 0 ? s.getRangeAt(0) : null;
    const useSel =
      range && !range.collapsed && el.contains(range.commonAncestorContainer);

    if (useSel) {
      wrapSelection(make);
    } else {
      const wrap = make();

      while (el.firstChild) wrap.appendChild(el.firstChild);
      el.appendChild(wrap);
    }

    unwrapNestedSize(el);
    setBar((b) => (b ? { ...b, sizeEm: em } : b));
  };

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

      unwrapEl(cur);
    }

    if (!color) return;

    wrapSelection(() => {
      const sp = document.createElement('span');

      sp.dataset.color = color;
      sp.style.color = colorValue(color);

      return sp;
    });
  };

  const clearFormat = () => {
    ensureRange();

    const el = ref.current;
    const s = document.getSelection();

    if (!el || !s || s.rangeCount === 0 || s.isCollapsed) return;

    const range = s.getRangeAt(0);

    if (!el.contains(range.commonAncestorContainer)) return;

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
    e.stopPropagation();

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
      e.preventDefault();

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
        onBlur={() => {
          requestAnimationFrame(() => {
            if (document.activeElement?.closest('.fmt-menu')) return;

            commit();
          });
        }}
        onInput={() => setDomEmpty(!ref.current?.textContent)}
        onKeyDown={onKeyDown}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onSelect={rememberSelection}
        onMouseDown={(e) => e.stopPropagation()}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand(
            'insertText',
            false,
            e.clipboardData.getData('text/plain')
          );
          setDomEmpty(!ref.current?.textContent);
        }}
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
          onLeaveField={commit}
          onRestoreFocus={() => ref.current?.focus()}
        />
      )}
    </>
  );
}
