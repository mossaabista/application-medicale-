import { Activity, Bell, CalendarDays, ChevronRight, ClipboardList, CreditCard, FileHeart, HeartPulse, Home, LineChart, MessageCircle, Pill, Plus, Settings, Stethoscope, Thermometer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { BpChart, RiskGauge } from '../../components/charts';
import { AppLayout, PageHeader, type NavItem } from '../../components/Layout';
import { AlertCard, AlertResult, BpBadge, EmergencyModal, ReadingForm, SymptomForm } from '../../components/medical-ui';
import { Badge, Button, Card, Empty, Modal, Segmented, Spinner, Stat, useToast } from '../../components/ui';
import { beep, notify } from '../../lib/actions';
import { useNow, useTable } from '../../lib/hooks';
import { adherenceRate, computeRisk, pulsePressure, todaysDoses } from '../../lib/medical';
import { useSession } from '../../lib/session';
import type { Alert, Patient, Reminder } from '../../lib/types';
import { fmtDateTime, fmtLong, fmtTime, timeAgo } from '../../lib/util';
import { AppointmentItem, FollowUpView, MessagesView } from '../shared/FollowUpView';
import { DossierView } from '../shared/DossierView';
import { SettingsPage, SubscriptionPage } from '../shared/AccountViews';
import { SuiviView } from '../shared/SuiviView';
import { TherapyView } from '../shared/TherapyView';

function usePatientData(patient: Patient | null) {
  const f = patient ? { patient_id: patient.id } : null;
  return {
    readings: useTable('readings', f).rows,
    symptoms: useTable('symptoms', f).rows,
    alerts: useTable('alerts', f).rows,
    meds: useTable('medications', f).rows,
    intakes: useTable('intakes', f).rows,
    appointments: useTable('appointments', f).rows,
    consultations: useTable('consultations', f).rows,
    reminders: useTable('reminders', f).rows,
    messages: useTable('messages', f).rows,
    doctors: useTable('profiles', { role: 'doctor' }).rows,
  };
}
type Data = ReturnType<typeof usePatientData>;

/** Déclenche les rappels (tension / médicaments) à l'heure prévue tant que l'app est ouverte. */
function useReminderEngine(reminders: Reminder[], onFire: (r: Reminder) => void) {
  const now = useNow(30_000);
  useEffect(() => {
    const d = new Date(now);
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    for (const r of reminders) {
      if (!r.enabled || !r.days.includes(d.getDay()) || !r.times.includes(hm)) continue;
      const key = `tc_rem_${r.id}_${d.toISOString().slice(0, 10)}_${hm}`;
      if (localStorage.getItem(key)) continue;
      localStorage.setItem(key, '1');
      onFire(r);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, reminders]);
}

export default function PatientApp() {
  const { patient, profile, loading } = useSession();
  const data = usePatientData(patient);
  const toast = useToast();
  const [emergency, setEmergency] = useState(false);
  const [entry, setEntry] = useState<null | 'reading' | 'symptom'>(null);
  const [result, setResult] = useState<Alert[] | null>(null);
  const seen = useRef<Set<string> | null>(null);

  useReminderEngine(data.reminders, (r) => {
    const text = r.kind === 'tension' ? 'C’est l’heure de mesurer votre tension.' : r.kind === 'medicament' ? 'C’est l’heure de prendre vos médicaments.' : r.label;
    toast('⏰ ' + text, 'info');
    notify('TensioCare – rappel', text, r.id);
  });

  // nouvelles alertes créées ailleurs (ex. par un soignant)
  useEffect(() => {
    const ids = new Set(data.alerts.map((a) => a.id));
    if (seen.current) {
      const fresh = data.alerts.filter((a) => !seen.current!.has(a.id) && a.status === 'active');
      if (fresh.some((a) => a.level === 'critical')) beep(true);
    }
    seen.current = ids;
  }, [data.alerts]);

  if (loading) return <Spinner />;
  if (!patient || !profile) return <Spinner label="Préparation de votre dossier…" />;

  const activeAlerts = data.alerts.filter((a) => a.status === 'active');
  const unread = data.messages.filter((m) => !m.read && m.sender_role !== 'patient').length;
  const doctor = data.doctors.find((d) => d.id === patient.primary_doctor_id);

  const nav: NavItem[] = [
    { to: '/p', label: 'Accueil', icon: <Home size={20} />, end: true, mobile: true },
    { to: '/p/suivi', label: 'Suivi', icon: <LineChart size={20} />, mobile: true },
    { to: '/p/traitement', label: 'Traitement', icon: <Pill size={20} />, mobile: true },
    { to: '/p/alertes', label: 'Alertes', icon: <Bell size={20} />, badge: activeAlerts.length, mobile: true },
    { to: '/p/rendez-vous', label: 'Rendez-vous', icon: <CalendarDays size={20} /> },
    { to: '/p/dossier', label: 'Mon dossier', icon: <FileHeart size={20} /> },
    { to: '/p/messages', label: 'Messages', icon: <MessageCircle size={20} />, badge: unread },
    { to: '/p/abonnement', label: 'Abonnement', icon: <CreditCard size={20} /> },
    { to: '/p/parametres', label: 'Paramètres', icon: <Settings size={20} /> },
  ];

  const done = (alerts: Alert[]) => {
    setEntry(null);
    if (alerts.length) setResult(alerts);
  };

  return (
    <AppLayout nav={nav} onEmergency={() => setEmergency(true)}>
      <Routes>
        <Route index element={<PatientHome patient={patient} data={data} onAdd={setEntry} firstName={patient.first_name} doctorName={doctor?.full_name} />} />
        <Route path="suivi" element={<><PageHeader title="Mon suivi" subtitle="Courbes, symptômes et tableau de surveillance" actions={<AddButtons onAdd={setEntry} />} /><SuiviView patient={patient} readings={data.readings} symptoms={data.symptoms} canDelete /></>} />
        <Route path="alertes" element={<AlertsPage alerts={data.alerts} />} />
        <Route path="traitement" element={<><PageHeader title="Mon traitement" subtitle="Médicaments, prises du jour, rappels et conseils" /><TherapyView patient={patient} meds={data.meds} intakes={data.intakes} reminders={data.reminders} me={profile} canPrescribe={false} isPatient /></>} />
        <Route path="rendez-vous" element={<><PageHeader title="Rendez-vous et consultations" /><FollowUpView patient={patient} appointments={data.appointments} consultations={data.consultations} me={profile} isStaff={false} doctors={data.doctors} /></>} />
        <Route path="dossier" element={<><PageHeader title="Mon dossier médical" subtitle={`Identifiant : ${patient.mrn}`} actions={<Link to={`/rapport/${patient.id}`} className="btn btn-secondary"><ClipboardList size={16} /> Rapport PDF</Link>} /><DossierView patient={patient} consultations={data.consultations} doctors={data.doctors} canEditClinical={false} canEditPersonal /></>} />
        <Route path="messages" element={<><PageHeader title="Messages" /><MessagesView patient={patient} messages={data.messages} me={profile} counterpart={doctor ? `${doctor.full_name} et l’équipe soignante` : 'Équipe soignante'} /></>} />
        <Route path="abonnement" element={<SubscriptionPage />} />
        <Route path="parametres" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/p" replace />} />
      </Routes>

      <Modal open={entry === 'reading'} onClose={() => setEntry(null)} title="Nouvelle mesure de tension">
        <ReadingForm patient={patient} by={profile} onDone={done} />
      </Modal>
      <Modal open={entry === 'symptom'} onClose={() => setEntry(null)} title="Signaler un symptôme">
        <SymptomForm patient={patient} onDone={done} />
      </Modal>
      <Modal open={!!result} onClose={() => setResult(null)} title="Analyse de votre saisie">
        {result && <AlertResult alerts={result} onClose={() => setResult(null)} />}
      </Modal>
      <EmergencyModal open={emergency} onClose={() => setEmergency(false)} doctorPhone={doctor?.phone} />
    </AppLayout>
  );
}

function AddButtons({ onAdd }: { onAdd: (k: 'reading' | 'symptom') => void }) {
  return (
    <>
      <Button onClick={() => onAdd('reading')}><Plus size={16} /> Mesure</Button>
      <Button variant="secondary" onClick={() => onAdd('symptom')}><Thermometer size={16} /> Symptôme</Button>
    </>
  );
}

function PatientHome({ patient, data, onAdd, firstName, doctorName }: { patient: Patient; data: Data; onAdd: (k: 'reading' | 'symptom') => void; firstName: string; doctorName?: string }) {
  const navigate = useNavigate();
  const last = data.readings[0];
  const adh = adherenceRate(data.intakes);
  const risk = useMemo(() => computeRisk(patient, data.readings, data.symptoms, data.alerts, adh), [patient, data.readings, data.symptoms, data.alerts, adh]);
  const doses = todaysDoses(data.meds, data.intakes);
  const pending = doses.filter((d) => !d.intake);
  const next = data.appointments.filter((a) => a.status === 'prevu' && Date.parse(a.starts_at) > Date.now() - 3_600_000).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const active = data.alerts.filter((a) => a.status === 'active');
  const todayCount = data.readings.filter((r) => r.measured_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
  const hour = new Date().getHours();

  return (
    <div className="space-y-4">
      <div>
        <p className="muted capitalize">{fmtLong(new Date())}</p>
        <h1 className="h1">{hour < 18 ? 'Bonjour' : 'Bonsoir'} {firstName} 👋</h1>
      </div>

      {active.some((a) => a.level === 'critical') && (
        <button onClick={() => navigate('/p/alertes')} className="pulse-ring flex w-full items-center gap-3 rounded-2xl bg-red-600 p-4 text-left text-white">
          <HeartPulse size={28} />
          <span className="flex-1"><b>Alerte critique en cours.</b> Consultez les consignes immédiatement.</span>
          <ChevronRight />
        </button>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={() => onAdd('reading')} className="flex items-center gap-4 rounded-2xl bg-brand-600 p-5 text-left text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">
          <span className="rounded-xl bg-white/15 p-3"><Activity size={28} /></span>
          <span><span className="block text-lg font-bold">Saisir ma tension</span><span className="text-sm text-brand-100">{todayCount ? `${todayCount} mesure(s) aujourd’hui` : 'Aucune mesure aujourd’hui'}</span></span>
        </button>
        <button onClick={() => onAdd('symptom')} className="card flex items-center gap-4 p-5 text-left transition hover:border-brand-400">
          <span className="rounded-xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-950"><Thermometer size={28} /></span>
          <span><span className="block text-lg font-bold">Signaler un symptôme</span><span className="muted">Mal de tête, vertiges, vision…</span></span>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Dernière mesure" className="lg:col-span-2" action={<Link to="/p/suivi" className="text-sm font-semibold text-brand-700 dark:text-brand-300">Voir le suivi →</Link>}>
          {last ? (
            <>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <p className="text-5xl font-extrabold tabular-nums tracking-tight">{last.systolic}<span className="text-slate-400">/</span>{last.diastolic}<span className="ml-1 text-base font-medium text-slate-500">mmHg</span></p>
                <div className="space-y-1 pb-1 text-sm">
                  <BpBadge sys={last.systolic} dia={last.diastolic} />
                  <p className="text-slate-500">Pouls {last.pulse} bpm · PP {pulsePressure(last)} mmHg</p>
                  <p className="text-xs text-slate-400">{fmtDateTime(last.measured_at)} ({timeAgo(last.measured_at)})</p>
                </div>
              </div>
              <div className="mt-4"><BpChart readings={data.readings} range="7j" thresholds={patient.thresholds} height={190} /></div>
            </>
          ) : (
            <Empty icon={<Activity size={40} />} title="Aucune mesure pour l’instant" text="Commencez par saisir votre première mesure de tension." action={<Button onClick={() => onAdd('reading')}>Saisir ma tension</Button>} />
          )}
        </Card>

        <Card title="Mon niveau de risque" subtitle="Risque neurologique estimé (indicatif)">
          <div className="flex justify-center"><RiskGauge score={risk.score} label={risk.label} hex={risk.hex} size={170} /></div>
          <ul className="mt-3 space-y-1 text-sm">
            {risk.factors.slice(0, 4).map((f) => <li key={f.label} className="flex justify-between gap-2"><span className="text-slate-600 dark:text-slate-300">{f.label}</span><span className="font-semibold text-slate-500">+{f.points}</span></li>)}
            {!risk.factors.length && <li className="muted">Aucun facteur de risque majeur détecté.</li>}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Médicaments du jour" action={<Link to="/p/traitement" className="text-sm font-semibold text-brand-700 dark:text-brand-300">Tout voir</Link>}>
          {doses.length === 0 ? <p className="muted">Aucune prise prévue.</p> : (
            <ul className="space-y-2">
              {doses.slice(0, 4).map((d) => (
                <li key={d.med.id + d.time} className="flex items-center justify-between text-sm">
                  <span><b className="tabular-nums">{d.time}</b> · {d.med.name} {d.med.dosage}</span>
                  {d.intake ? <Badge className={d.intake.status === 'pris' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}>{d.intake.status === 'pris' ? 'Pris' : 'Oublié'}</Badge> : <Badge>À prendre</Badge>}
                </li>
              ))}
            </ul>
          )}
          {pending.length > 0 && <p className="mt-2 text-xs text-slate-500">{pending.length} prise(s) à confirmer.</p>}
        </Card>
        <Card title="Prochain rendez-vous">
          {next ? <ul><AppointmentItem a={next} /></ul> : <p className="muted">Aucun rendez-vous prévu.</p>}
          {doctorName && <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><Stethoscope size={14} /> Médecin traitant : {doctorName}</p>}
        </Card>
        <Card title="Alertes récentes" action={<Link to="/p/alertes" className="text-sm font-semibold text-brand-700 dark:text-brand-300">Tout voir</Link>}>
          {active.length === 0 ? <p className="muted">Aucune alerte active. 👍</p> : (
            <ul className="space-y-2">
              {active.slice(0, 3).map((a) => <li key={a.id} className="text-sm"><b>{a.title}</b><span className="block text-xs text-slate-500">{timeAgo(a.created_at)}</span></li>)}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Moyenne 7 jours" value={(() => { const w = data.readings.filter((r) => Date.now() - Date.parse(r.measured_at) < 7 * 864e5); return w.length ? `${Math.round(w.reduce((a, r) => a + r.systolic, 0) / w.length)}/${Math.round(w.reduce((a, r) => a + r.diastolic, 0) / w.length)}` : '—'; })()} unit="mmHg" icon={<Activity size={20} />} />
        <Stat label="Objectif" value={`< ${patient.record.goals?.sys_target ?? 135}/${patient.record.goals?.dia_target ?? 85}`} unit="mmHg" icon={<HeartPulse size={20} />} tone="good" />
        <Stat label="Observance" value={adh === undefined ? '—' : `${adh}%`} sub="14 derniers jours" icon={<Pill size={20} />} tone={adh === undefined ? 'default' : adh >= 80 ? 'good' : 'warn'} />
      </div>
      <p className="text-center text-xs text-slate-500">Prochain rappel : {(() => { const n = new Date(); const hm = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; const t = data.reminders.filter((r) => r.enabled).flatMap((r) => r.times.map((x) => ({ x, l: r.label }))).sort((a, b) => a.x.localeCompare(b.x)); const nx = t.find((x) => x.x > hm) ?? t[0]; return nx ? `${nx.l} à ${nx.x}` : 'aucun'; })()} · {fmtTime(new Date().toISOString())}</p>
    </div>
  );
}

function AlertsPage({ alerts }: { alerts: Alert[] }) {
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const list = filter === 'active' ? alerts.filter((a) => a.status === 'active') : alerts;
  return (
    <div>
      <PageHeader title="Mes alertes" subtitle="Générées automatiquement à partir de vos mesures et symptômes. Votre médecin les reçoit aussi." actions={<Segmented value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Actives' }, { value: 'all', label: 'Historique' }]} />} />
      {list.length === 0 ? <Card><Empty icon={<Bell size={40} />} title="Aucune alerte" text="Tout va bien pour le moment." /></Card> : <div className="space-y-3">{list.slice(0, 100).map((a) => <AlertCard key={a.id} alert={a} />)}</div>}
    </div>
  );
}
