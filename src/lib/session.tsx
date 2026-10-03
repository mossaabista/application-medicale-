import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, db } from './db';
import type { Patient, Profile } from './types';

interface SessionCtx {
  loading: boolean;
  profile: Profile | null;
  patient: Patient | null; // dossier du patient connecté (rôle patient)
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({
  loading: true, profile: null, patient: null, refresh: async () => {}, signOut: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);

  const refresh = useCallback(async () => {
    try {
      const id = await auth.currentUserId();
      if (!id) {
        setProfile(null);
        setPatient(null);
        return;
      }
      let p = await db.get('profiles', id);
      // le profil peut être créé par un trigger côté serveur : petite attente
      for (let i = 0; !p && i < 5; i++) {
        await new Promise((r) => setTimeout(r, 600));
        p = await db.get('profiles', id);
      }
      setProfile(p);
      if (p?.role === 'patient') {
        const rows = await db.list('patients', { user_id: id });
        setPatient(rows[0] ?? null);
      } else setPatient(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return db.subscribe(['patients', 'profiles'], () => void refresh());
  }, [refresh]);

  const signOut = useCallback(async () => {
    await auth.signOut();
    setProfile(null);
    setPatient(null);
  }, []);

  return <Ctx.Provider value={{ loading, profile, patient, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
