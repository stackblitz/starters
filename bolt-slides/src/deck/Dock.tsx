/* Shared floating dock — same chrome in the editor, in-place present,
   and the published audience view. Mode gates which controls appear;
   pointer-drag on the grip repositions it (persisted). */
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import {
  IconClose,
  IconExpand,
  IconDownload,
  IconGrid,
  IconGrip,
  IconLeft,
  IconNotes,
  IconPencil,
  IconPlay,
  IconPresent,
  IconRight,
  IconShrink,
  IconSidebar,
} from './icons';
import MenuButton, { type MenuButtonItem } from '../edit/MenuButton';
import { useDockPopoverHost } from './dockPopoverContext';

export type DockMode = 'editor' | 'editor-present' | 'audience';

const STORAGE_KEY = 'deck:dock-pos';
const PAD = 8;
const DEFAULT_BOTTOM = 22;

type Pos = { left: number; top: number };

function readPos(): Pos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Pos;
    if (typeof value.left === 'number' && typeof value.top === 'number')
      return value;
  } catch {
    /* ignore quota / parse */
  }
  return null;
}

function writePos(pos: Pos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* ignore quota */
  }
}

function clamp(left: number, top: number, width: number, height: number): Pos {
  return {
    left: Math.min(
      Math.max(PAD, left),
      Math.max(PAD, window.innerWidth - width - PAD)
    ),
    top: Math.min(
      Math.max(PAD, top),
      Math.max(PAD, window.innerHeight - height - PAD)
    ),
  };
}

function defaultPos(width: number, height: number): Pos {
  return {
    left: Math.round((window.innerWidth - width) / 2),
    top: Math.round(window.innerHeight - height - DEFAULT_BOTTOM),
  };
}

export type DockProps = {
  mode: DockMode;
  slideIndex: number;
  slideCount: number;
  hasPrev: boolean;
  hasNext: boolean;
  railOpen: boolean;
  gridOpen: boolean;
  hidden?: boolean;
  drawing?: boolean;
  notesOpen?: boolean;
  isFullscreen?: boolean;
  exportBusy?: string | null;
  exportFlash?: string | null;
  onToggleRail: () => void;
  onToggleGrid: () => void;
  onPrev: () => void;
  onNext: () => void;
  onNotes?: () => void;
  notesBtnRef?: Ref<HTMLButtonElement | null>;
  notesId?: string;
  /** Content anchored above the bar (notes, annotate, …). Follows dock drag. */
  popoverSlot?: ReactNode;
  /** @deprecated use popoverSlot */
  notesSlot?: ReactNode;
  onAnnotate?: () => void;
  onFullscreen?: () => void;
  onPresenter?: () => void;
  onPresent?: () => void;
  onBack?: () => void;
  exportItems?: MenuButtonItem[];
};

const Dock = forwardRef<HTMLDivElement, DockProps>(function Dock(
  {
    mode,
    slideIndex,
    slideCount,
    hasPrev,
    hasNext,
    railOpen,
    gridOpen,
    hidden,
    drawing,
    notesOpen,
    isFullscreen,
    exportBusy,
    exportFlash,
    onToggleRail,
    onToggleGrid,
    onPrev,
    onNext,
    onNotes,
    notesBtnRef,
    notesId,
    popoverSlot,
    notesSlot,
    onAnnotate,
    onFullscreen,
    onPresenter,
    onPresent,
    onBack,
    exportItems,
  },
  ref
) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const setRefs = (node: HTMLDivElement | null) => {
    nodeRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };
  const customRef = useRef(readPos() != null);
  const [pos, setPos] = useState<Pos | null>(null);
  const posRef = useRef<Pos | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const notesFallbackId = useId();
  const notesControlId = notesId ?? notesFallbackId;
  const dockPopover = useDockPopoverHost();
  const popover = popoverSlot ?? notesSlot;

  const applyFit = useCallback((next: Pos, el: HTMLElement) => {
    return clamp(next.left, next.top, el.offsetWidth, el.offsetHeight);
  }, []);

  const place = useCallback(() => {
    if (draggingRef.current) return;
    const el = nodeRef.current;
    if (!el) return;
    const saved = customRef.current ? readPos() : null;
    const next = applyFit(
      saved ?? defaultPos(el.offsetWidth, el.offsetHeight),
      el
    );
    posRef.current = next;
    setPos(next);
  }, [applyFit]);

  useLayoutEffect(() => {
    place();
  }, [place, mode, slideCount]);

  useEffect(() => {
    const onResize = () => place();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [place]);

  const onGripPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const el = nodeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragOffset.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    customRef.current = true;
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onGripPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    const el = nodeRef.current;
    if (!el) return;
    const next = applyFit(
      {
        left: event.clientX - dragOffset.current.x,
        top: event.clientY - dragOffset.current.y,
      },
      el
    );
    posRef.current = next;
    setPos(next);
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const el = nodeRef.current;
    const current = posRef.current;
    if (!el || !current) return;
    const next = applyFit(current, el);
    posRef.current = next;
    setPos(next);
    writePos(next);
  };

  const isEditor = mode === 'editor';
  const isPresentSurface = mode !== 'editor';
  const showPresenter = mode !== 'audience' && !!onPresenter;
  const toast = exportBusy ?? exportFlash ?? null;

  return (
    <div
      ref={setRefs}
      className={
        'noir-dock' +
        (isEditor ? ' editor' : '') +
        (hidden ? ' hidden' : '') +
        (dragging ? ' dragging' : '') +
        (pos ? ' placed' : '')
      }
      style={pos ? { left: pos.left, top: pos.top } : undefined}
    >
      {toast && (
        <span
          className={'nav-toast' + (exportBusy ? ' busy' : '')}
          role="status"
          aria-live="polite"
        >
          {toast}
        </span>
      )}
      <div
        className="noir-dock-popover"
        ref={(node) => dockPopover?.setHost(node)}
      >
        {popover}
      </div>
      <div className="noir-bar">
        <button
          type="button"
          className="noir-grip"
          data-tip="Drag to move"
          aria-label="Move toolbar"
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <IconGrip />
        </button>
        {isEditor && (
          <>
            <button
              type="button"
              className={'noir-icon-btn' + (railOpen ? ' on' : '')}
              data-tip="Side panel (S)"
              aria-label="Slide panel"
              aria-pressed={railOpen}
              onClick={onToggleRail}
            >
              <IconSidebar />
            </button>
            <button
              type="button"
              className={'noir-icon-btn' + (gridOpen ? ' on' : '')}
              data-tip="Grid overview (G)"
              aria-label="Grid overview"
              aria-pressed={gridOpen}
              onClick={onToggleGrid}
            >
              <IconGrid />
            </button>
            <span className="noir-sep" />
          </>
        )}
        <button
          type="button"
          className="noir-icon-btn"
          data-tip={hasPrev ? 'Previous' : undefined}
          aria-label="Previous slide"
          disabled={!hasPrev}
          onClick={onPrev}
        >
          <IconLeft />
        </button>
        <div className="noir-counter">
          <span className="noir-counter-now">
            {slideCount ? slideIndex + 1 : 0}
          </span>
          <span className="noir-counter-tot">/ {slideCount}</span>
        </div>
        <button
          type="button"
          className="noir-icon-btn"
          data-tip={hasNext ? 'Next' : undefined}
          aria-label="Next slide"
          disabled={!hasNext}
          onClick={onNext}
        >
          <IconRight />
        </button>
        {(isEditor || isPresentSurface) && <span className="noir-sep" />}
        {isEditor && exportItems && (
          <MenuButton
            label="Download"
            buttonClassName="noir-icon-btn"
            tip={exportBusy ? undefined : 'Download as PDF or JSON'}
            disabled={!!exportBusy}
            items={exportItems}
          >
            <IconDownload />
          </MenuButton>
        )}
        {isEditor && onNotes && (
          <button
            ref={notesBtnRef}
            type="button"
            className={'noir-icon-btn' + (notesOpen ? ' on' : '')}
            data-tip="Speaker notes"
            aria-label="Edit speaker notes for this slide"
            aria-haspopup="dialog"
            aria-expanded={notesOpen}
            aria-controls={notesOpen ? notesControlId : undefined}
            onPointerDown={(event) => {
              if (event.button === 0) event.preventDefault();
            }}
            onClick={onNotes}
          >
            <IconNotes />
          </button>
        )}
        {isPresentSurface && onAnnotate && (
          <button
            type="button"
            className={'noir-icon-btn noir-optional' + (drawing ? ' on' : '')}
            data-tip="Annotate (D)"
            aria-label="Annotate the slide"
            aria-pressed={drawing}
            onClick={onAnnotate}
          >
            <IconPencil />
          </button>
        )}
        {isPresentSurface && onFullscreen && (
          <button
            type="button"
            className="noir-icon-btn"
            data-tip={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={onFullscreen}
          >
            {isFullscreen ? <IconShrink /> : <IconExpand />}
          </button>
        )}
        {showPresenter && (
          <button
            type="button"
            className="noir-icon-btn noir-optional"
            data-tip="Presenter — new tab (P)"
            aria-label="Presenter — new tab (P)"
            onClick={onPresenter}
          >
            <IconPresent />
          </button>
        )}
        {isEditor && onPresent && (
          <button
            type="button"
            className="noir-icon-btn"
            data-tip={slideCount ? 'Present' : undefined}
            aria-label="Present this deck"
            disabled={!slideCount}
            onClick={onPresent}
          >
            <IconPlay />
          </button>
        )}
        {onBack && (
          <>
            <span className="noir-sep" />
            <button
              type="button"
              className="noir-icon-btn danger"
              data-tip="Back to editor (Esc)"
              aria-label="Back to the editor"
              onClick={onBack}
            >
              <IconClose />
            </button>
          </>
        )}
      </div>
    </div>
  );
});

export default Dock;
