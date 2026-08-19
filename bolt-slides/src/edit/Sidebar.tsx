/* Slide rail — always visible while you move through the deck. Drag to
   reorder (dnd-kit), right-click for duplicate / delete / insert. */
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
import { useStore } from '@/data/store';
import { type SlideData } from '@/data/types';
import MiniSlide from '@/edit/MiniSlide';
import ContextMenu, { type MenuItem } from '@/edit/ContextMenu';
import AddSlide from '@/edit/AddSlide';

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
  const comments = useStore((s) => s.comments);
  const openComments = comments.filter(
    (c) => c.slide_id === slide.id && !c.resolved
  ).length;

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
        {openComments > 0 && (
          <div className="side-badges">
            <span className="side-badge cmt">{openComments}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const slides = useStore((s) => s.slides);
  const current = useStore((s) => s.current);
  const setCurrent = useStore((s) => s.setCurrent);
  const reorder = useStore((s) => s.reorder);
  const duplicateSlide = useStore((s) => s.duplicateSlide);
  const deleteSlide = useStore((s) => s.deleteSlide);

  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(
    null
  );
  const [addAt, setAddAt] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = slides.findIndex((s) => s.id === active.id);
    const to = slides.findIndex((s) => s.id === over.id);
    reorder(
      arrayMove(
        slides.map((s) => s.id),
        from,
        to
      )
    );
  };

  const menuItems = (id: string): MenuItem[] => {
    const idx = slides.findIndex((s) => s.id === id);
    return [
      { label: 'Add slide after', onClick: () => setAddAt(idx + 1) },
      { label: 'Duplicate', onClick: () => duplicateSlide(id) },
      { separator: true, label: '' },
      { label: 'Delete', danger: true, onClick: () => deleteSlide(id) },
    ];
  };

  return (
    <aside className="ed-side">
      <div className="ed-side-head">
        <span>Slides</span>
        <button
          className="ghost-btn"
          title="Add slide"
          onClick={() => setAddAt(slides.length)}
        >
          + Add
        </button>
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
      {addAt != null && <AddSlide at={addAt} onClose={() => setAddAt(null)} />}
    </aside>
  );
}
