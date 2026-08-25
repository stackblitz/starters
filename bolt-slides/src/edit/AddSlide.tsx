/* "New slide" picker — every layout in the registry, each card showing a live
   preview rendered from the layout's default content. Same dialog trap as
   Share (Tab cycle, Escape, no slide paging while open). Height is locked
   to the max so category filters do not resize the chrome. */
import { useRef, useState } from 'react';
import { useStore } from '../data/store';
import { LAYOUT_LIST, LAYOUT_GROUPS, LAYOUTS } from '../layouts/registry';
import type { LayoutDef } from '../layouts/registry';
import type { SlideData } from '../data/types';
import { IconClose } from '../deck/icons';
import MiniSlide from './MiniSlide';
import { useDialogTrap } from './useDialogTrap';

/* varied blue/black backgrounds cycle through the preview cards so the grid
   reads dynamic — all within the theme's family */
import type { Background } from '../data/types';
const PREVIEW_BGS: Background[] = [
  { type: 'none' },
  { type: 'gradient', from: '#0d1b3d', to: '#1688fc', angle: 150 },
  { type: 'color', color: '#0a0f1e' },
  { type: 'gradient', from: '#0b1026', to: '#12325e', angle: 135 },
  { type: 'none' },
  { type: 'gradient', from: '#04121f', to: '#0e4f63', angle: 160 },
  { type: 'color', color: '#10131a' },
  { type: 'none' },
];

const previewSlide = (l: LayoutDef, i: number): SlideData => ({
  id: `preview-${l.type}`,
  position: 0,
  layout: l.type,
  props: l.defaults,
  background: PREVIEW_BGS[i % PREVIEW_BGS.length],
  animation: 'none',
  transition: null,
  nav: null,
  notes: '',
  status: 'none',
});

export default function AddSlide({
  at,
  onClose,
}: {
  at?: number;
  onClose: () => void;
}) {
  const addSlide = useStore((s) => s.addSlide);
  const [filter, setFilter] = useState<string | null>(null);
  const groups = LAYOUT_GROUPS.filter((g) => !filter || g.title === filter);
  const ref = useRef<HTMLDivElement>(null);
  useDialogTrap(ref, onClose);

  return (
    <div
      className="modal-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal add-slide"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-slide-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3 id="add-slide-title">New slide</h3>
          <button
            type="button"
            className="icon-btn"
            data-tip="Close"
            aria-label="Close"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>
        <div className="add-pills">
          <button
            type="button"
            className={'add-pill' + (filter === null ? ' on' : '')}
            onClick={() => setFilter(null)}
          >
            All
          </button>
          {LAYOUT_GROUPS.map((g) => (
            <button
              type="button"
              key={g.title}
              className={'add-pill' + (filter === g.title ? ' on' : '')}
              onClick={() => setFilter(g.title)}
            >
              {g.title}
            </button>
          ))}
        </div>
        <div className="add-slide-body">
          {groups.map((g) => (
            <div key={g.title} className="add-group">
              <div className="add-group-title">{g.title}</div>
              <div className="add-grid">
                {g.types
                  .map((t) => LAYOUTS[t])
                  .filter(Boolean)
                  .map((l) => {
                    const i = LAYOUT_LIST.indexOf(l); // stable background per layout
                    return (
                      <div
                        key={l.type}
                        className="add-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          addSlide(
                            l.type,
                            structuredClone(l.defaults),
                            at,
                            structuredClone(PREVIEW_BGS[i % PREVIEW_BGS.length])
                          );
                          onClose();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addSlide(
                              l.type,
                              structuredClone(l.defaults),
                              at,
                              structuredClone(
                                PREVIEW_BGS[i % PREVIEW_BGS.length]
                              )
                            );
                            onClose();
                          }
                        }}
                      >
                        <span className="add-card-preview">
                          <MiniSlide slide={previewSlide(l, i)} />
                        </span>
                        <span className="add-card-name">{l.label}</span>
                        <span className="add-card-hint">{l.hint}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
