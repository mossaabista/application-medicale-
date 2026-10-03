import { Activity, BellRing, LineChart, Lock, ShieldCheck, Stethoscope, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Layout';
import { Button, cx, Field, Input, Select } from '../components/ui';
import { auth, DEMO_STAFF_CODE, IS_DEMO, resetDemo } from '../lib/db';
import { useSession } from '../lib/session';
import { ROLE_LABELS, type Role } from '../lib/types';

const DEMO_ACCOUNTS: { email: string; label: string; role: Role; side: 'patient' | 'pro' }[] = [
  { email: 'patient@demo.cm', label: 'Marie Ngo Bassa', role: 'patient', side: 'patient' },
  { email: 'patient2@demo.cm', label: 'Jean-Paul Essomba (risque élevé)', role: 'patient', side: 'patient' },
  { email: 'medecin@demo.cm', label: 'Dr Aïcha Mbarga – Médecin', role: 'doctor', side: 'pro' },
  { email: 'infirmier@demo.cm', label: 'Paul Nkodo – Infirmier', role: 'nurse', side: 'pro' },
  { email: 'chercheur@demo.cm', label: 'Dr Claire Etoa – Chercheuse', role: 'researcher', side: 'pro' },
  { email: 'hopital@demo.cm', label: 'Centre médical – Compte hôpital', role: 'hospital', side: 'pro' },
  { email: 'admin@demo.cm', label: 'Administrateur', role: 'admin', side: 'pro' },
];

export default function Login() {
  const { profile, refresh } = useSession();
  const navigate = useNavigate();
  const [side, setSide] = useState<'patient' | 'pro'>('patient');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [sex, setSex] = useState<'F' | 'M'>('F');
  const [birth, setBirth] = useState('');
  const [role, setRole] = useState<Role>('doctor');
  const [code, setCode] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [hospital, setHospital] = useState('');
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (profile) return <Navigate to={profile.role === 'patient' ? '/p' : '/d'} replace />;

  async function go(fn: () => Promise<unknown>) {
    setErr('');
    setBusy(true);
    try {
      await fn();
      await refresh();
      navigate('/');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === 'login') return go(() => auth.signIn(email, password));
    if (password.length < 8) return setErr('Le mot de passe doit contenir au moins 8 caractères.');
    if (!consent) return setErr('Vous devez accepter la politique de confidentialité.');
    return go(() =>
      auth.signUp({
        email, password, full_name: fullName, phone, role: side === 'patient' ? 'patient' : role, staff_code: code, sex, birth_date: birth, specialty, hospital,
      }),
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-12 text-white lg:flex lg:flex-col">
        <Logo className="text-2xl [&>span:first-child]:bg-white [&>span:first-child]:text-brand-700 [&>span:last-child]:text-brand-200" />
        <div className="my-auto max-w-lg">
          <h1 className="text-4xl font-extrabold leading-tight">Surveiller la tension aujourd’hui, prévenir l’AVC demain.</h1>
          <p className="mt-4 text-lg text-brand-100">
            TensioCare relie patient·es hypertendu·es et soignant·es : mesures, symptômes, alertes en temps réel et suivi du traitement.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              [Activity, 'Saisie simple de la tension, du pouls et des symptômes'],
              [BellRing, 'Alertes automatiques en cas de valeurs critiques ou de signes d’AVC'],
              [LineChart, 'Courbes jour / semaine / mois et comparaison tension-symptômes'],
              [ShieldCheck, 'Données confidentielles, accès selon le rôle'],
            ].map(([Icon, text], i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="rounded-xl bg-white/10 p-2"><Icon size={20} /></span>
                {text as string}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-brand-200">Au Cameroun, l’hypertension est le premier facteur de risque d’AVC.</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" />
      </div>

      <div className="flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="mb-6 lg:hidden"><Logo className="text-2xl" /></div>
        <div className="card w-full max-w-md p-6">
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
            {([['patient', 'Espace patient', User], ['pro', 'Espace soignant', Stethoscope]] as const).map(([k, label, Icon]) => (
              <button
                key={k}
                role="tab"
                aria-selected={side === k}
                onClick={() => { setSide(k); setErr(''); }}
                className={cx('flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition', side === k ? 'bg-white text-brand-700 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-500')}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </div>

          <h2 className="text-xl font-bold">{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
          <p className="muted mb-4">
            {side === 'patient' ? 'Suivez votre tension et restez en lien avec votre médecin.' : 'Médecins, infirmier·ères, chercheur·euses et établissements.'}
          </p>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <>
                <Field label="Nom complet"><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={side === 'patient' ? 'Prénom Nom' : 'Dr Prénom Nom'} autoComplete="name" /></Field>
                {side === 'patient' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Sexe"><Select value={sex} onChange={(e) => setSex(e.target.value as 'F' | 'M')}><option value="F">Femme</option><option value="M">Homme</option></Select></Field>
                    <Field label="Date de naissance"><Input type="date" required value={birth} onChange={(e) => setBirth(e.target.value)} /></Field>
                  </div>
                ) : (
                  <>
                    <Field label="Profil">
                      <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                        {(['doctor', 'nurse', 'researcher', 'hospital', 'admin'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </Select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Spécialité / service"><Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Médecine générale" /></Field>
                      <Field label="Établissement"><Input value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="Clinique…" /></Field>
                    </div>
                    <Field label="Code d’accès professionnel" hint={IS_DEMO ? `Démo : ${DEMO_STAFF_CODE}` : 'Fourni par l’administrateur de l’établissement'}>
                      <Input required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
                    </Field>
                  </>
                )}
                <Field label="Téléphone"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6…" autoComplete="tel" /></Field>
              </>
            )}
            <Field label="Adresse courriel"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="nom@exemple.cm" /></Field>
            <Field label="Mot de passe"><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : undefined} /></Field>
            {mode === 'signup' && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-600" />
                <span>J’accepte que mes données de santé soient traitées de façon confidentielle pour mon suivi médical, et je comprends que TensioCare ne remplace pas un avis médical.</span>
              </label>
            )}
            {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200" role="alert">{err}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              <Lock size={16} /> {busy ? 'Veuillez patienter…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">
            {mode === 'login' ? 'Pas encore de compte ?' : 'Déjà inscrit·e ?'}{' '}
            <button className="font-semibold text-brand-700 hover:underline dark:text-brand-300" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErr(''); }}>
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </p>
        </div>

        {IS_DEMO && (
          <div className="mt-5 w-full max-w-md">
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Comptes de démonstration (mot de passe : demo1234)</p>
            <div className="grid gap-2">
              {DEMO_ACCOUNTS.filter((a) => a.side === side).map((a) => (
                <button key={a.email} disabled={busy} onClick={() => go(() => auth.signIn(a.email, 'demo1234'))} className="card flex items-center justify-between px-4 py-2.5 text-left text-sm hover:border-brand-400">
                  <span className="font-semibold">{a.label}</span>
                  <span className="text-xs text-slate-500">{a.email}</span>
                </button>
              ))}
            </div>
            <button className="mx-auto mt-3 block text-xs text-slate-500 underline" onClick={async () => { await resetDemo(); window.location.reload(); }}>
              Réinitialiser les données de démonstration
            </button>
          </div>
        )}
        <p className="mt-6 max-w-md text-center text-xs text-slate-500">
          TensioCare est un outil d’aide au suivi. Il ne remplace pas un avis médical. En cas d’urgence, appelez le <b>119</b>.
        </p>
      </div>
    </div>
  );
}
