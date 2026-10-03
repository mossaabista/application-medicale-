import { ArrowLeft, Printer } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BpChart, MonitoringTable, SymptomFrequency } from '../../components/charts';
import { Logo } from '../../components/Layout';
import { BpBadge } from '../../components/medical-ui';
import { Button, Spinner } from '../../components/ui';
import { useTable } from '../../lib/hooks';
import { adherenceRate, age, computeRisk, FAMILY_ANTECEDENTS, MEDICAL_ANTECEDENTS, readingStats, since } from '../../lib/medical';
import { useSession } from '../../lib/session';
import { fmtDate, fmtDateTime, fullName } from '../../lib/util';

/** Rapport de suivi imprimable / exportable en PDF (via l'impression du navigateur). */
export default function Report() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useSession();
  const f = id ? { patient_id: id } : null;
  const patient = useTable('patients', id ? { id } : null).rows[0];
  const readings = useTable('readings', f).rows;
  const symptoms = useTable('symptoms', f).rows;
  const alerts = useTable('alerts', f).rows;
  const meds = useTable('medications', f).rows;
  const intakes = useTable('intakes', f).rows;
  const doctors = useTable('profiles', { role: 'doctor' }).rows;
  const r30 = since(readings, 30, (r) => r.measured_at);
  const s30 = since(symptoms, 30, (s) => s.started_at);
  const st = readingStats(r30);
  const adh = adherenceRate(intakes, 30);
  const risk = useMemo(() => computeRisk(patient, readings, symptoms, alerts, adh), [patient, readings, symptoms, alerts, adh]);
  if (!patient) return <Spinner />;
  const doctor = doctors.find((d) => d.id === patient.primary_doctor_id);
  const lbl = (list: { key: string; label: string }[], keys: string[]) => keys.map((k) => list.find((x) => x.key === k)?.label ?? k).join(', ') || 'Aucun';

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-slate-900 print:p-0">
      <div className="no-print mb-4 flex gap-2">
        <Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Retour</Button>
        <Button onClick={() => window.print()}><Printer size={16} /> Imprimer / Enregistrer en PDF</Button>
      </div>
      <header className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
        <div>
          <Logo className="text-xl" />
          <p className="mt-1 text-sm">Rapport de suivi tensionnel – 30 derniers jours</p>
        </div>
        <div className="text-right text-sm">
          <p>Édité le {fmtDateTime(new Date().toISOString())}</p>
          <p>par {profile?.full_name}</p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-lg font-bold">{fullName(patient)}</p>
          <p>{patient.sex === 'F' ? 'Femme' : 'Homme'}, {age(patient.birth_date)} ans (né·e le {fmtDate(patient.birth_date)})</p>
          <p>Identifiant : <span className="font-mono">{patient.mrn}</span></p>
          <p>Téléphone : {patient.phone ?? '—'}</p>
          {patient.ward && <p>Service : {patient.ward}</p>}
        </div>
        <div>
          <p>Médecin traitant : <b>{doctor?.full_name ?? '—'}</b></p>
          <p>HTA diagnostiquée le {fmtDate(patient.record.history.diagnosis_date)} ({patient.record.history.hta_grade ?? '—'})</p>
          <p>Antécédents : {lbl(MEDICAL_ANTECEDENTS, patient.record.antecedents.medical)}</p>
          <p>Familiaux : {lbl(FAMILY_ANTECEDENTS, patient.record.antecedents.family)}</p>
          <p>Allergies : {patient.record.antecedents.allergies || '—'}</p>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
        {[
          ['TA moyenne', st.count ? `${st.sys}/${st.dia}` : '—'],
          ['Mesures', String(st.count)],
          ['Contrôle (<140/90)', st.count ? `${st.controlled}%` : '—'],
          ['Observance', adh === undefined ? '—' : `${adh}%`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-slate-300 p-2"><p className="text-xs text-slate-500">{l}</p><p className="text-xl font-bold">{v}</p></div>
        ))}
      </section>
      <p className="mt-2 text-sm">
        Classification moyenne : {st.count ? <BpBadge sys={st.sys} dia={st.dia} /> : '—'} · Pouls moyen {st.hr || '—'} bpm · Pression pulsée moyenne {st.pp || '—'} mmHg · Variabilité σ {st.sysSd} ·
        Risque estimé : <b style={{ color: risk.hex }}>{risk.label} ({risk.score}/100)</b>
      </p>

      <section className="card mt-4 p-3"><p className="mb-1 font-semibold">Courbe tensionnelle (30 jours)</p><BpChart readings={readings} range="30j" thresholds={patient.thresholds} height={220} /></section>

      <section className="mt-4 grid grid-cols-2 gap-4">
        <div className="card p-3"><p className="mb-1 font-semibold">Symptômes (30 jours) – {s30.length} épisode(s)</p><SymptomFrequency symptoms={s30} /></div>
        <div className="card p-3 text-sm">
          <p className="mb-1 font-semibold">Traitement en cours</p>
          <ul className="list-disc pl-5">{meds.filter((m) => m.active).map((m) => <li key={m.id}>{m.name} {m.dosage} – {m.times.join(', ')}</li>)}</ul>
          <p className="mb-1 mt-3 font-semibold">Alertes critiques / élevées (30 j)</p>
          <ul className="list-disc pl-5">
            {since(alerts, 30, (a) => a.created_at).filter((a) => a.level === 'critical' || a.level === 'high').slice(0, 8).map((a) => <li key={a.id}>{fmtDate(a.created_at)} – {a.title}</li>)}
          </ul>
        </div>
      </section>

      <section className="card mt-4 p-3"><p className="mb-1 font-semibold">Tableau hebdomadaire</p><MonitoringTable readings={r30} symptoms={s30} granularity="semaine" /></section>
      <p className="mt-4 text-center text-xs text-slate-500">Document généré par TensioCare – outil d’aide au suivi, ne remplace pas un avis médical. Confidentiel.</p>
    </div>
  );
}
