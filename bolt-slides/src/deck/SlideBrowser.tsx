/* Shared slide rail + grid overview. `mutable` turns on reorder (dnd-kit)
   and duplicate / delete via the context menu; published stays nav-only. */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SlideData } from '../data/types';
import { useStore } from '../data/store';
import ContextMenu, { type MenuItem } from '../edit/ContextMenu';
import SlideView from '../slide/SlideView';
import Thumb from './Thumb';
import { IconClose } from './icons';
import { useScrolled } from './deckHooks';
import { STAGE_LAYOUT_TRANSITION } from './stageLayout';

export type BrowseMode = 'none' | 'rail' | 'grid';

function columnCount(list: HTMLElement | null): number {
  if (!list || list.children.length < 2) return 1;
  const rowTop = (list.children[0] as HTMLElement).offsetTop;
  let cols = 1;
  for (let i = 1; i < list.children.length; i++) {
    if ((list.children[i] as HTMLElement).offsetTop !== rowTop) break;
    cols++;
  }
  return cols;
}

function moveGridFocus(
  from: number,
  key: string,
  count: number,
  cols: number
): number | null {
  if (count <= 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowRight') return Math.min(count - 1, from + 1);
  if (key === 'ArrowLeft') return Math.max(0, from - 1);
  if (key === 'ArrowDown') {
    const next = from + cols;
    return next < count ? next : from;
  }
  if (key === 'ArrowUp') {
    const next = from - cols;
    return next >= 0 ? next : from;
  }
  return null;
}

function renderSlide(slide: SlideData) {
  return (
    <SlideView
      slide={slide}
      notes={slide.notes}
      transition={slide.transition ?? undefined}
    />
  );
}

function thumbClass(grid: boolean, active: boolean, selected = false) {
  return (
    'noir-thumb' +
    (grid ? ' noir-thumb-grid' : '') +
    (active ? ' active' : '') +
    (selected ? ' sel' : '')
  );
}

function ThumbBody({
  slide,
  index,
  grid,
}: {
  slide: SlideData;
  index: number;
  grid: boolean;
}) {
  return (
    <>
      {!grid && <span className="noir-thumb-no">{index + 1}</span>}
      <Thumb>{renderSlide(slide)}</Thumb>
      {grid && <span className="noir-thumb-no">{index + 1}</span>}
    </>
  );
}

function NavThumb({
  slide,
  index,
  active,
  selected,
  grid,
  tabIndex,
  navLabel,
  thumbRef,
  onPick,
  onOpen,
  onKeyDown,
}: {
  slide: SlideData;
  index: number;
  active: boolean;
  selected?: boolean;
  grid: boolean;
  tabIndex?: number;
  navLabel?: (index: number) => string | undefined;
  thumbRef?: (node: HTMLButtonElement | null) => void;
  onPick?: () => void;
  onOpen?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const name = navLabel?.(index);
  const label = grid
    ? `Slide ${index + 1}${name ? ' — ' + name : ''}. Double-click to open.`
    : `Go to slide ${index + 1}${name ? ' — ' + name : ''}`;
  return (
    <button
      ref={thumbRef}
      type="button"
      className={thumbClass(grid, active, selected)}
      tabIndex={tabIndex}
      aria-label={label}
      aria-current={active ? 'true' : undefined}
      aria-selected={grid ? selected : undefined}
      role={grid ? 'option' : undefined}
      onClick={onPick}
      onDoubleClick={onOpen}
      onKeyDown={onKeyDown}
    >
      <ThumbBody slide={slide} index={index} grid={grid} />
    </button>
  );
}

function SortableThumb({
  slide,
  index,
  active,
  selected,
  grid,
  tabIndex,
  navLabel,
  thumbRef,
  onPick,
  onOpen,
  onKeyDown,
  onMenu,
}: {
  slide: SlideData;
  index: number;
  active: boolean;
  selected?: boolean;
  grid: boolean;
  tabIndex?: number;
  navLabel?: (index: number) => string | undefined;
  thumbRef?: (node: HTMLButtonElement | null) => void;
  onPick?: () => void;
  onOpen?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onMenu: (event: React.MouseEvent) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const name = navLabel?.(index);
  const label = grid
    ? `Slide ${index + 1}${name ? ' — ' + name : ''}. Double-click to open.`
    : `Go to slide ${index + 1}${name ? ' — ' + name : ''}`;

  return (
    <button
      ref={(node) => {
        setNodeRef(node);
        thumbRef?.(node);
      }}
      type="button"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      className={thumbClass(grid, active, selected)}
      aria-label={label}
      aria-current={active ? 'true' : undefined}
      {...attributes}
      {...listeners}
      tabIndex={tabIndex}
      role={grid ? 'option' : undefined}
      aria-selected={grid ? selected : undefined}
      onClick={onPick}
      onDoubleClick={onOpen}
      onKeyDown={onKeyDown}
      onContextMenu={onMenu}
    >
      <ThumbBody slide={slide} index={index} grid={grid} />
    </button>
  );
}

export default function SlideBrowser({
  slides,
  current,
  browse,
  mutable = false,
  navLabel,
  onGo,
  onClose,
}: {
  slides: SlideData[];
  current: number;
  browse: BrowseMode;
  mutable?: boolean;
  navLabel?: (index: number) => string | undefined;
  onGo: (index: number) => void;
  onClose: () => void;
}) {
  const railOpen = browse === 'rail';
  const gridOpen = browse === 'grid';
  const [railThumbs, setRailThumbs] = useState(railOpen);
  const railOpenRef = useRef(railOpen);
  railOpenRef.current = railOpen;
  const railRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const railScrolled = useScrolled(railRef, railOpen);
  const gridScrolled = useScrolled(gridRef, gridOpen);
  const reorder = useStore((state) => state.reorder);
  const duplicateSlide = useStore((state) => state.duplicateSlide);
  const deleteSlide = useStore((state) => state.deleteSlide);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(
    null
  );
  const [gridFocus, setGridFocus] = useState(current);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const gridWasOpen = useRef(false);

  useEffect(() => {
    if (railOpen) setRailThumbs(true);
  }, [railOpen]);

  useEffect(() => {
    if (gridOpen && !gridWasOpen.current) {
      setGridFocus(Math.max(0, Math.min(current, slides.length - 1)));
    }
    gridWasOpen.current = gridOpen;
  }, [gridOpen, current, slides.length]);

  useEffect(() => {
    if (!gridOpen) return;
    setGridFocus((index) =>
      Math.max(0, Math.min(index, Math.max(0, slides.length - 1)))
    );
  }, [gridOpen, slides.length]);

  useEffect(() => {
    if (!gridOpen) return;
    const el = thumbRefs.current[gridFocus];
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest' });
  }, [gridFocus, gridOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = slides.findIndex((slide) => slide.id === active.id);
    const to = slides.findIndex((slide) => slide.id === over.id);
    if (from < 0 || to < 0) return;
    reorder(
      arrayMove(
        slides.map((slide) => slide.id),
        from,
        to
      )
    );
  };

  const menuItems = (id: string): MenuItem[] => [
    { label: 'Duplicate', onClick: () => duplicateSlide(id) },
    { separator: true, label: '' },
    { label: 'Delete', danger: true, onClick: () => deleteSlide(id) },
  ];

  const onMenu = mutable
    ? (event: React.MouseEvent, id: string) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY, id });
      }
    : undefined;

  const ids = slides.map((slide) => slide.id);

  const onGridKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onGo(index);
      onClose();
      return;
    }
    const list = gridRef.current?.querySelector('.noir-grid-list');
    const next = moveGridFocus(
      index,
      event.key,
      slides.length,
      columnCount(list instanceof HTMLElement ? list : null)
    );
    if (next == null || next === index) return;
    event.preventDefault();
    event.stopPropagation();
    setGridFocus(next);
  };

  const thumbs = (grid: boolean) =>
    slides.map((slide, i) => {
      const selected = grid && i === gridFocus;
      const onPick = grid ? () => setGridFocus(i) : () => onGo(i);
      const onOpen = grid
        ? () => {
            onGo(i);
            onClose();
          }
        : undefined;
      const thumbRef = grid
        ? (node: HTMLButtonElement | null) => {
            thumbRefs.current[i] = node;
          }
        : undefined;
      const onKeyDown = grid
        ? (event: React.KeyboardEvent<HTMLButtonElement>) =>
            onGridKeyDown(i, event)
        : undefined;
      if (!mutable || !onMenu)
        return (
          <NavThumb
            key={slide.id}
            slide={slide}
            index={i}
            active={i === current}
            selected={selected}
            grid={grid}
            tabIndex={grid ? (selected ? 0 : -1) : undefined}
            navLabel={navLabel}
            thumbRef={thumbRef}
            onPick={onPick}
            onOpen={onOpen}
            onKeyDown={onKeyDown}
          />
        );
      return (
        <SortableThumb
          key={slide.id}
          slide={slide}
          index={i}
          active={i === current}
          selected={selected}
          grid={grid}
          tabIndex={grid ? (selected ? 0 : -1) : undefined}
          navLabel={navLabel}
          thumbRef={thumbRef}
          onPick={onPick}
          onOpen={onOpen}
          onKeyDown={onKeyDown}
          onMenu={(event) => onMenu(event, slide.id)}
        />
      );
    });

  const wrap = (grid: boolean, children: React.ReactNode) => {
    if (!mutable) return children;
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={ids}
          strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}
        >
          {children}
        </SortableContext>
      </DndContext>
    );
  };

  return (
    <>
      <motion.aside
        className={'noir-rail' + (railOpen ? ' open' : '')}
        ref={railRef}
        initial={false}
        animate={{ x: railOpen ? 0 : '-100%' }}
        transition={STAGE_LAYOUT_TRANSITION}
        onAnimationComplete={() => {
          if (!railOpenRef.current) setRailThumbs(false);
        }}
      >
        <div className={'noir-rail-head' + (railScrolled ? ' scrolled' : '')}>
          <span className="noir-rail-title">Slides</span>
          <button
            type="button"
            className="noir-icon-btn sm"
            data-tip="Close"
            aria-label="Close the slide panel"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>
        <div className="noir-rail-list">
          {railThumbs && wrap(false, thumbs(false))}
        </div>
      </motion.aside>

      <AnimatePresence>
        {gridOpen && (
          <motion.div
            className="noir-grid"
            ref={gridRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div
              className={'noir-grid-head' + (gridScrolled ? ' scrolled' : '')}
            >
              <span className="noir-rail-title">
                All slides · {slides.length}
              </span>
              <button
                type="button"
                className="noir-icon-btn sm"
                data-tip="Close"
                aria-label="Close the grid overview"
                onClick={onClose}
              >
                <IconClose />
              </button>
            </div>
            <div
              className="noir-grid-list"
              role="listbox"
              aria-label="All slides"
            >
              {wrap(true, thumbs(true))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.id)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
