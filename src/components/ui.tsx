import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export const cx = clsx;

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
// classes écrites en entier pour que Tailwind les conserve au build
const BTN: Record<BtnVariant, string> = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger', success: 'btn-success' };
export function Button({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return <button type="button" className={cx('btn', BTN[variant], className)} {...p} />;
}

export function Card({ children, className, title, action, subtitle }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('card p-4 sm:p-5', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="h2">{title}</h2>}
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx('input', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx('input', p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx('input', p.className)} />;

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx('chip', className ?? 'bg-slate-100 text-slate-700')}>{children}</span>;
}

export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div role="tablist" className={cx('inline-flex flex-wrap rounded-xl bg-slate-100 p-1 dark:bg-slate-800', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg font-semibold transition',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o.value ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn btn-ghost !min-h-0 p-2" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon && <div className="text-slate-300 dark:text-slate-600">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {text && <p className="muted max-w-sm">{text}</p>}
      {action}
    </div>
  );
}

export function Stat({ label, value, unit, sub, icon, tone = 'default' }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; icon?: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const tones = { default: 'text-brand-600 bg-brand-50 dark:bg-brand-950', good: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950', warn: 'text-amber-600 bg-amber-50 dark:bg-amber-950', bad: 'text-red-600 bg-red-50 dark:bg-red-950' };
  return (
    <div className="card flex items-start gap-3 p-4">
      {icon && <div className={cx('rounded-xl p-2.5', tones[tone])}>{icon}</div>}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-2xl font-bold tabular-nums">
          {value}
          {unit && <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>}
        </p>
        {sub && <div className="text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      {label}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const ini = name.replace(/^(Dr\.?|Pr\.?)\s+/i, '').split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('');
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className={cx('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white', className)} style={{ background: `hsl(${h} 55% 45%)` }} aria-hidden>
      {ini}
    </span>
  );
}

/* ---------------- Toasts ---------------- */
interface Toast { id: number; text: string; tone: 'success' | 'error' | 'info' | 'critical' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'critical' ? 9000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-semibold shadow-lg',
              t.tone === 'success' && 'bg-emerald-600 text-white',
              t.tone === 'error' && 'bg-red-600 text-white',
              t.tone === 'info' && 'bg-slate-900 text-white',
              t.tone === 'critical' && 'bg-red-700 text-white ring-4 ring-red-300',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
