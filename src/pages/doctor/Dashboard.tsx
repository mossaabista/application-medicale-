import { Activity, AlertTriangle, CalendarDays, MonitorSmartphone, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkline } from '../../components/charts';
import { PageHeader } from '../../components/Layout';
import { AlertCard, BpBadge } from '../../components/medical-ui';
import { Avatar, Badge, Card, cx, Empty, Spinner, Stat } from '../../components/ui';
import { computeRisk, RISK_META, since } from '../../lib/medical';
import { useSession } from '../../lib/session';
import { fmtTime, fullName, timeAgo } from '../../lib/util';
import { AppointmentItem } from '../shared/FollowUpView';
import { useStaffData } from './StaffApp';

export function usePatientRows() {
  const d = useStaffData();
  return useMemo(
    () =>
      d.patients.map((p) => {
        const readings = d.readings.filter((r) => r.patient_id === p.id);
        const symptoms = d.symptoms.filter((s) => s.patient_id === p.id);
        const alerts = d.alerts.filter((a) => a.patient_id === p.id);
        const risk = computeRisk(p, readings, symptoms, alerts);
        return { p, readings, symptoms, alerts, risk, last: readings[0], active: alerts.filter((a) => a.status === 'active') };
      }),
    [d.patients, d.readings, d.symptoms, d.alerts],
  );
}

export default function Dashboard() {
  const { profile } = useSession();
  const d = useStaffData();
  const rows = usePatientRows();
  const navigate = useNavigate();
  if (d.loading) return <Spinner />;

  const mine = rows.filter((r) => r.p.primary_doctor_id === profile?.id);
  const scope = profile?.role === 'doctor' && mine.length ? mine : rows;
  const byRisk = scope.slice().sort((a, b) => b.risk.score - a.risk.score);
  const active = d.alerts.filter((a) => a.status === 'active' && a.level !== 'info').sort((a, b) => (a.level === 'critical' ? -1 : 0) - (b.level === 'critical' ? -1 : 0) || b.created_at.localeCompare(a.created_at));
  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = d.appointments.filter((a) => a.starts_at.slice(0, 10) === today && a.status !== 'annule').sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const week = since(d.readings, 7, (r) => r.measured_at);
  const controlled = scope.filter((r) => {
    const w = since(r.readings, 7, (x) => x.measured_at);
    if (!w.length) return false;
    return w.reduce((a, x) => a + x.systolic, 0) / w.length < 140;
  }).length;
  const counts = { critique: 0, eleve: 0, modere: 0, faible: 0 };
  scope.forEach((r) => counts[r.risk.level]++);
  const silent = scope.filter((r) => !r.last || Date.now() - Date.parse(r.last.measured_at) > 3 * 864e5);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Bonjour ${profile?.full_name.split(' ').slice(0, 2).join(' ')}`}
        subtitle={profile?.role === 'doctor' && mine.length ? `${mine.length} patient·es suivi·es en tant que médecin traitant` : `${rows.length} patient·es dans l’établissement`}
        actions={<Link to="/moniteur" className="btn btn-secondary"><MonitorSmartphone size={16} /> Écran de surveillance</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Patient·es suivi·es" value={scope.length} icon={<Users size={20} />} sub={`${silent.length} sans mesure depuis 3 j`} />
        <Stat label="Alertes actives" value={active.length} icon={<AlertTriangle size={20} />} tone={active.some((a) => a.level === 'critical') ? 'bad' : active.length ? 'warn' : 'good'} sub={`${active.filter((a) => a.level === 'critical').length} critique(s)`} />
        <Stat label="HTA contrôlée (7 j)" value={scope.length ? `${Math.round((controlled / scope.length) * 100)}%` : '—'} icon={<Activity size={20} />} tone="good" sub={`${week.length} mesures cette semaine`} />
        <Stat label="RDV aujourd’hui" value={todayAppts.length} icon={<CalendarDays size={20} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Patient·es par niveau de risque" subtitle="Classement automatique : tension, variabilité, symptômes neurologiques, antécédents" action={<Link to="/d/patients" className="text-sm font-semibold text-brand-700 dark:text-brand-300">Tous →</Link>}>
          <div className="mb-3 flex h-3 overflow-hidden rounded-full" role="img" aria-label="Répartition des niveaux de risque">
            {(['critique', 'eleve', 'modere', 'faible'] as const).map((k) => counts[k] > 0 && <div key={k} className={cx(RISK_META[k].color, 'border-r-2 border-white last:border-0 dark:border-slate-900')} style={{ width: `${(counts[k] / scope.length) * 100}%` }} title={`${RISK_META[k].label} : ${counts[k]}`} />)}
          </div>
          <div className="mb-3 flex flex-wrap gap-3 text-xs">
            {(['critique', 'eleve', 'modere', 'faible'] as const).map((k) => <span key={k} className="flex items-center gap-1"><span className={cx('h-2.5 w-2.5 rounded-full', RISK_META[k].color)} />{RISK_META[k].label} : <b>{counts[k]}</b></span>)}
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Patient</th><th>Dernière TA</th><th className="hidden sm:table-cell">Tendance 14 j</th><th>Risque</th><th className="text-right">Alertes</th></tr></thead>
              <tbody>
                {byRisk.slice(0, 8).map(({ p, last, readings, risk, active: act }) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => navigate(`/d/patients/${p.id}`)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={fullName(p)} className="h-8 w-8 text-xs" />
                        <div><p className="font-semibold">{fullName(p)}</p><p className="text-xs text-slate-500">{p.ward ?? p.mrn}</p></div>
                      </div>
                    </td>
                    <td>{last ? <><b className="tabular-nums">{last.systolic}/{last.diastolic}</b> <span className="block text-xs text-slate-500">{timeAgo(last.measured_at)}</span></> : '—'}</td>
                    <td className="hidden sm:table-cell"><Sparkline values={since(readings, 14, (r) => r.measured_at).slice().reverse().map((r) => r.systolic)} /></td>
                    <td><span className={cx('chip text-white', risk.color)}>{risk.label} · {risk.score}</span></td>
                    <td className="text-right">{act.length ? <Badge className="bg-red-100 text-red-700">{act.length}</Badge> : <span className="text-slate-400">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Alertes à traiter" action={<Link to="/d/alertes" className="text-sm font-semibold text-brand-700 dark:text-brand-300">Toutes →</Link>}>
          {active.length === 0 ? <Empty title="Aucune alerte active" /> : (
            <div className="max-h-[520px] space-y-2 overflow-y-auto">
              {active.slice(0, 6).map((a) => {
                const p = d.patients.find((x) => x.id === a.patient_id);
                return <AlertCard key={a.id} alert={a} patientName={fullName(p)} onOpenPatient={() => navigate(`/d/patients/${a.patient_id}`)} />;
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Rendez-vous du jour" action={<Link to="/d/agenda" className="text-sm font-semibold text-brand-700 dark:text-brand-300">Agenda →</Link>}>
          {todayAppts.length === 0 ? <p className="muted">Aucun rendez-vous aujourd’hui.</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">{todayAppts.map((a) => <AppointmentItem key={a.id} a={a} showPatient={fullName(d.patients.find((p) => p.id === a.patient_id))} />)}</ul>
          )}
        </Card>
        <Card title="Dernières mesures reçues">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {d.readings.slice(0, 7).map((r) => {
              const p = d.patients.find((x) => x.id === r.patient_id);
              return (
                <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-12 text-xs tabular-nums text-slate-500">{fmtTime(r.measured_at)}</span>
                  <Link to={`/d/patients/${r.patient_id}`} className="flex-1 font-medium hover:underline">{fullName(p)}</Link>
                  <b className="tabular-nums">{r.systolic}/{r.diastolic}</b>
                  <BpBadge sys={r.systolic} dia={r.diastolic} />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
