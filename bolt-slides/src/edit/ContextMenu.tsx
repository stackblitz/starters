/* Minimal right-click menu — fixed-positioned, closes on any click/Escape. */
import { useEffect } from 'react';

export interface MenuItem {
  label: string;
  danger?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const my = Math.min(y, window.innerHeight - items.length * 34 - 20);
  return (
    <div
      className="ctx-overlay"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="ctx-menu"
        style={{ left: Math.min(x, window.innerWidth - 190), top: my }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((it, i) =>
          it.separator ? (
            <div key={i} className="ctx-sep" />
          ) : (
            <button
              key={i}
              className={'ctx-item' + (it.danger ? ' danger' : '')}
              onClick={() => {
                it.onClick?.();
                onClose();
              }}
            >
              {it.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}
