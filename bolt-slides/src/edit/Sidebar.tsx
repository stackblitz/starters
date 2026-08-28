/* Slide rail — always visible while you move through the deck. Drag to
   reorder (dnd-kit), right-click for duplicate / delete. */
import { useState } from 'react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '../data/store';
import { type SlideData } from '../data/types';
import MiniSlide from './MiniSlide';
import ContextMenu, { type MenuItem } from './ContextMenu';

function Row({
  slide,
  index,
  active,
  onSelect,
  onMenu,
}: {
  slide: SlideData;
  index: number;
  active: boolean;
  onSelect: () => void;
  onMenu: (e: React.MouseEvent) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      className={'side-row' + (active ? ' active' : '')}
      title={slide.nav ?? undefined}
      onClick={onSelect}
      onContextMenu={onMenu}
      {...attributes}
      {...listeners}
    >
      <div className="side-row-gutter">
        <span className="side-no">{index + 1}</span>
      </div>
      <div className="side-thumb">
        <MiniSlide slide={slide} />
      </div>
    </div>
  );
}

export default function Sidebar() {
  const slides = useStore((state) => state.slides);
  const current = useStore((state) => state.current);
  const setCurrent = useStore((state) => state.setCurrent);
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

  return (
    <aside className="ed-side">
      <div className="ed-side-head">
        <span>Slides</span>
      </div>
      <div className="ed-side-list">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={slides.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {slides.map((s, i) => (
              <Row
                key={s.id}
                slide={s}
                index={i}
                active={i === current}
                onSelect={() => setCurrent(i)}
                onMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, id: s.id });
                }}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.id)}
          onClose={() => setMenu(null)}
        />
      )}
    </aside>
  );
}
