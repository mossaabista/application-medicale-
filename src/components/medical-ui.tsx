import { AlertTriangle, BellRing, CheckCircle2, Phone, Siren } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { acknowledgeAlert, addReading, addSymptom, beep, notify } from '../lib/actions';
import { BE_FAST, EMERGENCY_NUMBERS, LEVEL_META, PERIODS, SYMPTOMS, classifyBp, periodOf, pulsePressure } from '../lib/medical';
import { useSession } from '../lib/session';
import type { Alert, Arm, DayPeriod, Patient, Position, Profile, SymptomKey } from '../lib/types';
import { fmtDateTime, timeAgo, toLocalInput } from '../lib/util';
import { Badge, Button, cx, Field, Input, Modal, Select, Textarea, useToast } from './ui';

export function BpBadge({ sys, dia, className }: { sys: number; dia: number; className?: string }) {
  const c = classifyBp(sys, dia);
  return <Badge className={cx(c.color, c.text, className)}>{c.label}</Badge>;
}

export function LevelBadge({ level }: { level: Alert['level'] }) {
  const m = LEVEL_META[level];
  return (
    <Badge className={m.badge}>
      <span className={cx('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </Badge>
  );
}

/* ---------------- Saisie d'une mesure ---------------- */
export function ReadingForm({ patient, onDone, by }: { patient: Patient; onDone: (alerts: Alert[]) => void; by?: Profile | null }) {
  const toast = useToast();
  const [f, setF] = useState({ when: toLocalInput(), sys: '', dia: '', pulse: '', arm: 'gauche' as Arm, position: 'assis' as Position, context: 'Au repos', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sys = Number(f.sys);
  const dia = Number(f.dia);
  const valid = sys >= 60 && sys <= 280 && dia >= 30 && dia <= 180 && sys > dia && Number(f.pulse) >= 30 && Number(f.pulse) <= 220;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setErr('Vérifiez les valeurs : systolique 60–280, diastolique 30–180 (inférieure à la systolique), pouls 30–220.');
      return;
    }
    setBusy(true);
    try {
      const { alerts } = await addReading(patient, {
        measured_at: new Date(f.when).toISOString(), systolic: sys, diastolic: dia, pulse: Number(f.pulse), arm: f.arm, position: f.position,
        context: f.context, note: f.note, source: by && by.role !== 'patient' ? 'soignant' : 'manuel', created_by: by?.id,
      });
      const crit = alerts.find((a) => a.level === 'critical');
      if (crit) {
        beep(true);
        notify('⚠️ ' + crit.title, crit.advice ?? crit.message, crit.id);
      } else toast(alerts.length ? `Mesure enregistrée – ${alerts.length} alerte(s)` : 'Mesure enregistrée ✔', alerts.length ? 'info' : 'success');
      onDone(alerts);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Systolique" hint="mmHg (chiffre du haut)">
          <Input inputMode="numeric" pattern="[0-9]*" required value={f.sys} onChange={set('sys')} placeholder="135" className="text-center text-2xl font-bold" aria-label="Pression systolique" autoFocus />
        </Field>
        <Field label="Diastolique" hint="mmHg (chiffre du bas)">
          <Input inputMode="numeric" pattern="[0-9]*" required value={f.dia} onChange={set('dia')} placeholder="85" className="text-center text-2xl font-bold" aria-label="Pression diastolique" />
        </Field>
        <Field label="Pouls" hint="battements / min">
          <Input inputMode="numeric" pattern="[0-9]*" required value={f.pulse} onChange={set('pulse')} placeholder="72" className="text-center text-2xl font-bold" aria-label="Pouls" />
        </Field>
      </div>
      {sys > 0 && dia > 0 && sys > dia && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <BpBadge sys={sys} dia={dia} />
          <span>Pression pulsée : <b>{pulsePressure({ systolic: sys, diastolic: dia })} mmHg</b></span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date et heure">
          <Input type="datetime-local" value={f.when} onChange={set('when')} max={toLocalInput()} />
        </Field>
        <Field label="Contexte">
          <Select value={f.context} onChange={set('context')}>
            {['Au repos', 'Au réveil', 'Avant le coucher', 'Après un effort', 'Après un repas', 'En période de stress', 'Avec symptômes'].map((x) => <option key={x}>{x}</option>)}
          </Select>
        </Field>
        <Field label="Bras">
          <Select value={f.arm} onChange={set('arm')}>
            <option value="gauche">Gauche</option>
            <option value="droit">Droit</option>
          </Select>
        </Field>
        <Field label="Position">
          <Select value={f.position} onChange={set('position')}>
            <option value="assis">Assis</option>
            <option value="couché">Couché</option>
            <option value="debout">Debout</option>
          </Select>
        </Field>
      </div>
      <Field label="Note (facultatif)">
        <Input value={f.note} onChange={set('note')} placeholder="Ex. : oubli du médicament ce matin" />
      </Field>
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <details className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950 dark:text-brand-100">
        <summary className="cursor-pointer font-semibold">Comment bien mesurer sa tension ?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Se reposer 5 minutes assis, dos appuyé, jambes non croisées.</li>
          <li>Brassard au niveau du cœur, sur le bras nu.</li>
          <li>Pas de café, tabac ou effort dans les 30 minutes précédentes.</li>
          <li>Faire 2 mesures à 1 minute d’intervalle et noter les deux.</li>
        </ul>
      </details>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Enregistrement…' : 'Enregistrer la mesure'}
      </Button>
    </form>
  );
}

/* ---------------- Saisie d'un symptôme ---------------- */
export function SymptomForm({ patient, onDone, initial }: { patient: Patient; onDone: (alerts: Alert[]) => void; initial?: SymptomKey }) {
  const toast = useToast();
  const [sym, setSym] = useState<SymptomKey | null>(initial ?? null);
  const [intensity, setIntensity] = useState(5);
  const [when, setWhen] = useState(toLocalInput());
  const [duration, setDuration] = useState('30');
  const [sudden, setSudden] = useState(false);
  const [side, setSide] = useState<'' | 'gauche' | 'droit' | 'bilateral'>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!sym) return;
    setBusy(true);
    try {
      const d = new Date(when);
      const { alerts } = await addSymptom(patient, {
        symptom: sym, intensity, started_at: d.toISOString(), duration_min: Number(duration), period: periodOf(d) as DayPeriod, sudden, side, note,
      });
      const crit = alerts.find((a) => a.level === 'critical');
      if (crit) {
        beep(true);
        notify('⚠️ ' + crit.title, crit.advice ?? crit.message, crit.id);
      } else toast('Symptôme enregistré ✔');
      onDone(alerts);
    } finally {
      setBusy(false);
    }
  }
  const lateral = sym && ['fourmillements', 'faiblesse_musculaire', 'troubles_visuels'].includes(sym);
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <span className="label">Quel symptôme ?</span>
        <div className="grid grid-cols-2 gap-2">
          {SYMPTOMS.map((s) => (
            <button
              type="button"
              key={s.key}
              onClick={() => setSym(s.key)}
              aria-pressed={sym === s.key}
              className={cx(
                'flex min-h-[56px] items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold transition',
                sym === s.key ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-100' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700',
              )}
            >
              <span className="text-xl" aria-hidden>{s.emoji}</span>
              <span>
                {s.label}
                <span className="block text-xs font-normal text-slate-500">{s.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Intensité : <b className="text-lg">{intensity}/10</b> {intensity <= 3 ? '(légère)' : intensity <= 6 ? '(modérée)' : '(forte)'}</span>
        <input type="range" min={1} max={10} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full accent-brand-600" aria-label="Intensité de 1 à 10" />
        <div className="flex justify-between text-xs text-slate-500"><span>1 – très légère</span><span>10 – insupportable</span></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Début">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} max={toLocalInput()} />
        </Field>
        <Field label="Durée">
          <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
            {[[5, '< 5 min'], [15, '15 min'], [30, '30 min'], [60, '1 heure'], [120, '2 heures'], [240, '4 heures'], [720, 'Demi-journée'], [1440, 'Toute la journée']].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <input type="checkbox" checked={sudden} onChange={(e) => setSudden(e.target.checked)} className="h-5 w-5 accent-red-600" />
        <span className="text-sm"><b>Apparition brutale</b> (en quelques secondes ou minutes)</span>
      </label>
      {lateral && (
        <Field label="Côté atteint">
          <Select value={side} onChange={(e) => setSide(e.target.value as typeof side)}>
            <option value="">Non précisé</option>
            <option value="gauche">Gauche</option>
            <option value="droit">Droit</option>
            <option value="bilateral">Des deux côtés</option>
          </Select>
        </Field>
      )}
      <Field label="Précisions (facultatif)">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Circonstances, ce qui a soulagé…" />
      </Field>
      <Button type="submit" className="w-full" disabled={!sym || busy}>
        {busy ? 'Enregistrement…' : 'Enregistrer le symptôme'}
      </Button>
    </form>
  );
}

/* ---------------- Résultat après saisie ---------------- */
export function AlertResult({ alerts, onClose }: { alerts: Alert[]; onClose: () => void }) {
  const critical = alerts.some((a) => a.level === 'critical');
  if (!alerts.length)
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto text-emerald-500" size={56} />
        <p className="text-lg font-semibold">Merci, c’est enregistré.</p>
        <p className="muted">Aucune anomalie détectée sur cette saisie.</p>
        <Button className="w-full" onClick={onClose}>Fermer</Button>
      </div>
    );
  return (
    <div className="space-y-3">
      {critical && <EmergencyPanel />}
      {alerts.map((a) => (
        <AlertCard key={a.id} alert={a} compact />
      ))}
      <p className="muted">Votre médecin traitant a été notifié automatiquement.</p>
      <Button variant="secondary" className="w-full" onClick={onClose}>J’ai compris</Button>
    </div>
  );
}

export function EmergencyPanel({ doctorPhone }: { doctorPhone?: string }) {
  return (
    <div className="rounded-2xl bg-red-600 p-4 text-white">
      <div className="flex items-center gap-2 text-lg font-extrabold">
        <Siren /> Urgence possible
      </div>
      <p className="mt-1 text-sm">En cas de faiblesse, troubles de la parole, visage qui tombe, perte de vision ou d’équilibre : appelez immédiatement.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href="tel:119" className="btn bg-white text-red-700 hover:bg-red-50"><Phone size={18} /> SAMU 119</a>
        <a href={`tel:${doctorPhone ?? '112'}`} className="btn border border-white/60 text-white hover:bg-red-700"><Phone size={18} /> {doctorPhone ? 'Mon médecin' : 'Urgence 112'}</a>
      </div>
    </div>
  );
}

export function EmergencyModal({ open, onClose, doctorPhone }: { open: boolean; onClose: () => void; doctorPhone?: string }) {
  return (
    <Modal open={open} onClose={onClose} title="Urgence – reconnaître un AVC">
      <EmergencyPanel doctorPhone={doctorPhone} />
      <h3 className="mb-2 mt-4 font-semibold">Les signes « BE-FAST »</h3>
      <ul className="space-y-2">
        {BE_FAST.map((b) => (
          <li key={b.letter} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-lg font-black text-white">{b.letter}</span>
            <span className="text-sm"><b>{b.word}</b> – {b.text}</span>
          </li>
        ))}
      </ul>
      <h3 className="mb-2 mt-4 font-semibold">En attendant les secours</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Notez l’heure exacte du début des symptômes.</li>
        <li>Allongez la personne sur le côté si elle vomit ou perd connaissance.</li>
        <li>Ne donnez rien à boire ni à manger, aucun médicament.</li>
        <li>Ne laissez pas la personne seule.</li>
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {EMERGENCY_NUMBERS.map((n) => (
          <a key={n.number} href={`tel:${n.number}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-2 dark:border-slate-700">
            <span>{n.label}</span>
            <b>{n.number}</b>
          </a>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------- Alertes ---------------- */
export function AlertCard({ alert: a, compact, patientName, onOpenPatient }: { alert: Alert; compact?: boolean; patientName?: string; onOpenPatient?: () => void }) {
  const { profile } = useSession();
  const m = LEVEL_META[a.level];
  const staff = profile && profile.role !== 'patient';
  const Icon = a.level === 'critical' ? Siren : a.level === 'high' ? AlertTriangle : BellRing;
  return (
    <article className={cx('rounded-2xl border-l-4 bg-white p-3 shadow-sm dark:bg-slate-900', m.ring, a.status !== 'active' && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <Icon className={cx('mt-0.5 shrink-0', a.level === 'critical' ? 'text-red-600' : a.level === 'high' ? 'text-orange-600' : 'text-amber-500')} size={20} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{a.title}</p>
            <LevelBadge level={a.level} />
            {a.status !== 'active' && <Badge className="bg-emerald-100 text-emerald-800">{a.status === 'resolved' ? 'Résolue' : 'Prise en charge'}</Badge>}
          </div>
          {patientName && (
            <button onClick={onOpenPatient} className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">{patientName}</button>
          )}
          <p className="text-sm text-slate-700 dark:text-slate-300">{a.message}</p>
          {a.advice && !staff && <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">👉 {a.advice}</p>}
          {!compact && (
            <p className="mt-1 text-xs text-slate-500">
              {fmtDateTime(a.created_at)} · {timeAgo(a.created_at)}
              {a.acknowledged_name && ` · vue par ${a.acknowledged_name}`}
            </p>
          )}
        </div>
      </div>
      {staff && a.status === 'active' && profile && (
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" className="!min-h-[36px] py-1 text-xs" onClick={() => acknowledgeAlert(a, profile)}>Prendre en charge</Button>
          <Button variant="ghost" className="!min-h-[36px] py-1 text-xs" onClick={() => acknowledgeAlert(a, profile, true)}>Résoudre</Button>
        </div>
      )}
    </article>
  );
}

export const periodOptions = PERIODS;
