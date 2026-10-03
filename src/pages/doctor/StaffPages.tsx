import { CalendarDays, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/Layout';
import { AlertCard } from '../../components/medical-ui';
import { Avatar, Button, Card, cx, Empty, Segmented, Select } from '../../components/ui';
import { acknowledgeAlert } from '../../lib/actions';
import { useSession } from '../../lib/session';
import type { AlertLevel } from '../../lib/types';
import { fullName, timeAgo } from '../../lib/util';
import { AppointmentItem, MessagesView } from '../shared/FollowUpView';
import { db } from '../../lib/db';
import { useStaffData } from './StaffApp';

export function AlertsCenter() {
  const d = useStaffData();
  const { profile } = useSession();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'active' | 'acknowledged' | 'all'>('active');
  const [level, setLevel] = useState<AlertLevel | 'all'>('all');
  const [mine, setMine] = useState(false);
  const list = d.alerts
    .filter((a) => status === 'all' || (status === 'active' ? a.status === 'active' : a.status !== 'active'))
    .filter((a) => level === 'all' || a.level === level)
    .filter((a) => !mine || d.patients.find((p) => p.id === a.patient_id)?.primary_doctor_id === profile?.id)
    .sort((a, b) => (b.level === 'critical' ? 1 : 0) - (a.level === 'critical' ? 1 : 0) || b.created_at.localeCompare(a.created_at));
  const activeCount = d.alerts.filter((a) => a.status === 'active').length;

  return (
    <div>
      <PageHeader
        title="Centre d’alertes"
        subtitle={`${activeCount} alerte(s) active(s) · mises à jour en temps réel`}
        actions={activeCount > 0 && profile && status === 'active' && (
          <Button variant="secondary" onClick={() => { if (confirm('Prendre en charge toutes les alertes non critiques affichées ?')) list.filter((a) => a.level !== 'critical' && a.status === 'active').forEach((a) => void acknowledgeAlert(a, profile)); }}>Tout prendre en charge (hors critiques)</Button>
        )}
      />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented size="sm" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Actives' }, { value: 'acknowledged', label: 'Traitées' }, { value: 'all', label: 'Toutes' }]} />
          <Select value={level} onChange={(e) => setLevel(e.target.value as AlertLevel | 'all')} className="!w-auto" aria-label="Niveau">
            <option value="all">Tous niveaux</option>
            <option value="critical">Critique</option>
            <option value="high">Élevée</option>
            <option value="moderate">Modérée</option>
          </Select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Uniquement mes patients</label>
        </div>
      </Card>
      {list.length === 0 ? <Card><Empty title="Aucune alerte" /></Card> : (
        <div className="grid gap-2 lg:grid-cols-2">
          {list.slice(0, 120).map((a) => <AlertCard key={a.id} alert={a} patientName={fullName(d.patients.find((p) => p.id === a.patient_id))} onOpenPatient={() => navigate(`/d/patients/${a.patient_id}`)} />)}
        </div>
      )}
    </div>
  );
}

export function AgendaPage() {
  const d = useStaffData();
  const { profile } = useSession();
  const [offset, setOffset] = useState(0);
  const [mine, setMine] = useState(profile?.role === 'doctor');
  const start = useMemo(() => {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7) + offset * 7);
    return s;
  }, [offset]);
  const days = [...Array(7)].map((_, i) => new Date(start.getTime() + i * 864e5));
  const appts = d.appointments.filter((a) => !mine || a.doctor_id === profile?.id);
  const requests = d.appointments.filter((a) => a.status === 'prevu' && a.notes?.startsWith('Demande du patient'));

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={`Semaine du ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Mes rendez-vous</label>
            <Button variant="secondary" onClick={() => setOffset(offset - 1)} aria-label="Semaine précédente"><ChevronLeft size={16} /></Button>
            <Button variant="secondary" onClick={() => setOffset(0)}>Aujourd’hui</Button>
            <Button variant="secondary" onClick={() => setOffset(offset + 1)} aria-label="Semaine suivante"><ChevronRight size={16} /></Button>
          </>
        }
      />
      {requests.length > 0 && (
        <Card title={`Demandes de rendez-vous (${requests.length})`} className="mb-4">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {requests.map((a) => <AppointmentItem key={a.id} a={a} showPatient={fullName(d.patients.find((p) => p.id === a.patient_id))} onStatus={(s) => db.update('appointments', a.id, { status: s })} />)}
          </ul>
        </Card>
      )}
      <div className="grid gap-3 md:grid-cols-7">
        {days.map((day) => {
          const ymd = day.toISOString().slice(0, 10);
          const local = (iso: string) => { const x = new Date(iso); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
          const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const list = appts.filter((a) => local(a.starts_at) === dayKey).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          const isToday = new Date().toDateString() === day.toDateString();
          return (
            <div key={ymd} className={cx('card min-h-[140px] p-3', isToday && 'ring-2 ring-brand-500')}>
              <p className={cx('mb-2 text-sm font-bold capitalize', isToday && 'text-brand-600')}>{day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</p>
              <ul className="space-y-1.5">
                {list.map((a) => {
                  const p = d.patients.find((x) => x.id === a.patient_id);
                  return (
                    <li key={a.id} className={cx('rounded-lg p-2 text-xs', a.status === 'annule' ? 'bg-slate-100 line-through opacity-60 dark:bg-slate-800' : a.status === 'termine' ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-brand-50 dark:bg-brand-950')}>
                      <b className="tabular-nums">{new Date(a.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</b> {fullName(p)}
                      <span className="block text-slate-500">{a.type === 'teleconsultation' ? 'Vidéo' : a.type}</span>
                    </li>
                  );
                })}
                {list.length === 0 && <li className="text-xs text-slate-400">—</li>}
              </ul>
            </div>
          );
        })}
      </div>
      {appts.length === 0 && <Empty icon={<CalendarDays size={36} />} title="Aucun rendez-vous" />}
    </div>
  );
}

export function InboxPage() {
  const d = useStaffData();
  const { profile } = useSession();
  const threads = useMemo(() => {
    const m = new Map<string, typeof d.messages>();
    d.messages.forEach((x) => m.set(x.patient_id, [...(m.get(x.patient_id) ?? []), x]));
    return [...m.entries()]
      .map(([pid, msgs]) => ({ p: d.patients.find((x) => x.id === pid), msgs, last: msgs.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0], unread: msgs.filter((x) => !x.read && x.sender_role === 'patient').length }))
      .filter((t) => t.p)
      .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  }, [d]);
  const [sel, setSel] = useState<string | null>(null);
  const current = threads.find((t) => t.p!.id === sel) ?? threads[0];
  if (!profile) return null;
  return (
    <div>
      <PageHeader title="Messagerie" subtitle="Échanges sécurisés avec les patient·es" />
      {threads.length === 0 ? <Card><Empty icon={<MessageCircle size={36} />} title="Aucune conversation" text="Les messages des patient·es apparaîtront ici. Vous pouvez aussi écrire depuis la fiche d’un patient." /></Card> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="!p-2">
            <ul>
              {threads.map((t) => (
                <li key={t.p!.id}>
                  <button onClick={() => setSel(t.p!.id)} className={cx('flex w-full items-center gap-3 rounded-xl p-2 text-left', current?.p?.id === t.p!.id ? 'bg-brand-50 dark:bg-brand-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800')}>
                    <Avatar name={fullName(t.p)} />
                    <div className="min-w-0 flex-1">
                      <p className="flex justify-between font-semibold"><span className="truncate">{fullName(t.p)}</span><span className="text-xs font-normal text-slate-400">{timeAgo(t.last.created_at)}</span></p>
                      <p className="truncate text-sm text-slate-500">{t.last.body}</p>
                    </div>
                    {t.unread > 0 && <span className="rounded-full bg-brand-600 px-2 text-xs font-bold text-white">{t.unread}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <div className="lg:col-span-2">{current?.p && <MessagesView patient={current.p} messages={current.msgs} me={profile} counterpart={fullName(current.p)} />}</div>
        </div>
      )}
    </div>
  );
}
