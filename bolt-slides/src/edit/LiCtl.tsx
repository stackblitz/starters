/* LiCtl — on-canvas controls for one item of a repeatable list (agenda rows,
   steps, stats, tiles, tiers…).
   · hover an item → ⠿ drag handle in the left gutter; drag with the POINTER
     (not native HTML5 DnD, which cancels unpredictably) to reorder — an
     accent insertion line previews exactly where it will land
   · right-click an item → delete
   · the LAST item carries a "+" pinned below it — visible on hover AND kept
     visible the whole time the list is being edited (focus anywhere in it) */
import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore, getPath } from '@/data/store';
import { useEdit } from '@/edit/EditContext';
import ContextMenu from '@/edit/ContextMenu';

export default function LiCtl({
  path,
  index,
  blank,
  children,
}: {
  /** dot path of the ARRAY in the slide props, e.g. "items" or "left.points" */
  path: string;
  index: number;
  /** template appended by "+" (defaults to '' / {} matching the current item) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blank?: any;
  children: ReactNode;
}) {
  const { editable, slideId } = useEdit();
  const setProp = useStore((s) => s.setProp);
  const slide = useStore((s) => s.slides.find((sl) => sl.id === slideId));
  const listKey = `${slideId}|${path}`;
  const listActive = useStore((s) => s.activeList) === listKey;
  const setActiveList = useStore((s) => s.setActiveList);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLElement | null>(null);

  if (!editable || !slideId || !slide) return <>{children}</>;

  const arr = (): unknown[] => {
    const a = getPath(slide.props, path);
    return Array.isArray(a) ? [...a] : [];
  };
  const commit = (a: unknown[]) => setProp(slideId, path, a);
  const isLast = index === arr().length - 1;

  const append = () => {
    const a = arr();
    const tpl =
      blank !== undefined
        ? structuredClone(blank)
        : typeof a[index] === 'string'
        ? ''
        : {};
    a.push(tpl);
    commit(a);
    setActiveList(listKey); // adding is editing — keep the + around
  };
  const remove = () => {
    const a = arr();
    if (a.length <= 1) return;
    a.splice(index, 1);
    commit(a);
  };

  /* Pointer-based reorder: mousedown on the handle, move over any sibling
     (found via elementsFromPoint + data attributes), insertion line marks the
     landing side, mouseup commits. No native DnD = no cancelled drags. */
  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.add('li-dragging');
    wrapRef.current?.classList.add('li-src');
    let target: {
      el: HTMLElement;
      index: number;
      side: 'before' | 'after';
    } | null = null;
    const clearTarget = () => {
      target?.el.classList.remove('li-over-before', 'li-over-after');
      target = null;
    };
    const onMove = (ev: MouseEvent) => {
      const hit = document
        .elementsFromPoint(ev.clientX, ev.clientY)
        .find(
          (el): el is HTMLElement =>
            el instanceof HTMLElement &&
            el.dataset.liKey === listKey &&
            Number(el.dataset.liIndex) !== index
        );
      if (!hit) {
        clearTarget();
        return;
      }
      const ti = Number(hit.dataset.liIndex);
      const side: 'before' | 'after' = index < ti ? 'after' : 'before';
      if (target?.el !== hit || target?.side !== side) {
        clearTarget();
        hit.classList.add(`li-over-${side}`);
        target = { el: hit, index: ti, side };
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('li-dragging');
      wrapRef.current?.classList.remove('li-src');
      if (target) {
        const a = arr();
        const [moved] = a.splice(index, 1);
        a.splice(target.index, 0, moved);
        commit(a);
      }
      clearTarget();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <span
      ref={(el: HTMLElement | null) => {
        wrapRef.current = el;
      }}
      className={'li' + (listActive ? ' list-active' : '')}
      data-li-key={listKey}
      data-li-index={index}
      onFocus={() => setActiveList(listKey)} // bubbles up from the T inside
      onBlur={() => {
        setTimeout(() => {
          // keep the + while focus stays anywhere inside a list item
          if (
            useStore.getState().activeList === listKey &&
            !document.activeElement?.closest?.('.li')
          ) {
            setActiveList(null);
          }
        }, 250);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {children}
      <span className="li-tools" contentEditable={false}>
        <span
          className="li-h"
          title="Drag to reorder · right-click to delete"
          onMouseDown={startDrag}
        >
          ⠿
        </span>
      </span>
      {isLast && (
        <span
          className="li-add"
          role="button"
          tabIndex={0}
          contentEditable={false}
          title="Add item"
          onClick={(e) => {
            e.stopPropagation();
            append();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              append();
            }
          }}
        >
          +
        </span>
      )}
      {menu &&
        createPortal(
          <ContextMenu
            x={menu.x}
            y={menu.y}
            items={[{ label: 'Delete item', danger: true, onClick: remove }]}
            onClose={() => setMenu(null)}
          />,
          document.body
        )}
    </span>
  );
}
