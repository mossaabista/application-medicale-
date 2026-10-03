import { HeartPulse, LogOut, Menu, Siren, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { IS_DEMO } from '../lib/db';
import { useSession } from '../lib/session';
import { ROLE_LABELS } from '../lib/types';
import { Avatar, cx } from './ui';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  end?: boolean;
  mobile?: boolean; // affiché dans la barre du bas
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-extrabold tracking-tight', className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white"><HeartPulse size={18} /></span>
      Tensio<span className="-ml-2 text-brand-600">Care</span>
    </span>
  );
}

export function AppLayout({ nav, children, onEmergency, topRight }: { nav: NavItem[]; children: ReactNode; onEmergency?: () => void; topRight?: ReactNode }) {
  const { profile, signOut } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const mobileNav = nav.filter((n) => n.mobile).slice(0, 4);

  const link = (n: NavItem, onClick?: () => void) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      onClick={onClick}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
          isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
        )
      }
    >
      {n.icon}
      <span className="flex-1">{n.label}</span>
      {!!n.badge && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{n.badge}</span>}
    </NavLink>
  );

  const logout = async () => {
    await signOut();
    navigate('/connexion');
  };

  const sidebar = (onClick?: () => void) => (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 px-2 pt-2"><Logo className="text-xl" /></div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Navigation principale">{nav.map((n) => link(n, onClick))}</nav>
      {profile && (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
          <Avatar name={profile.full_name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile.full_name}</p>
            <p className="truncate text-xs text-slate-500">{ROLE_LABELS[profile.role]}</p>
          </div>
          <button className="btn btn-ghost !min-h-0 p-2" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={18} /></button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">{sidebar()}</aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 bg-white dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-ghost absolute right-2 top-2 !min-h-0 p-2 text-white" onClick={() => setOpen(false)} aria-label="Fermer le menu"><X /></button>
            {sidebar(() => setOpen(false))}
          </aside>
        </div>
      )}

      <header className="pt-safe sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
          <button className="btn btn-ghost !min-h-0 p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu /></button>
          <span className="lg:hidden"><Logo /></span>
          {IS_DEMO && <span className="chip ml-1 hidden bg-amber-100 text-amber-800 sm:inline-flex">Mode démo</span>}
          <div className="ml-auto flex items-center gap-2">
            {topRight}
            {onEmergency && (
              <button onClick={onEmergency} className="btn btn-danger !min-h-[38px] px-3 py-1.5" aria-label="Urgence">
                <Siren size={18} /> <span className="hidden sm:inline">Urgence</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 lg:pb-10">{children}</main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden" style={{ gridTemplateColumns: `repeat(${mobileNav.length + 1}, minmax(0,1fr))` }} aria-label="Navigation rapide">
        {mobileNav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('relative flex flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold', isActive ? 'text-brand-600' : 'text-slate-500')}>
            {n.icon}
            {n.label.split(' ')[0]}
            {!!n.badge && <span className="absolute right-[22%] top-1 h-2.5 w-2.5 rounded-full bg-red-600" />}
          </NavLink>
        ))}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold text-slate-500">
          <Menu size={20} />
          Plus
        </button>
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
