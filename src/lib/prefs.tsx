import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useLocalPref } from './hooks';

export interface Prefs {
  font: 'md' | 'lg' | 'xl';
  contrast: 'normal' | 'high';
  theme: 'system' | 'light' | 'dark';
}
const Ctx = createContext<{ prefs: Prefs; setPrefs: (p: Prefs) => void }>({ prefs: { font: 'md', contrast: 'normal', theme: 'system' }, setPrefs: () => {} });

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useLocalPref<Prefs>('a11y', { font: 'md', contrast: 'normal', theme: 'system' });
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.font = prefs.font;
    html.dataset.contrast = prefs.contrast;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => html.classList.toggle('dark', prefs.theme === 'dark' || (prefs.theme === 'system' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [prefs]);
  return <Ctx.Provider value={{ prefs, setPrefs }}>{children}</Ctx.Provider>;
}
export const usePrefs = () => useContext(Ctx);
