import { Bell, Check, Lightbulb, Pill, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, cx, Empty, Field, Input, Modal, Textarea, useToast } from '../../components/ui';
import { db } from '../../lib/db';
import { DEFAULT_ADVICE, adherenceRate, todaysDoses } from '../../lib/medical';
import type { Intake, Medication, Patient, Profile, Reminder } from '../../lib/types';
import { fmtDate, nowIso } from '../../lib/util';

const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function TherapyView({ patient, meds, intakes, reminders, me, canPrescribe, isPatient }: { patient: Patient; meds: Medication[]; intakes: Intake[]; reminders: Reminder[]; me: Profile; canPrescribe: boolean; isPatient: boolean }) {
  const toast = useToast();
  const [editMed, setEditMed] = useState<Partial<Medication> | null>(null);
  const [editRem, setEditRem] = useState<Partial<Reminder> | null>(null);
  const [adviceEdit, setAdviceEdit] = useState<string | null>(null);
  const doses = todaysDoses(meds, intakes);
  const adh = adherenceRate(intakes);
  const active = meds.filter((m) => m.active);
  const stopped = meds.filter((m) => !m.active);

  const mark = async (d: (typeof doses)[number], status: 'pris' | 'oublie') => {
    if (d.intake) await db.update('intakes', d.intake.id, { status, taken_at: nowIso() });
    else await db.insert('intakes', { patient_id: patient.id, medication_id: d.med.id, scheduled_for: d.scheduled, status, taken_at: nowIso() });
    toast(status === 'pris' ? `${d.med.name} : prise notée ✔` : 'Oubli noté', status === 'pris' ? 'success' : 'info');
  };

  // grille d'observance des 7 derniers jours
  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ymd = d.toISOString().slice(0, 10);
    const day = intakes.filter((x) => x.scheduled_for.slice(0, 10) === ymd);
    return { d, taken: day.filter((x) => x.status === 'pris').length, total: day.length };
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Prises du jour" subtitle={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}>
          {doses.length === 0 ? (
            <Empty icon={<Pill size={36} />} title="Aucune prise prévue aujourd’hui" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {doses.map((d) => (
                <li key={d.med.id + d.time} className="flex items-center gap-3 py-3">
                  <span className="w-14 text-center text-sm font-bold tabular-nums text-slate-500">{d.time}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{d.med.name} <span className="font-normal text-slate-500">{d.med.dosage}</span></p>
                    {d.med.instructions && <p className="text-xs text-slate-500">{d.med.instructions}</p>}
                  </div>
                  {d.intake ? (
                    <Badge className={d.intake.status === 'pris' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}>{d.intake.status === 'pris' ? 'Pris' : 'Oublié'}</Badge>
                  ) : isPatient ? (
                    <div className="flex gap-1">
                      <Button variant="success" className="!min-h-[38px] px-3" onClick={() => mark(d, 'pris')} aria-label={`Marquer ${d.med.name} comme pris`}><Check size={16} /> Pris</Button>
                      <Button variant="ghost" className="!min-h-[38px] px-2" onClick={() => mark(d, 'oublie')} aria-label="Marquer comme oublié"><X size={16} /></Button>
                    </div>
                  ) : (
                    <Badge>À venir</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Traitement en cours" action={canPrescribe && <Button className="!min-h-[36px] text-xs" onClick={() => setEditMed({ times: ['08:00'], active: true, start_date: new Date().toISOString().slice(0, 10), form: 'Comprimé' })}><Plus size={14} /> Prescrire</Button>}>
          {active.length === 0 ? (
            <Empty icon={<Pill size={36} />} title="Aucun traitement actif" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {active.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{m.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{m.dosage} · {m.form}</p>
                    </div>
                    <Pill className="text-brand-500" size={20} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">{m.times.map((t) => <Badge key={t} className="bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200">{t}</Badge>)}</div>
                  {m.instructions && <p className="mt-2 text-xs text-slate-500">{m.instructions}</p>}
                  <p className="mt-1 text-xs text-slate-400">Depuis le {fmtDate(m.start_date)}{m.prescribed_name ? ` · ${m.prescribed_name}` : ''}</p>
                  {canPrescribe && (
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" className="!min-h-[32px] px-2 py-1 text-xs" onClick={() => setEditMed(m)}>Modifier</Button>
                      <Button variant="ghost" className="!min-h-[32px] px-2 py-1 text-xs text-red-600" onClick={() => confirm(`Arrêter ${m.name} ?`) && db.update('medications', m.id, { active: false, end_date: new Date().toISOString().slice(0, 10) })}>Arrêter</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {stopped.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-slate-500">{stopped.length} traitement(s) arrêté(s)</summary>
              <ul className="mt-2 space-y-1">{stopped.map((m) => <li key={m.id}>{m.name} {m.dosage} — arrêté le {fmtDate(m.end_date)}</li>)}</ul>
            </details>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><Lightbulb size={18} className="text-amber-500" /> {isPatient ? 'Conseils de mon médecin' : 'Conseils au patient'}</span>} action={canPrescribe && <Button variant="ghost" className="!min-h-[36px] text-xs" onClick={() => setAdviceEdit(patient.record.advice.join('\n'))}>Modifier</Button>}>
          <ul className="space-y-2">
            {patient.record.advice.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />{a}</li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Observance" subtitle="14 derniers jours">
          <p className={cx('text-4xl font-extrabold tabular-nums', adh === undefined ? 'text-slate-400' : adh >= 80 ? 'text-emerald-600' : adh >= 60 ? 'text-amber-600' : 'text-red-600')}>{adh === undefined ? '—' : `${adh}%`}</p>
          <p className="muted">{adh === undefined ? 'Pas encore de données' : adh >= 80 ? 'Bonne observance, continuez !' : 'Des prises sont oubliées : pensez aux rappels.'}</p>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
            {last7.map(({ d, taken, total }) => (
              <div key={d.toISOString()}>
                <div className={cx('mx-auto h-8 w-8 rounded-lg', total === 0 ? 'bg-slate-100 dark:bg-slate-800' : taken === total ? 'bg-emerald-500' : taken === 0 ? 'bg-red-500' : 'bg-amber-400')} title={`${taken}/${total} prise(s)`} />
                <span className="text-slate-500">{DAYS[d.getDay()]}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-2"><Bell size={18} /> Rappels</span>} action={<Button variant="ghost" className="!min-h-[36px] text-xs" onClick={() => setEditRem({ kind: 'tension', label: 'Mesurer ma tension', times: ['08:00'], days: [0, 1, 2, 3, 4, 5, 6], enabled: true })}><Plus size={14} /> Ajouter</Button>}>
          {reminders.length === 0 ? (
            <p className="muted">Aucun rappel.</p>
          ) : (
            <ul className="space-y-2">
              {reminders.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{r.label}</p>
                    <p className="text-xs text-slate-500">{r.times.join(' · ')} · {r.days.length === 7 ? 'tous les jours' : r.days.map((d) => DAYS[d]).join(' ')}</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" className="peer sr-only" checked={r.enabled} onChange={(e) => db.update('reminders', r.id, { enabled: e.target.checked })} aria-label={`Activer ${r.label}`} />
                    <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5 dark:bg-slate-600" />
                  </label>
                  <button className="p-1 text-slate-400 hover:text-red-600" onClick={() => db.remove('reminders', r.id)} aria-label="Supprimer le rappel"><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">Les rappels s’affichent lorsque l’application est ouverte ou installée sur l’écran d’accueil (notifications autorisées).</p>
        </Card>
      </div>

      {editMed && (
        <Modal open onClose={() => setEditMed(null)} title={editMed.id ? 'Modifier le traitement' : 'Nouvelle prescription'}>
          <MedForm
            med={editMed}
            onSave={async (m) => {
              if (m.id) await db.update('medications', m.id, m);
              else await db.insert('medications', { ...m, patient_id: patient.id, prescribed_by: me.id, prescribed_name: me.full_name, active: true });
              toast('Traitement enregistré ✔');
              setEditMed(null);
            }}
          />
        </Modal>
      )}
      {editRem && (
        <Modal open onClose={() => setEditRem(null)} title="Nouveau rappel">
          <ReminderForm
            rem={editRem}
            onSave={async (r) => {
              await db.insert('reminders', { ...r, patient_id: patient.id });
              toast('Rappel ajouté ✔');
              setEditRem(null);
            }}
          />
        </Modal>
      )}
      {adviceEdit !== null && (
        <Modal open onClose={() => setAdviceEdit(null)} title="Conseils au patient">
          <p className="muted mb-2">Un conseil par ligne.</p>
          <Textarea rows={8} value={adviceEdit} onChange={(e) => setAdviceEdit(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-1">
            {DEFAULT_ADVICE.filter((a) => !adviceEdit.includes(a)).map((a) => (
              <button key={a} className="chip bg-slate-100 text-left text-slate-700 dark:bg-slate-800 dark:text-slate-200" onClick={() => setAdviceEdit((adviceEdit + '\n' + a).trim())}>+ {a.slice(0, 40)}…</button>
            ))}
          </div>
          <Button className="mt-4 w-full" onClick={async () => { await db.update('patients', patient.id, { record: { ...patient.record, advice: adviceEdit.split('\n').map((x) => x.trim()).filter(Boolean) } }); setAdviceEdit(null); toast('Conseils mis à jour ✔'); }}>Enregistrer</Button>
        </Modal>
      )}
    </div>
  );
}

const COMMON_DRUGS = ['Amlodipine', 'Nifédipine LP', 'Hydrochlorothiazide', 'Indapamide', 'Losartan', 'Valsartan', 'Périndopril', 'Ramipril', 'Énalapril', 'Captopril', 'Bisoprolol', 'Aténolol', 'Furosémide', 'Spironolactone', 'Méthyldopa', 'Atorvastatine', 'Aspirine'];

function MedForm({ med, onSave }: { med: Partial<Medication>; onSave: (m: Partial<Medication>) => void }) {
  const [m, setM] = useState(med);
  const [times, setTimes] = useState((med.times ?? []).join(', '));
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave({ ...m, times: times.split(/[,;\s]+/).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).map((t) => t.padStart(5, '0')) }); }}>
      <Field label="Médicament">
        <Input required list="drugs" value={m.name ?? ''} onChange={(e) => setM({ ...m, name: e.target.value })} />
        <datalist id="drugs">{COMMON_DRUGS.map((d) => <option key={d} value={d} />)}</datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dosage"><Input required value={m.dosage ?? ''} onChange={(e) => setM({ ...m, dosage: e.target.value })} placeholder="5 mg" /></Field>
        <Field label="Forme"><Input value={m.form ?? ''} onChange={(e) => setM({ ...m, form: e.target.value })} /></Field>
      </div>
      <Field label="Heures de prise" hint="Séparées par des virgules, ex. 08:00, 20:00"><Input required value={times} onChange={(e) => setTimes(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Début"><Input type="date" value={m.start_date ?? ''} onChange={(e) => setM({ ...m, start_date: e.target.value })} /></Field>
        <Field label="Fin (facultatif)"><Input type="date" value={m.end_date ?? ''} onChange={(e) => setM({ ...m, end_date: e.target.value || null })} /></Field>
      </div>
      <Field label="Consignes"><Input value={m.instructions ?? ''} onChange={(e) => setM({ ...m, instructions: e.target.value })} placeholder="Pendant le repas…" /></Field>
      <Button type="submit" className="w-full">Enregistrer</Button>
    </form>
  );
}

function ReminderForm({ rem, onSave }: { rem: Partial<Reminder>; onSave: (r: Partial<Reminder>) => void }) {
  const [r, setR] = useState(rem);
  const [times, setTimes] = useState((rem.times ?? []).join(', '));
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave({ ...r, times: times.split(/[,;\s]+/).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).map((t) => t.padStart(5, '0')) }); }}>
      <Field label="Type">
        <select className="input" value={r.kind} onChange={(e) => setR({ ...r, kind: e.target.value as Reminder['kind'], label: e.target.value === 'tension' ? 'Mesurer ma tension' : e.target.value === 'medicament' ? 'Prendre mes médicaments' : 'Rendez-vous' })}>
          <option value="tension">Prise de tension</option>
          <option value="medicament">Médicament</option>
          <option value="rdv">Rendez-vous</option>
        </select>
      </Field>
      <Field label="Libellé"><Input value={r.label ?? ''} onChange={(e) => setR({ ...r, label: e.target.value })} /></Field>
      <Field label="Heures" hint="ex. 07:00, 19:00"><Input value={times} onChange={(e) => setTimes(e.target.value)} /></Field>
      <div>
        <span className="label">Jours</span>
        <div className="flex gap-1">
          {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((d, i) => (
            <button type="button" key={d} onClick={() => setR({ ...r, days: r.days?.includes(i) ? r.days.filter((x) => x !== i) : [...(r.days ?? []), i].sort() })} className={cx('flex-1 rounded-lg py-2 text-xs font-semibold', r.days?.includes(i) ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800')}>{d}</button>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full">Ajouter</Button>
    </form>
  );
}
