import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface MenuButtonItem {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

export default function MenuButton({
  label,
  items,
  disabled,
  tip,
  buttonClassName = 'ghost-btn',
  wrapClassName,
  placement = 'up',
  tabIndex,
  children,
}: {
  label: string;
  items: MenuButtonItem[];
  disabled?: boolean;
  tip?: string;
  buttonClassName?: string;
  wrapClassName?: string;
  /** Dock export opens up; thumb actions open down. */
  placement?: 'up' | 'down';
  tabIndex?: number;
  children?: ReactNode;
}) {
  const uid = useId();
  const buttonId = `${uid}-btn`;
  const menuId = `${uid}-menu`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const enabled = items
    .map((it, i) => (it.disabled ? -1 : i))
    .filter((i) => i >= 0);

  const close = (restore: boolean) => {
    setOpen(false);

    if (restore) btnRef.current?.focus();
  };

  const openAt = (index: number) => {
    const i = enabled.includes(index) ? index : enabled[0] ?? 0;

    setActive(i);
    setOpen(true);
  };

  const move = (dir: 1 | -1) => {
    if (!enabled.length) return;

    const at = enabled.indexOf(active);
    const next = enabled[(at + dir + enabled.length) % enabled.length];

    setActive(next);
  };

  useLayoutEffect(() => {
    if (!open) return;

    itemRefs.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;

    const onPtr = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        close(false);
      }
    };

    document.addEventListener('pointerdown', onPtr);

    return () => document.removeEventListener('pointerdown', onPtr);
  }, [open]);

  const focusAfterButton = (shift: boolean) => {
    const btn = btnRef.current;

    if (!btn) return;

    const ordered = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ),
    ].filter((el) => el.offsetParent !== null && !el.closest('[role="menu"]'));
    const i = ordered.indexOf(btn);
    const target = shift
      ? ordered[i - 1] ?? ordered[ordered.length - 1]
      : ordered[i + 1] ?? ordered[0];

    target?.focus();
  };

  const onButtonKey = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      openAt(enabled[0] ?? 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      openAt(enabled[enabled.length - 1] ?? 0);
    }
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close(true);
        break;
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        e.preventDefault();
        if (enabled.length) setActive(enabled[0]);
        break;
      case 'End':
        e.preventDefault();
        if (enabled.length) setActive(enabled[enabled.length - 1]);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        activate(active);
        break;
      case 'Tab':
        e.preventDefault();
        close(false);
        focusAfterButton(e.shiftKey);
        break;
      default:
        break;
    }
  };

  const activate = (index: number) => {
    const it = items[index];

    if (!it || it.disabled) return;

    close(true);
    it.onSelect();
  };

  return (
    <div
      className={
        'dl-wrap' +
        (wrapClassName ? ' ' + wrapClassName : '') +
        (open ? ' open' : '')
      }
      ref={wrapRef}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <button
        ref={btnRef}
        id={buttonId}
        type="button"
        className={buttonClassName + (open ? ' on' : '')}
        title={tip}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        tabIndex={tabIndex}
        onClick={() => (open ? close(true) : openAt(enabled[0] ?? 0))}
        onKeyDown={onButtonKey}
      >
        {children ?? label}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={'dl-pop' + (placement === 'down' ? ' down' : '')}
          aria-labelledby={buttonId}
          onKeyDown={onMenuKey}
        >
          {items.map((it, i) => (
            <div
              key={it.id}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              role="menuitem"
              tabIndex={i === active ? 0 : -1}
              aria-disabled={it.disabled || undefined}
              className={it.danger ? 'danger' : undefined}
              onClick={() => activate(i)}
              onMouseEnter={() => {
                if (!it.disabled) setActive(i);
              }}
            >
              {it.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
