/* CodeEditor — in-place editing for the code layout. The real CodeWindow
   stays as the visual (syntax highlight + line numbers); a transparent
   textarea with a visible caret floats exactly over its code column, and the
   highlight re-renders live from the draft on every keystroke. The window
   title edits via T. Commit on blur. */
import { useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '@/data/store';
import { useEdit } from './EditContext';
import type { SlideData } from '@/data/types';
import CodeWindow from '@/components/CodeWindow';
import T from './EditableText';
import { offsetTo } from './measure';

export default function CodeEditor({ slide }: { slide: SlideData }) {
  const { slideId } = useEdit();
  const setProp = useStore((s) => s.setProp);
  const [draft, setDraft] = useState<string | null>(null);
  const code: string = draft ?? String(slide.props.code ?? '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [geom, setGeom] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    font: string;
    lineHeight: string;
  } | null>(null);

  // glue the textarea precisely over the code column (layout px, transform-safe)
  useLayoutEffect(() => {
    const update = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const codeEl = wrap.querySelector('.cw-body code') as HTMLElement | null;
      const firstCode = wrap.querySelector('.cw-code') as HTMLElement | null;
      if (!codeEl || !firstCode) return;
      const c = offsetTo(codeEl, wrap);
      const f = offsetTo(firstCode, wrap);
      const cs = getComputedStyle(firstCode);
      setGeom({
        left: f.x,
        top: c.y,
        width: Math.max(60, codeEl.offsetWidth - (f.x - c.x)),
        height: codeEl.offsetHeight,
        font: `${cs.fontSize} ${cs.fontFamily}`,
        lineHeight: cs.lineHeight,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    const codeEl = wrapRef.current?.querySelector('.cw-body code');
    if (codeEl) ro.observe(codeEl);
    return () => ro.disconnect();
  }, [code]);

  const commit = () => {
    if (slideId && draft !== null && draft !== slide.props.code)
      setProp(slideId, 'code', draft);
    setDraft(null);
  };

  const highlight = String(slide.props.highlight ?? '')
    .split(',')
    .map((n) => parseInt(n.trim(), 10))
    .filter(Number.isFinite);

  return (
    <div className="code-edit" ref={wrapRef}>
      {/* the visual — re-renders live from the draft */}
      <CodeWindow
        title={
          (<T path="filename" placeholder="file.ts" />) as unknown as string
        }
        code={code}
        highlight={highlight}
      />

      {geom && (
        <textarea
          ref={taRef}
          className="code-ta"
          style={{
            left: geom.left,
            top: geom.top,
            width: geom.width,
            height: geom.height,
            font: geom.font,
            lineHeight: geom.lineHeight,
          }}
          value={code}
          wrap="off"
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation(); // keep slide navigation off
            if (e.key === 'Escape') {
              e.preventDefault();
              taRef.current?.blur();
            }
            if (e.key === 'Tab') {
              e.preventDefault();
              const ta = taRef.current;
              if (!ta) return;
              const { selectionStart: a, selectionEnd: b } = ta;
              const next = code.slice(0, a) + '  ' + code.slice(b);
              setDraft(next);
              requestAnimationFrame(() => ta.setSelectionRange(a + 2, a + 2));
            }
          }}
        />
      )}
    </div>
  );
}
