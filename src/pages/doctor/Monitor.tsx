import { ArrowLeft, Maximize, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BpChart, SingleMetricChart, Sparkline } from '../../components/charts';
import { ReadingForm } from '../../components/medical-ui';
import { cx, Modal } from '../../components/ui';
import { beep } from '../../lib/actions';
import { useNow, useTable } from '../../lib/hooks';
import { age, classifyBp, computeRisk, pulsePressure, since, SYMPTOM_LABEL } from '../../lib/medical';
import { usePrefs } from '../../lib/prefs';
import { useSession } from '../../lib/session';
import type { Alert, Patient, Reading, SymptomEntry } from '../../lib/types';
import { fullName, timeAgo } from '../../lib/util';

/** Écran de surveillance au lit du patient (tablette / écran fixé) : courbes critiques et niveau de risque, toujours affichés. */
export default function Monitor() {
  const { id } = useParams();
  const patients = useTable('patients', {}).rows;
  const readings = useTable('readings', id ? { patient_id: id } : {}, { limit: 5000 }).rows;
  const symptoms = useTable('symptoms', id ? { patient_id: id } : {}, { limit: 2000 }).rows;
  const alerts = useTable('alerts', id ? { patient_id: id } : {}, { limit: 1000 }).rows;
  const now = useNow(1000);
  const { prefs, setPrefs } = usePrefs();
  const prefsRef = useRef(prefs);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => {
      void lock?.release();
      setPrefs({ ...prefsRef.current }); // ré-applique le thème choisi
    };
  }, [setPrefs]);

  const clock = new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const full = () => void document.documentElement.requestFullscreen?.().catch(() => {});

  return (
    <div className="min-h-screen bg-slate-950 p-3 text-white sm:p-5">
      <header className="mb-4 flex items-center gap-3">
        <Link to={id ? '/moniteur' : '/d'} className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700" aria-label="Retour"><ArrowLeft /></Link>
        <h1 className="text-xl font-bold sm:text-2xl">{id ? 'Surveillance au lit' : 'Surveillance du service'}</h1>
        <span className="ml-auto font-mono text-2xl tabular-nums text-slate-300 sm:text-3xl">{clock}</span>
        <button onClick={full} className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700" aria-label="Plein écran"><Maximize /></button>
      </header>
      {id ? (
        <Bedside patient={patients.find((p) => p.id === id)} readings={readings} symptoms={symptoms} alerts={alerts} />
      ) : (
        <Ward patients={patients} readings={readings} symptoms={symptoms} alerts={alerts} />
      )}
    </div>
  );
}

function Ward({ patients, readings, symptoms, alerts }: { patients: Patient[]; readings: Reading[]; symptoms: SymptomEntry[]; alerts: Alert[] }) {
  const tiles = useMemo(
    () =>
      patients
        .map((p) => {
          const r = readings.filter((x) => x.patient_id === p.id);
          const s = symptoms.filter((x) => x.patient_id === p.id);
          const a = alerts.filter((x) => x.patient_id === p.id);
          return { p, r, risk: computeRisk(p, r, s, a), active: a.filter((x) => x.status === 'active') };
        })
        .sort((a, b) => Number(!!b.p.ward) - Number(!!a.p.ward) || b.risk.score - a.risk.score),
    [patients, readings, symptoms, alerts],
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map(({ p, r, risk, active }) => {
        const last = r[0];
        const crit = active.some((a) => a.level === 'critical');
        return (
          <Link key={p.id} to={`/moniteur/${p.id}`} className={cx('rounded-2xl border-2 bg-slate-900 p-4 transition hover:bg-slate-800', crit ? 'pulse-ring border-red-600' : 'border-slate-800')}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{fullName(p)}</p>
                <p className="truncate text-sm text-slate-400">{p.ward ?? 'Ambulatoire'} · {age(p.birth_date)} ans</p>
              </div>
              <span className="rounded-lg px-3 py-1 text-sm font-bold" style={{ background: risk.hex }}>{risk.label}</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-4xl font-extrabold tabular-nums" style={{ color: last ? classifyBp(last.systolic, last.diastolic).hex : undefined }}>{last ? `${last.systolic}/${last.diastolic}` : '—'}</p>
                <p className="text-sm text-slate-400">{last ? `♥ ${last.pulse} bpm · ${timeAgo(last.measured_at)}` : 'Aucune mesure'}</p>
              </div>
              <Sparkline values={since(r, 2, (x) => x.measured_at).slice().reverse().map((x) => x.systolic)} color="#60a5fa" width={120} height={44} />
            </div>
            {active.length > 0 && <p className="mt-2 truncate text-sm font-semibold text-red-400">⚠ {active[0].title}{active.length > 1 ? ` (+${active.length - 1})` : ''}</p>}
          </Link>
        );
      })}
    </div>
  );
}

function Bedside({ patient, readings, symptoms, alerts }: { patient?: Patient; readings: Reading[]; symptoms: SymptomEntry[]; alerts: Alert[] }) {
  const { profile } = useSession();
  const [add, setAdd] = useState(false);
  const active = alerts.filter((a) => a.status === 'active');
  const crit = active.filter((a) => a.level === 'critical');
  const risk = useMemo(() => computeRisk(patient, readings, symptoms, alerts), [patient, readings, symptoms, alerts]);
  const critKey = crit.map((a) => a.id).join();
  useEffect(() => {
    if (critKey) beep(true);
  }, [critKey]);
  if (!patient) return <p className="text-slate-400">Chargement…</p>;
  const last = readings[0];
  const cat = last ? classifyBp(last.systolic, last.diastolic) : null;
  const day = since(readings, 1, (r) => r.measured_at);
  const recentSym = since(symptoms, 2, (s) => s.started_at);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-slate-900 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold sm:text-3xl">{fullName(patient)}</p>
          <p className="text-slate-400">{patient.ward ?? 'Ambulatoire'} · {patient.sex === 'F' ? 'F' : 'M'} {age(patient.birth_date)} ans · {patient.mrn}</p>
        </div>
        <div className={cx('rounded-2xl px-6 py-3 text-center', risk.level === 'critique' && 'pulse-ring')} style={{ background: risk.hex }}>
          <p className="text-xs font-bold uppercase tracking-wider">Risque</p>
          <p className="text-3xl font-black">{risk.label}</p>
          <p className="text-sm font-semibold opacity-90">score {risk.score}/100</p>
        </div>
        {(profile?.role === 'nurse' || profile?.role === 'doctor') && (
          <button onClick={() => setAdd(true)} className="btn bg-brand-600 text-lg text-white hover:bg-brand-700"><Plus /> Nouvelle mesure</button>
        )}
      </div>

      {crit.length > 0 && (
        <div className="pulse-ring rounded-2xl bg-red-700 p-4 text-xl font-bold">🚨 {crit[0].title} — {crit[0].message}</div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BigNum label="Tension" value={last ? `${last.systolic}/${last.diastolic}` : '—'} unit="mmHg" color={cat?.hex} sub={cat?.label} />
        <BigNum label="Pouls" value={last ? String(last.pulse) : '—'} unit="bpm" color={last && (last.pulse > 110 || last.pulse < 50) ? '#f97316' : '#a78bfa'} />
        <BigNum label="Pression pulsée" value={last ? String(pulsePressure(last)) : '—'} unit="mmHg" color={last && pulsePressure(last) >= 60 ? '#f97316' : '#60a5fa'} />
        <BigNum label="Dernière mesure" value={last ? new Date(last.measured_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'} sub={last ? timeAgo(last.measured_at) : ''} color="#e2e8f0" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl bg-slate-900 p-4 xl:col-span-2">
          <p className="mb-2 text-lg font-semibold">Pression artérielle – {day.length >= 2 ? '24 h' : '7 jours'}</p>
          <BpChart readings={readings} range={day.length >= 2 ? '24h' : '7j'} thresholds={patient.thresholds} height={320} big />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900 p-4">
            <p className="mb-2 text-lg font-semibold">Pouls</p>
            <SingleMetricChart readings={readings} range={day.length >= 2 ? '24h' : '7j'} metric="pulse" height={130} big />
          </div>
          <div className="rounded-2xl bg-slate-900 p-4">
            <p className="mb-2 text-lg font-semibold">Alertes et symptômes (48 h)</p>
            <ul className="space-y-1 text-base">
              {active.slice(0, 4).map((a) => <li key={a.id} className={a.level === 'critical' ? 'font-bold text-red-400' : 'text-amber-300'}>⚠ {a.title}</li>)}
              {recentSym.slice(0, 4).map((s) => <li key={s.id} className="text-slate-300">• {SYMPTOM_LABEL[s.symptom]} {s.intensity}/10 – {timeAgo(s.started_at)}</li>)}
              {!active.length && !recentSym.length && <li className="text-emerald-400">✓ Rien à signaler</li>}
            </ul>
          </div>
        </div>
      </div>
      <Modal open={add} onClose={() => setAdd(false)} title="Nouvelle mesure">
        <ReadingForm patient={patient} by={profile} onDone={() => setAdd(false)} />
      </Modal>
    </div>
  );
}

function BigNum({ label, value, unit, color, sub }: { label: string; value: string; unit?: string; color?: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-4xl font-black tabular-nums sm:text-5xl" style={{ color }}>{value}<span className="ml-1 text-base font-medium text-slate-400">{unit}</span></p>
      {sub && <p className="text-sm text-slate-400">{sub}</p>}
    </div>
  );
}
