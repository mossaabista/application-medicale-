import { CalendarClock, CalendarPlus, FileText, MapPin, Plus, Send, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar, Badge, Button, Card, cx, Empty, Field, Input, Modal, Select, Textarea, useToast } from '../../components/ui';
import { db } from '../../lib/db';
import type { Appointment, Consultation, Message, Patient, Profile } from '../../lib/types';
import { fmtDate, fmtLong, fmtTime, nowIso, toLocalInput } from '../../lib/util';

const TYPE_LABEL: Record<Appointment['type'], string> = { consultation: 'Consultation', teleconsultation: 'Téléconsultation', controle: 'Contrôle', urgence: 'Urgence' };
const STATUS: Record<Appointment['status'], [string, string]> = {
  prevu: ['Prévu', 'bg-brand-100 text-brand-800'],
  termine: ['Terminé', 'bg-emerald-100 text-emerald-800'],
  annule: ['Annulé', 'bg-slate-200 text-slate-600'],
};

export function AppointmentItem({ a, showPatient, onStatus }: { a: Appointment; showPatient?: string; onStatus?: (s: Appointment['status']) => void }) {
  const d = new Date(a.starts_at);
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="w-14 shrink-0 rounded-xl bg-brand-50 py-1.5 text-center dark:bg-brand-950">
        <p className="text-xs font-semibold uppercase text-brand-600">{d.toLocaleDateString('fr-FR', { month: 'short' })}</p>
        <p className="text-xl font-extrabold leading-none">{d.getDate()}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{showPatient ?? TYPE_LABEL[a.type]} <span className="font-normal text-slate-500">· {fmtTime(a.starts_at)}</span></p>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          {a.type === 'teleconsultation' ? <Video size={12} /> : <MapPin size={12} />}
          {showPatient ? TYPE_LABEL[a.type] + ' · ' : ''}{a.location}{a.doctor_name && !showPatient ? ` · ${a.doctor_name}` : ''}
        </p>
        {a.notes && <p className="text-xs text-slate-500">{a.notes}</p>}
      </div>
      <Badge className={STATUS[a.status][1]}>{STATUS[a.status][0]}</Badge>
      {onStatus && a.status === 'prevu' && (
        <Select className="!w-auto !py-1 text-xs" value="" onChange={(e) => e.target.value && onStatus(e.target.value as Appointment['status'])} aria-label="Changer le statut">
          <option value="">…</option>
          <option value="termine">Terminé</option>
          <option value="annule">Annuler</option>
        </Select>
      )}
    </li>
  );
}

export function FollowUpView({ patient, appointments, consultations, me, isStaff, doctors }: { patient: Patient; appointments: Appointment[]; consultations: Consultation[]; me: Profile; isStaff: boolean; doctors: Profile[] }) {
  const toast = useToast();
  const [newAppt, setNewAppt] = useState(false);
  const [newCons, setNewCons] = useState(false);
  const upcoming = appointments.filter((a) => a.status === 'prevu' && Date.parse(a.starts_at) >= Date.now() - 3_600_000).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = appointments.filter((a) => !upcoming.includes(a));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Rendez-vous à venir" action={<Button className="!min-h-[36px] text-xs" onClick={() => setNewAppt(true)}><CalendarPlus size={14} /> {isStaff ? 'Planifier' : 'Demander'}</Button>}>
        {upcoming.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {upcoming.map((a) => <AppointmentItem key={a.id} a={a} onStatus={(s) => db.update('appointments', a.id, { status: s })} />)}
          </ul>
        ) : (
          <Empty icon={<CalendarClock size={36} />} title="Aucun rendez-vous prévu" />
        )}
        {past.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-slate-500">Historique ({past.length})</summary>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">{past.map((a) => <AppointmentItem key={a.id} a={a} />)}</ul>
          </details>
        )}
      </Card>

      <Card title="Historique des consultations" action={isStaff && <Button variant="secondary" className="!min-h-[36px] text-xs" onClick={() => setNewCons(true)}><Plus size={14} /> Consultation</Button>}>
        {consultations.length ? (
          <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5 dark:border-slate-700">
            {consultations.map((c) => (
              <li key={c.id}>
                <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-brand-600" />
                <p className="text-xs font-semibold uppercase text-slate-500">{fmtDate(c.date)} · {c.doctor_name}</p>
                <p className="font-semibold">{c.motif}</p>
                <div className="mt-1 space-y-0.5 text-sm text-slate-700 dark:text-slate-300">
                  {c.bp && <p>TA : <b>{c.bp}</b></p>}
                  {c.history && <p><span className="text-slate-500">Histoire : </span>{c.history}</p>}
                  {c.exam && isStaff && <p><span className="text-slate-500">Examen : </span>{c.exam}</p>}
                  {c.diagnosis && <p><span className="text-slate-500">Conclusion : </span>{c.diagnosis}</p>}
                  {c.plan && <p><span className="text-slate-500">Conduite : </span>{c.plan}</p>}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty icon={<FileText size={36} />} title="Aucune consultation" />
        )}
      </Card>

      {newAppt && (
        <Modal open onClose={() => setNewAppt(false)} title={isStaff ? 'Planifier un rendez-vous' : 'Demander un rendez-vous'}>
          <ApptForm
            doctors={doctors}
            defaultDoctor={patient.primary_doctor_id ?? (isStaff ? me.id : undefined)}
            isStaff={isStaff}
            onSave={async (a) => {
              const doc = doctors.find((d) => d.id === a.doctor_id);
              await db.insert('appointments', { ...a, patient_id: patient.id, doctor_name: doc?.full_name, status: 'prevu', notes: isStaff ? a.notes : `Demande du patient : ${a.notes ?? ''}` });
              toast(isStaff ? 'Rendez-vous planifié ✔' : 'Demande envoyée ✔');
              setNewAppt(false);
            }}
          />
        </Modal>
      )}
      {newCons && (
        <Modal open onClose={() => setNewCons(false)} title="Nouvelle consultation" wide>
          <ConsForm
            onSave={async (c) => {
              await db.insert('consultations', { ...c, patient_id: patient.id, doctor_id: me.id, doctor_name: me.full_name });
              toast('Consultation enregistrée ✔');
              setNewCons(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function ApptForm({ doctors, defaultDoctor, isStaff, onSave }: { doctors: Profile[]; defaultDoctor?: string; isStaff: boolean; onSave: (a: Partial<Appointment>) => void }) {
  const t = new Date(Date.now() + 86_400_000);
  t.setHours(9, 0, 0, 0);
  const [a, setA] = useState<Partial<Appointment>>({ starts_at: toLocalInput(t), duration_min: 30, type: 'consultation', location: 'Centre médical – Makepe', doctor_id: defaultDoctor });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave({ ...a, starts_at: new Date(a.starts_at!).toISOString() }); }}>
      <Field label="Médecin">
        <Select value={a.doctor_id ?? ''} onChange={(e) => setA({ ...a, doctor_id: e.target.value })} required>
          <option value="">Choisir…</option>
          {doctors.filter((d) => d.role === 'doctor').map((d) => <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` – ${d.specialty}` : ''}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={isStaff ? 'Date et heure' : 'Date souhaitée'}><Input type="datetime-local" value={a.starts_at} onChange={(e) => setA({ ...a, starts_at: e.target.value })} required /></Field>
        <Field label="Type">
          <Select value={a.type} onChange={(e) => setA({ ...a, type: e.target.value as Appointment['type'], location: e.target.value === 'teleconsultation' ? 'Vidéo' : 'Centre médical – Makepe' })}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Lieu"><Input value={a.location ?? ''} onChange={(e) => setA({ ...a, location: e.target.value })} /></Field>
      <Field label="Motif / notes"><Textarea value={a.notes ?? ''} onChange={(e) => setA({ ...a, notes: e.target.value })} rows={2} /></Field>
      <Button type="submit" className="w-full">{isStaff ? 'Planifier' : 'Envoyer la demande'}</Button>
    </form>
  );
}

function ConsForm({ onSave }: { onSave: (c: Partial<Consultation>) => void }) {
  const [c, setC] = useState<Partial<Consultation>>({ date: toLocalInput(), motif: 'Suivi de l’hypertension artérielle' });
  const set = (k: keyof Consultation) => (e: { target: { value: string } }) => setC({ ...c, [k]: e.target.value });
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSave({ ...c, date: new Date(c.date!).toISOString() }); }}>
      <Field label="Date"><Input type="datetime-local" value={c.date} onChange={set('date')} /></Field>
      <Field label="TA mesurée au cabinet"><Input value={c.bp ?? ''} onChange={set('bp')} placeholder="145/92 mmHg" /></Field>
      <Field label="Motif de consultation" className="sm:col-span-2"><Input required value={c.motif} onChange={set('motif')} /></Field>
      <Field label="Histoire / plaintes" className="sm:col-span-2"><Textarea value={c.history ?? ''} onChange={set('history')} /></Field>
      <Field label="Examen clinique" className="sm:col-span-2"><Textarea value={c.exam ?? ''} onChange={set('exam')} /></Field>
      <Field label="Conclusion / diagnostic"><Textarea value={c.diagnosis ?? ''} onChange={set('diagnosis')} rows={2} /></Field>
      <Field label="Conduite à tenir"><Textarea value={c.plan ?? ''} onChange={set('plan')} rows={2} /></Field>
      <Button type="submit" className="sm:col-span-2">Enregistrer la consultation</Button>
    </form>
  );
}

/* ---------------- Messagerie ---------------- */
export function MessagesView({ patient, messages, me, counterpart }: { patient: Patient; messages: Message[]; me: Profile; counterpart?: string }) {
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const sorted = messages.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
    // marquer comme lus les messages de l'autre partie
    sorted.filter((m) => !m.read && (me.role === 'patient' ? m.sender_role !== 'patient' : m.sender_role === 'patient')).forEach((m) => void db.update('messages', m.id, { read: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const send = async () => {
    if (!text.trim()) return;
    await db.insert('messages', { patient_id: patient.id, sender_id: me.id, sender_name: me.full_name, sender_role: me.role, body: text.trim(), read: false, created_at: nowIso() });
    setText('');
  };

  let lastDay = '';
  return (
    <Card className="flex h-[70vh] flex-col !p-0">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <p className="font-semibold">{counterpart ?? 'Messagerie sécurisée'}</p>
        <p className="text-xs text-slate-500">Pour une urgence, n’utilisez pas la messagerie : appelez le 119.</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {sorted.length === 0 && <Empty title="Aucun message" text="Posez vos questions à votre équipe soignante." />}
        {sorted.map((m) => {
          const mine = m.sender_id === me.id;
          const day = m.created_at.slice(0, 10);
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {sep && <p className="my-3 text-center text-xs font-semibold capitalize text-slate-400">{fmtLong(m.created_at)}</p>}
              <div className={cx('flex items-end gap-2', mine && 'flex-row-reverse')}>
                {!mine && <Avatar name={m.sender_name} className="h-8 w-8 text-xs" />}
                <div className={cx('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm', mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-slate-100 dark:bg-slate-800')}>
                  {!mine && <p className="text-xs font-semibold opacity-70">{m.sender_name}</p>}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={cx('mt-0.5 text-right text-[10px]', mine ? 'text-brand-100' : 'text-slate-400')}>{fmtTime(m.created_at)}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un message…" aria-label="Message" />
        <Button type="submit" aria-label="Envoyer" disabled={!text.trim()}><Send size={18} /></Button>
      </form>
    </Card>
  );
}

