/**
 * Small UI kit for the admin, approximating @blitz/design-system on its
 * vendored tokens (`bolt-ds-*` colors from app/styles/bolt-ds-tokens.css).
 */
import { Loader2, X } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------------ */
/* Buttons                                                                   */
/* ------------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-bolt-ds-brand text-bolt-ds-onBrand hover:bg-bolt-ds-brandHover border-transparent',
  secondary:
    'bg-bolt-ds-bg text-bolt-ds-textPrimary border-bolt-ds-borderPrimary hover:bg-bolt-ds-bgSecondaryHover',
  ghost:
    'bg-transparent text-bolt-ds-textSecondary border-transparent hover:bg-bolt-ds-utilHover hover:text-bolt-ds-textPrimary',
  danger:
    'bg-bolt-ds-danger text-bolt-ds-onDanger hover:bg-bolt-ds-dangerHover border-transparent',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'secondary',
      size = 'md',
      loading,
      icon,
      className,
      children,
      disabled,
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={cx(
          'inline-flex items-center justify-center rounded-md border font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bolt-ds-brand disabled:cursor-not-allowed disabled:opacity-50',
          buttonVariants[variant],
          buttonSizes[size],
          className
        )}
        {...rest}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
        {children}
      </button>
    );
  }
);

/* ------------------------------------------------------------------------ */
/* Form controls                                                             */
/* ------------------------------------------------------------------------ */

export const controlClass =
  'w-full rounded-md border border-bolt-ds-borderPrimary bg-bolt-ds-bg px-3 py-2 text-sm text-bolt-ds-textPrimary placeholder:text-bolt-ds-textTertiary focus:border-bolt-ds-brand focus:outline-none focus:ring-2 focus:ring-bolt-ds-brandBorderSubtle disabled:opacity-60 read-only:bg-bolt-ds-bgSecondary';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(controlClass, className)} {...rest} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx(controlClass, 'min-h-20', className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cx(controlClass, 'appearance-none pr-8', className)}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label
      className={cx(
        'inline-flex items-center gap-2 text-sm text-bolt-ds-textPrimary',
        className
      )}
    >
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-bolt-ds-borderPrimary text-bolt-ds-brand accent-bolt-ds-brand"
        {...rest}
      />
      {label}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-bolt-ds-textPrimary">
          {label}
        </span>
        {description && (
          <span className="block text-xs text-bolt-ds-textTertiary">
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-bolt-ds-brand' : 'bg-bolt-ds-bgTertiary'
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
    </label>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-bolt-ds-textSecondary"
      >
        {label}
        {required && <span className="text-bolt-ds-danger"> *</span>}
      </label>
      {children}
      {hint && <p className="m-0 text-xs text-bolt-ds-textTertiary">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Layout                                                                    */
/* ------------------------------------------------------------------------ */

export function Card({
  title,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cx(
        'rounded-lg border border-bolt-ds-borderSecondary bg-bolt-ds-bgAlt shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        className
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-bolt-ds-borderSecondary px-4 py-2.5">
          {title && (
            <h2 className="m-0 text-sm font-semibold text-bolt-ds-textPrimary">
              {title}
            </h2>
          )}
          {actions}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="m-0 text-xl font-semibold tracking-tight text-bolt-ds-textPrimary">
          {title}
        </h1>
        {description && (
          <p className="m-0 mt-1 text-sm text-bolt-ds-textTertiary">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-bolt-ds-borderPrimary px-6 py-14 text-center">
      <p className="m-0 text-sm font-medium text-bolt-ds-textPrimary">
        {title}
      </p>
      {description && (
        <p className="m-0 max-w-sm text-sm text-bolt-ds-textTertiary">
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-2 py-10 text-sm text-bolt-ds-textTertiary"
      role="status"
    >
      <Loader2 size={16} className="animate-spin" /> {label}…
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-bolt-ds-dangerBorderSubtle bg-bolt-ds-dangerBgSubtle px-3 py-2 text-sm text-bolt-ds-onDangerBgSubtle">
      {message}
    </div>
  );
}

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-bolt-ds-bgTertiary text-bolt-ds-textSecondary',
  success: 'bg-bolt-ds-successBgSubtle text-bolt-ds-onSuccessBgSubtle',
  warning: 'bg-bolt-ds-warningBgSubtle text-bolt-ds-onWarningBgSubtle',
  danger: 'bg-bolt-ds-dangerBgSubtle text-bolt-ds-onDangerBgSubtle',
  brand: 'bg-bolt-ds-brandBgSubtle text-bolt-ds-onBrandBgSubtle',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium capitalize',
        badgeTones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'publish':
    case 'approved':
      return 'success';
    case 'draft':
    case 'pending':
    case 'hold':
    case 'future':
      return 'warning';
    case 'trash':
    case 'spam':
      return 'danger';
    case 'private':
      return 'brand';
    default:
      return 'neutral';
  }
}

/* ------------------------------------------------------------------------ */
/* Table                                                                     */
/* ------------------------------------------------------------------------ */

export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'overflow-x-auto rounded-lg border border-bolt-ds-borderSecondary bg-bolt-ds-bgAlt',
        className
      )}
    >
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cx(
        'border-b border-bolt-ds-borderSecondary bg-bolt-ds-bgSecondary px-3 py-2 text-left text-xs font-medium text-bolt-ds-textTertiary',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cx(
        'border-b border-bolt-ds-borderSecondary px-3 py-2.5 align-top text-bolt-ds-textPrimary',
        className
      )}
    >
      {children}
    </td>
  );
}

export function Pager({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-bolt-ds-textTertiary">
      <span>{total} items</span>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <span className="px-2">
          {page} / {pages}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Tabs                                                                      */
/* ------------------------------------------------------------------------ */

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: ReactNode; count?: number }>;
}) {
  return (
    <div
      className="mb-4 flex flex-wrap gap-1 border-b border-bolt-ds-borderSecondary"
      role="tablist"
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={cx(
            '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
            item.value === value
              ? 'border-bolt-ds-brand text-bolt-ds-textPrimary'
              : 'border-transparent text-bolt-ds-textTertiary hover:text-bolt-ds-textPrimary'
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="rounded-full bg-bolt-ds-bgTertiary px-1.5 text-[11px] text-bolt-ds-textSecondary">
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Dialog                                                                    */
/* ------------------------------------------------------------------------ */

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        'm-auto w-[calc(100%-2rem)] rounded-xl border border-bolt-ds-borderSecondary bg-bolt-ds-bgAlt p-0 text-bolt-ds-textPrimary shadow-2xl backdrop:bg-black/40',
        wide ? 'max-w-4xl' : 'max-w-lg'
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-bolt-ds-borderSecondary px-4 py-3">
            <h2 className="m-0 text-sm font-semibold">{title}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close"
              icon={<X size={14} />}
            />
          </header>
          <div className="overflow-y-auto p-4">{children}</div>
          {footer && (
            <footer className="flex justify-end gap-2 border-t border-bolt-ds-borderSecondary px-4 py-3">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}

/* ------------------------------------------------------------------------ */
/* Toasts                                                                    */
/* ------------------------------------------------------------------------ */

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

const ToastContext = createContext<
  (message: string, tone?: Toast['tone']) => void
>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback(
    (message: string, tone: Toast['tone'] = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, tone }]);
      setTimeout(
        () => setToasts((t) => t.filter((x) => x.id !== id)),
        tone === 'error' ? 6000 : 3000
      );
    },
    []
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              'pointer-events-auto rounded-md border px-3 py-2 text-sm shadow-lg',
              t.tone === 'error'
                ? 'border-bolt-ds-dangerBorderSubtle bg-bolt-ds-dangerBgSubtle text-bolt-ds-onDangerBgSubtle'
                : t.tone === 'info'
                ? 'border-bolt-ds-borderPrimary bg-bolt-ds-bgAlt text-bolt-ds-textPrimary'
                : 'border-bolt-ds-successBorderSubtle bg-bolt-ds-successBgSubtle text-bolt-ds-onSuccessBgSubtle'
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
