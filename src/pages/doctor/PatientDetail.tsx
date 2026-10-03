import { Activity, ArrowLeft, FileText, MonitorSmartphone, Phone, SlidersHorizontal, Thermometer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BpChart, RiskGauge } from '../../components/charts';
import { AlertCard, AlertResult, BpBadge, ReadingForm, SymptomForm } from '../../components/medical-ui';
import { Avatar, Badge, Button, Card, cx, Empty, Field, Input, Modal, Spinner, useToast } from '../../components/ui';
import { db } from '../../lib/db';
import { useTable } from '../../lib/hooks';
import { adherenceRate, age, computeRisk, MEDICAL_ANTECEDENTS, pulsePressure, SYMPTOM_LABEL } from '../../lib/medical';
import { can } from '../../lib/permissions';
import { useSession } from '../../lib/session';
import { DEFAULT_THRESHOLDS, type Alert, type Thresholds } from '../../lib/types';
import { fmtDateTime, fullName, timeAgo } from '../../lib/util';
import { DossierView } from '../shared/DossierView';
import { FollowUpView, MessagesView } from '../shared/FollowUpView';
import { SuiviView } from '../shared/SuiviView';
import { TherapyView } from '../shared/TherapyView';
import { useStaffData } from './StaffApp';

type Tab = 'synthese' | 'suivi' | 'dossier' | 'therapie' | 'consultations' | 'alertes' | 'messages';
const TABS: { value: Tab; label: string }[] = [
  { value: 'synthese', label: 'Synthèse' },
  { value: 'suivi', label: 'Courbes & données' },
  { value: 'dossier', label: 'Dossier médical' },
  { value: 'therapie', label: 'Thérapie' },
  { value: 'consultations', label: 'Consultations & RDV' },
  { value: 'alertes', label: 'Alertes & seuils' },
  { value: 'messages', label: 'Messages' },
];

export default function PatientDetail() {
  const { id } = useParams();
  const { profile } = useSession();
  const d = useStaffData();
  const [tab, setTab] = useState<Tab>('synthese');
  const [entry, setEntry] = useState<null | 'reading' | 'symptom'>(null);
  const [result, setResult] = useState<Alert[] | null>(null);
  const f = id ? { patient_id: id } : null;
  const meds = useTable('medications', f).rows;
  const intakes = useTable('intakes', f).rows;
  const reminders = useTable('reminders', f).rows;
  const consultations = useTable('consultations', f).rows;
  const appointments = useTable('appointments', f).rows;
  const messages = useTable('messages', f).rows;

  const patient = d.patients.find((p) => p.id === id);
  const readings = useMemo(() => d.readings.filter((r) => r.patient_id === id), [d.readings, id]);
  const symptoms = useMemo(() => d.symptoms.filter((s) => s.patient_id === id), [d.symptoms, id]);
  const alerts = useMemo(() => d.alerts.filter((a) => a.patient_id === id), [d.alerts, id]);
  const adh = adherenceRate(intakes);
  const risk = useMemo(() => computeRisk(patient, readings, symptoms, alerts, adh), [patient, readings, symptoms, alerts, adh]);

  if (d.loading) return <Spinner />;
  if (!patient || !profile) return <Empty title="Patient introuvable" action={<Link to="/d/patients" className="btn btn-secondary">Retour</Link>} />;
  const last = readings[0];
  const active = alerts.filter((a) => a.status === 'active');
  const doctor = d.staff.find((s) => s.id === patient.primary_doctor_id);
  const role = profile.role;

  return (
    <div className="space-y-4">
      <Link to="/d/patients" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"><ArrowLeft size={16} /> Patient·es</Link>

      <div className="card flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <Avatar name={fullName(patient)} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{fullName(patient)}</h1>
          <p className="text-sm text-slate-500">
            {patient.sex === 'F' ? 'Femme' : 'Homme'} · {age(patient.birth_date)} ans · <span className="font-mono">{patient.mrn}</span>
            {patient.ward && <> · <b>{patient.ward}</b></>}
            {doctor && <> · Médecin : {doctor.full_name}</>}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {patient.record.antecedents.medical.map((k) => <Badge key={k} className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200">{MEDICAL_ANTECEDENTS.find((m) => m.key === k)?.label ?? k}</Badge>)}
            {patient.record.antecedents.allergies && patient.record.antecedents.allergies !== 'Aucune connue' && <Badge className="bg-amber-100 text-amber-800">Allergie : {patient.record.antecedents.allergies}</Badge>}
          </div>
        </div>
        <RiskGauge score={risk.score} label={risk.label} hex={risk.hex} size={130} />
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
          {can(role, 'record_patient_data') && <Button className="!min-h-[38px] text-xs" onClick={() => setEntry('reading')}><Activity size={14} /> Saisir une TA</Button>}
          {can(role, 'record_patient_data') && <Button variant="secondary" className="!min-h-[38px] text-xs" onClick={() => setEntry('symptom')}><Thermometer size={14} /> Symptôme</Button>}
          <div className="flex gap-2">
            {can(role, 'bedside_monitor') && <Link to={`/moniteur/${patient.id}`} className="btn btn-secondary !min-h-[38px] flex-1 px-3 text-xs" title="Écran de surveillance"><MonitorSmartphone size={14} /></Link>}
            <Link to={`/rapport/${patient.id}`} className="btn btn-secondary !min-h-[38px] flex-1 px-3 text-xs" title="Rapport imprimable"><FileText size={14} /></Link>
            {patient.phone && <a href={`tel:${patient.phone}`} className="btn btn-secondary !min-h-[38px] flex-1 px-3 text-xs" title="Appeler"><Phone size={14} /></a>}
          </div>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
          {TABS.map((t) => (
            <button key={t.value} role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)} className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold', tab === t.value ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-300')}>
              {t.label}
              {t.value === 'alertes' && active.length > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{active.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {tab === 'synthese' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Tension – 7 derniers jours" className="lg:col-span-2" action={last && <BpBadge sys={last.systolic} dia={last.diastolic} />}>
            {last && <p className="mb-2 text-sm">Dernière : <b className="text-lg tabular-nums">{last.systolic}/{last.diastolic}</b> mmHg · pouls {last.pulse} · PP {pulsePressure(last)} · {timeAgo(last.measured_at)}</p>}
            <BpChart readings={readings} range="7j" thresholds={patient.thresholds} height={230} />
          </Card>
          <Card title="Facteurs de risque">
            <ul className="space-y-1.5 text-sm">
              {risk.factors.map((f) => (
                <li key={f.label} className="flex justify-between gap-2"><span>{f.label}</span><b className="text-slate-500">+{f.points}</b></li>
              ))}
              {!risk.factors.length && <li className="muted">Aucun facteur majeur.</li>}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Score indicatif (0–100), non validé cliniquement : aide à la priorisation, ne remplace pas le jugement médical.</p>
          </Card>
          <Card title="Alertes actives" className="lg:col-span-2">
            {active.length ? <div className="space-y-2">{active.slice(0, 5).map((a) => <AlertCard key={a.id} alert={a} />)}</div> : <p className="muted">Aucune alerte active.</p>}
          </Card>
          <Card title="Symptômes récents">
            {symptoms.length ? (
              <ul className="space-y-2 text-sm">
                {symptoms.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span>{SYMPTOM_LABEL[s.symptom]}{s.sudden && <span className="chip ml-1 bg-red-100 text-red-700">brutal</span>}<span className="block text-xs text-slate-500">{fmtDateTime(s.started_at)}</span></span>
                    <b className="tabular-nums">{s.intensity}/10</b>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">Aucun symptôme signalé.</p>}
            <p className="mt-3 text-sm">Observance : <b>{adh === undefined ? '—' : `${adh}%`}</b> · Traitements actifs : <b>{meds.filter((m) => m.active).length}</b></p>
          </Card>
        </div>
      )}
      {tab === 'suivi' && <SuiviView patient={patient} readings={readings} symptoms={symptoms} canDelete={can(role, 'edit_medical_record')} />}
      {tab === 'dossier' && <DossierView patient={patient} consultations={consultations} doctors={d.staff} canEditClinical={can(role, 'edit_medical_record')} canEditPersonal={can(role, 'record_patient_data')} />}
      {tab === 'therapie' && <TherapyView patient={patient} meds={meds} intakes={intakes} reminders={reminders} me={profile} canPrescribe={can(role, 'prescribe')} isPatient={false} />}
      {tab === 'consultations' && <FollowUpView patient={patient} appointments={appointments} consultations={consultations} me={profile} isStaff doctors={d.staff} />}
      {tab === 'alertes' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-2">
            {alerts.length ? alerts.slice(0, 60).map((a) => <AlertCard key={a.id} alert={a} />) : <Card><Empty title="Aucune alerte" /></Card>}
          </div>
          <ThresholdsCard patientId={patient.id} value={patient.thresholds} editable={can(role, 'edit_thresholds')} />
        </div>
      )}
      {tab === 'messages' && <MessagesView patient={patient} messages={messages} me={profile} counterpart={`Conversation avec ${fullName(patient)}`} />}

      <Modal open={entry === 'reading'} onClose={() => setEntry(null)} title={`Mesure pour ${fullName(patient)}`}>
        <ReadingForm patient={patient} by={profile} onDone={(a) => { setEntry(null); if (a.length) setResult(a); }} />
      </Modal>
      <Modal open={entry === 'symptom'} onClose={() => setEntry(null)} title={`Symptôme – ${fullName(patient)}`}>
        <SymptomForm patient={patient} onDone={(a) => { setEntry(null); if (a.length) setResult(a); }} />
      </Modal>
      <Modal open={!!result} onClose={() => setResult(null)} title="Alertes générées">{result && <AlertResult alerts={result} onClose={() => setResult(null)} />}</Modal>
    </div>
  );
}

const T_FIELDS: { k: keyof Thresholds; label: string; unit: string }[] = [
  { k: 'sys_high', label: 'Systolique élevée', unit: 'mmHg' },
  { k: 'dia_high', label: 'Diastolique élevée', unit: 'mmHg' },
  { k: 'sys_critical', label: 'Systolique critique', unit: 'mmHg' },
  { k: 'dia_critical', label: 'Diastolique critique', unit: 'mmHg' },
  { k: 'sys_low', label: 'Systolique basse', unit: 'mmHg' },
  { k: 'dia_low', label: 'Diastolique basse', unit: 'mmHg' },
  { k: 'pp_high', label: 'Pression pulsée haute', unit: 'mmHg' },
  { k: 'pp_low', label: 'Pression pulsée basse', unit: 'mmHg' },
  { k: 'hr_high', label: 'Pouls haut', unit: 'bpm' },
  { k: 'hr_low', label: 'Pouls bas', unit: 'bpm' },
  { k: 'delta_sys', label: 'Variation brutale systolique', unit: 'mmHg' },
  { k: 'delta_dia', label: 'Variation brutale diastolique', unit: 'mmHg' },
];

function ThresholdsCard({ patientId, value, editable }: { patientId: string; value: Thresholds; editable: boolean }) {
  const toast = useToast();
  const [t, setT] = useState(value);
  return (
    <Card title={<span className="flex items-center gap-2"><SlidersHorizontal size={18} /> Seuils d’alerte personnalisés</span>} subtitle="Adaptés au profil du patient (ex. diabétique, âgé)">
      <div className="grid grid-cols-2 gap-2">
        {T_FIELDS.map((f) => (
          <Field key={f.k} label={f.label}>
            <Input type="number" value={t[f.k]} disabled={!editable} onChange={(e) => setT({ ...t, [f.k]: Number(e.target.value) })} aria-label={`${f.label} (${f.unit})`} />
          </Field>
        ))}
      </div>
      {editable && (
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" onClick={async () => { await db.update('patients', patientId, { thresholds: t }); toast('Seuils enregistrés ✔'); }}>Enregistrer</Button>
          <Button variant="ghost" onClick={() => setT({ ...DEFAULT_THRESHOLDS })}>Par défaut</Button>
        </div>
      )}
    </Card>
  );
}
