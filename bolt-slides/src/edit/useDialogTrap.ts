/* Focus trap + Escape for editor dialogs. While a dialog is open, keydown
   is isolated so canvas paging and other window shortcuts cannot fire.
   Tab cycles inside the dialog; focus returns to the control that opened it. */
import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1
  );
}

export function useDialogTrap(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void
) {
  const opener = useRef<Element | null>(
    typeof document !== 'undefined' ? document.activeElement : null
  );
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const root = ref.current;
    focusables(root)[0]?.focus();

    const onCapture = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !root) return;
      const f = focusables(root);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    /* bubble: the focused control has already handled the key. Stop it
       here so window listeners (slide paging) never see it. Capture must
       not stopPropagation or inputs inside the dialog would never type. */
    const onBubble = (e: KeyboardEvent) => {
      e.stopPropagation();
    };

    document.addEventListener('keydown', onCapture, true);
    document.addEventListener('keydown', onBubble);
    return () => {
      document.removeEventListener('keydown', onCapture, true);
      document.removeEventListener('keydown', onBubble);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [ref]);
}
