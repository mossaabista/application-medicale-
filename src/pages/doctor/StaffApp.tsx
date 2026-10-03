import { Bell, CalendarDays, CreditCard, FlaskConical, LayoutDashboard, MessageCircle, MonitorSmartphone, Settings, ShieldCheck, Users } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AppLayout, type NavItem } from '../../components/Layout';
import { Spinner, useToast } from '../../components/ui';
import { beep, notify } from '../../lib/actions';
import { useTable } from '../../lib/hooks';
import { can, type Permission } from '../../lib/permissions';
import { useSession } from '../../lib/session';
import type { Alert, Appointment, Message, Patient, Profile, Reading, SymptomEntry } from '../../lib/types';
import { fullName } from '../../lib/util';
import { SettingsPage, SubscriptionPage } from '../shared/AccountViews';
import Admin from './Admin';
import Dashboard from './Dashboard';
import PatientDetail from './PatientDetail';
import Patients from './Patients';
import Research from './Research';
import { AgendaPage, AlertsCenter, InboxPage } from './StaffPages';

export interface StaffData {
  patients: Patient[];
  readings: Reading[];
  symptoms: SymptomEntry[];
  alerts: Alert[];
  appointments: Appointment[];
  messages: Message[];
  staff: Profile[];
  loading: boolean;
}
const Ctx = createContext<StaffData | null>(null);
export const useStaffData = () => useContext(Ctx)!;

function Need({ p, children }: { p: Permission; children: ReactNode }) {
  const { profile } = useSession();
  return can(profile?.role, p) ? <>{children}</> : <Navigate to="/d" replace />;
}

export default function StaffApp() {
  const { profile } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const clinical = can(profile?.role, 'view_patients');
  const pf = clinical || can(profile?.role, 'research_anonymized') ? {} : null;
  const patients = useTable('patients', pf, { order: 'last_name', ascending: true });
  const readings = useTable('readings', pf, { limit: 20000 });
  const symptoms = useTable('symptoms', pf, { limit: 10000 });
  const alerts = useTable('alerts', pf, { limit: 2000 });
  const appointments = useTable('appointments', pf, { limit: 2000 });
  const messages = useTable('messages', pf, { limit: 2000 });
  const staff = useTable('profiles', {}, { order: 'full_name', ascending: true });
  const seen = useRef<Set<string> | null>(null);

  // Notification temps réel des nouvelles alertes (médecin principal en priorité)
  useEffect(() => {
    if (alerts.loading) return;
    const ids = new Set(alerts.rows.map((a) => a.id));
    if (seen.current) {
      const fresh = alerts.rows.filter((a) => !seen.current!.has(a.id) && a.status === 'active' && a.level !== 'info');
      for (const a of fresh) {
        const p = patients.rows.find((x) => x.id === a.patient_id);
        const mine = p?.primary_doctor_id === profile?.id;
        if (a.level === 'critical' || a.level === 'high' || mine) {
          const text = `${fullName(p)} – ${a.title}`;
          toast(`${a.level === 'critical' ? '🚨' : '⚠️'} ${text}`, a.level === 'critical' ? 'critical' : 'info');
          notify(`TensioCare – alerte ${a.level === 'critical' ? 'CRITIQUE' : ''}`, `${text}\n${a.message}`, a.id);
          beep(a.level === 'critical');
        }
      }
    }
    seen.current = ids;
  }, [alerts.rows, alerts.loading, patients.rows, profile?.id, toast]);

  if (!profile) return <Spinner />;
  const role = profile.role;
  const activeAlerts = alerts.rows.filter((a) => a.status === 'active' && a.level !== 'info');
  const unread = messages.rows.filter((m) => !m.read && m.sender_role === 'patient').length;

  const nav: NavItem[] = [
    ...(clinical
      ? [
          { to: '/d', label: 'Tableau de bord', icon: <LayoutDashboard size={20} />, end: true, mobile: true },
          { to: '/d/patients', label: 'Patients', icon: <Users size={20} />, mobile: true },
          { to: '/d/alertes', label: 'Alertes', icon: <Bell size={20} />, badge: activeAlerts.length, mobile: true },
          { to: '/d/agenda', label: 'Agenda', icon: <CalendarDays size={20} />, mobile: true },
          { to: '/d/messages', label: 'Messages', icon: <MessageCircle size={20} />, badge: unread },
        ]
      : []),
    ...(can(role, 'bedside_monitor') ? [{ to: '/moniteur', label: 'Écran de surveillance', icon: <MonitorSmartphone size={20} /> }] : []),
    ...(can(role, 'research_anonymized') ? [{ to: '/d/recherche', label: 'Recherche', icon: <FlaskConical size={20} />, mobile: !clinical }] : []),
    ...(can(role, 'manage_staff') || can(role, 'manage_users') ? [{ to: '/d/admin', label: 'Administration', icon: <ShieldCheck size={20} />, mobile: !clinical }] : []),
    ...(can(role, 'manage_billing') ? [{ to: '/d/abonnement', label: 'Abonnement', icon: <CreditCard size={20} /> }] : []),
    { to: '/d/parametres', label: 'Paramètres', icon: <Settings size={20} />, mobile: !clinical },
  ];

  const data: StaffData = {
    patients: patients.rows, readings: readings.rows, symptoms: symptoms.rows, alerts: alerts.rows, appointments: appointments.rows, messages: messages.rows,
    staff: staff.rows, loading: patients.loading || readings.loading,
  };

  return (
    <Ctx.Provider value={data}>
      <AppLayout
        nav={nav}
        topRight={
          clinical && activeAlerts.length > 0 ? (
            <button onClick={() => navigate('/d/alertes')} className="relative rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`${activeAlerts.length} alertes actives`}>
              <Bell size={22} />
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{activeAlerts.length}</span>
            </button>
          ) : null
        }
      >
        <Routes>
          <Route index element={clinical ? <Dashboard /> : <Navigate to={can(role, 'research_anonymized') ? '/d/recherche' : '/d/admin'} replace />} />
          <Route path="patients" element={<Need p="view_patients"><Patients /></Need>} />
          <Route path="patients/:id/*" element={<Need p="view_patients"><PatientDetail /></Need>} />
          <Route path="alertes" element={<Need p="view_patients"><AlertsCenter /></Need>} />
          <Route path="agenda" element={<Need p="view_patients"><AgendaPage /></Need>} />
          <Route path="messages" element={<Need p="view_patients"><InboxPage /></Need>} />
          <Route path="recherche" element={<Need p="research_anonymized"><Research /></Need>} />
          <Route path="admin" element={can(role, 'manage_staff') || can(role, 'manage_users') ? <Admin /> : <Navigate to="/d" />} />
          <Route path="abonnement" element={<SubscriptionPage />} />
          <Route path="parametres" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/d" replace />} />
        </Routes>
      </AppLayout>
    </Ctx.Provider>
  );
}
