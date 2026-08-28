/* Shared slide rail + grid overview. `mutable` turns on reorder (dnd-kit)
   and duplicate / delete via the context menu; published stays nav-only. */
import { useRef, useState } from 'react';
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

export type BrowseMode = 'none' | 'rail' | 'grid';

function renderSlide(slide: SlideData) {
  return (
    <SlideView
      slide={slide}
      notes={slide.notes}
      transition={slide.transition ?? undefined}
    />
  );
}

function thumbClass(grid: boolean, active: boolean) {
  return (
    'noir-thumb' + (grid ? ' noir-thumb-grid' : '') + (active ? ' active' : '')
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
  grid,
  navLabel,
  onPick,
}: {
  slide: SlideData;
  index: number;
  active: boolean;
  grid: boolean;
  navLabel?: (index: number) => string | undefined;
  onPick: () => void;
}) {
  const label = `Go to slide ${index + 1}${
    navLabel?.(index) ? ' — ' + navLabel(index) : ''
  }`;
  return (
    <button
      type="button"
      className={thumbClass(grid, active)}
      aria-label={label}
      aria-current={active ? 'true' : undefined}
      onClick={onPick}
    >
      <ThumbBody slide={slide} index={index} grid={grid} />
    </button>
  );
}

function SortableThumb({
  slide,
  index,
  active,
  grid,
  navLabel,
  onPick,
  onMenu,
}: {
  slide: SlideData;
  index: number;
  active: boolean;
  grid: boolean;
  navLabel?: (index: number) => string | undefined;
  onPick: () => void;
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

  const label = `Go to slide ${index + 1}${
    navLabel?.(index) ? ' — ' + navLabel(index) : ''
  }`;

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      className={thumbClass(grid, active)}
      aria-label={label}
      aria-current={active ? 'true' : undefined}
      onClick={onPick}
      onContextMenu={onMenu}
      {...attributes}
      {...listeners}
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

  const thumbs = (grid: boolean) =>
    slides.map((slide, i) => {
      const onPick = () => {
        onGo(i);
        if (grid) onClose();
      };
      if (!mutable || !onMenu)
        return (
          <NavThumb
            key={slide.id}
            slide={slide}
            index={i}
            active={i === current}
            grid={grid}
            navLabel={navLabel}
            onPick={onPick}
          />
        );
      return (
        <SortableThumb
          key={slide.id}
          slide={slide}
          index={i}
          active={i === current}
          grid={grid}
          navLabel={navLabel}
          onPick={onPick}
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
      <aside className={'noir-rail' + (railOpen ? ' open' : '')} ref={railRef}>
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
          {railOpen && wrap(false, thumbs(false))}
        </div>
      </aside>

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
            <div className="noir-grid-list">{wrap(true, thumbs(true))}</div>
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
