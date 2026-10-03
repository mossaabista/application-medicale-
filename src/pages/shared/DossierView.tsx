import { ClipboardList, FileText, HeartPulse, History, IdCard, Pencil, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea, useToast } from '../../components/ui';
import { db } from '../../lib/db';
import { FAMILY_ANTECEDENTS, MEDICAL_ANTECEDENTS, SYSTEMIC_REVIEW, age } from '../../lib/medical';
import type { Antecedents, Consultation, DiseaseHistory, Patient, Profile } from '../../lib/types';
import { fmtDate, nowIso } from '../../lib/util';

function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{value || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

const SectionTitle = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <span className="flex items-center gap-2">
    <span className="rounded-lg bg-brand-50 p-1.5 text-brand-600 dark:bg-brand-950">{icon}</span>
    {children}
  </span>
);

export function DossierView({ patient, consultations, doctors, canEditClinical, canEditPersonal }: { patient: Patient; consultations: Consultation[]; doctors: Profile[]; canEditClinical: boolean; canEditPersonal: boolean }) {
  const toast = useToast();
  const [edit, setEdit] = useState<null | 'id' | 'history' | 'antecedents' | 'systemic'>(null);
  const rec = patient.record;
  const save = async (patch: Partial<Patient>) => {
    await db.update('patients', patient.id, patch);
    toast('Dossier mis à jour ✔');
    setEdit(null);
  };
  const lastCons = consultations[0];
  const doctor = doctors.find((d) => d.id === patient.primary_doctor_id);
  const lbl = (list: { key: string; label: string }[], keys: string[]) => keys.map((k) => list.find((x) => x.key === k)?.label ?? k);
  const positives = SYSTEMIC_REVIEW.flatMap((g) => g.items.filter((i) => rec.systemic?.items?.[i.key]).map((i) => i.label));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={<SectionTitle icon={<IdCard size={18} />}>Identification</SectionTitle>} action={canEditPersonal && <EditBtn onClick={() => setEdit('id')} />}>
        <dl>
          <Row label="Identifiant patient" value={<span className="font-mono">{patient.mrn}</span>} />
          <Row label="Nom" value={`${patient.first_name} ${patient.last_name}`} />
          <Row label="Sexe / âge" value={`${patient.sex === 'F' ? 'Femme' : patient.sex === 'M' ? 'Homme' : 'Autre'} · ${age(patient.birth_date)} ans (${fmtDate(patient.birth_date)})`} />
          <Row label="Téléphone" value={patient.phone} />
          <Row label="Adresse" value={patient.address || patient.city} />
          <Row label="Profession" value={patient.profession} />
          <Row label="Groupe sanguin" value={patient.blood_group} />
          <Row label="Poids / taille" value={patient.weight_kg && patient.height_cm ? `${patient.weight_kg} kg · ${patient.height_cm} cm · IMC ${(patient.weight_kg / (patient.height_cm / 100) ** 2).toFixed(1)}` : undefined} />
          <Row label="Personne à prévenir" value={patient.emergency_name ? `${patient.emergency_name} (${patient.emergency_phone ?? ''})` : undefined} />
          <Row label="Médecin traitant" value={doctor?.full_name} />
          {patient.ward && <Row label="Service / lit" value={patient.ward} />}
        </dl>
      </Card>

      <Card title={<SectionTitle icon={<ClipboardList size={18} />}>Motif de consultation</SectionTitle>}>
        {lastCons ? (
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Dernière visite · {fmtDate(lastCons.date)} · {lastCons.doctor_name}</p>
            <p className="text-base font-semibold">{lastCons.motif}</p>
            {lastCons.history && <p><span className="text-slate-500">Plaintes : </span>{lastCons.history}</p>}
            {lastCons.bp && <p><span className="text-slate-500">TA au cabinet : </span><b>{lastCons.bp}</b></p>}
            {lastCons.diagnosis && <p><span className="text-slate-500">Conclusion : </span>{lastCons.diagnosis}</p>}
            {lastCons.plan && <p><span className="text-slate-500">Conduite à tenir : </span>{lastCons.plan}</p>}
            {consultations.length > 1 && <p className="pt-1 text-xs text-slate-500">{consultations.length - 1} consultation(s) antérieure(s) dans l’onglet Consultations.</p>}
          </div>
        ) : (
          <p className="muted">Aucune consultation enregistrée.</p>
        )}
      </Card>

      <Card title={<SectionTitle icon={<History size={18} />}>Histoire de la maladie</SectionTitle>} action={canEditClinical && <EditBtn onClick={() => setEdit('history')} />}>
        <dl>
          <Row label="Diagnostic de l’HTA" value={fmtDate(rec.history.diagnosis_date)} />
          <Row label="Stade" value={rec.history.hta_grade} />
          <Row label="TA initiale" value={rec.history.initial_bp} />
          <Row label="Objectif tensionnel" value={rec.goals ? `< ${rec.goals.sys_target}/${rec.goals.dia_target} mmHg` : undefined} />
          <Row label="Observance" value={rec.history.adherence} />
        </dl>
        {rec.history.evolution && <p className="mt-2 text-sm"><span className="text-slate-500">Évolution : </span>{rec.history.evolution}</p>}
        {rec.history.complications && <p className="mt-1 text-sm"><span className="text-slate-500">Complications : </span>{rec.history.complications}</p>}
        {rec.history.previous_treatments && <p className="mt-1 text-sm"><span className="text-slate-500">Traitements antérieurs : </span>{rec.history.previous_treatments}</p>}
      </Card>

      <Card title={<SectionTitle icon={<FileText size={18} />}>Antécédents</SectionTitle>} action={(canEditClinical || canEditPersonal) && <EditBtn onClick={() => setEdit('antecedents')} />}>
        <div className="space-y-3 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Médicaux</p>
            <div className="flex flex-wrap gap-1">{rec.antecedents.medical.length ? lbl(MEDICAL_ANTECEDENTS, rec.antecedents.medical).map((x) => <Badge key={x} className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200">{x}</Badge>) : <span className="text-slate-400">Aucun</span>}</div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Familiaux</p>
            <div className="flex flex-wrap gap-1">{rec.antecedents.family.length ? lbl(FAMILY_ANTECEDENTS, rec.antecedents.family).map((x) => <Badge key={x}>{x}</Badge>) : <span className="text-slate-400">Aucun</span>}</div>
          </div>
          <dl>
            <Row label="Chirurgicaux" value={rec.antecedents.surgical} />
            <Row label="Allergies" value={rec.antecedents.allergies} />
            <Row label="Tabac" value={rec.antecedents.tobacco && { jamais: 'Jamais fumé', ancien: 'Ancien fumeur', actuel: 'Fumeur actuel' }[rec.antecedents.tobacco]} />
            <Row label="Alcool" value={rec.antecedents.alcohol && { non: 'Non', occasionnel: 'Occasionnel', regulier: 'Régulier' }[rec.antecedents.alcohol]} />
            <Row label="Activité physique" value={rec.antecedents.activity && { sedentaire: 'Sédentaire', moderee: 'Modérée', active: 'Active' }[rec.antecedents.activity]} />
            <Row label="Consommation de sel" value={rec.antecedents.salt && { faible: 'Faible', normal: 'Normale', eleve: 'Élevée' }[rec.antecedents.salt]} />
            {patient.sex === 'F' && <Row label="Gynéco-obstétricaux" value={rec.antecedents.gyneco} />}
          </dl>
        </div>
      </Card>

      <Card className="lg:col-span-2" title={<SectionTitle icon={<Search size={18} />}>Enquête systémique</SectionTitle>} subtitle={rec.systemic?.date ? `Dernière mise à jour : ${fmtDate(rec.systemic.date)}` : 'Recherche des autres signes associés à un risque d’AVC'} action={(canEditClinical || canEditPersonal) && <EditBtn onClick={() => setEdit('systemic')} />}>
        <div className="grid gap-4 md:grid-cols-3">
          {SYSTEMIC_REVIEW.map((g) => (
            <div key={g.group}>
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">{g.group}</p>
              <ul className="space-y-1 text-sm">
                {g.items.map((i) => (
                  <li key={i.key} className="flex items-center gap-2">
                    <span className={rec.systemic?.items?.[i.key] ? 'h-2.5 w-2.5 rounded-full bg-red-500' : 'h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-slate-700'} />
                    <span className={rec.systemic?.items?.[i.key] ? 'font-semibold' : 'text-slate-500'}>{i.label}</span>
                    <span className="sr-only">{rec.systemic?.items?.[i.key] ? 'présent' : 'absent'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm"><b>{positives.length}</b> signe(s) positif(s){positives.length ? ` : ${positives.join(', ')}` : ''}.</p>
        {rec.systemic?.notes && <p className="muted mt-1">{rec.systemic.notes}</p>}
      </Card>

      {edit === 'id' && <IdentityModal patient={patient} doctors={doctors} onSave={save} onClose={() => setEdit(null)} />}
      {edit === 'history' && <HistoryModal patient={patient} onSave={save} onClose={() => setEdit(null)} />}
      {edit === 'antecedents' && <AntecedentsModal patient={patient} onSave={save} onClose={() => setEdit(null)} />}
      {edit === 'systemic' && <SystemicModal patient={patient} onSave={save} onClose={() => setEdit(null)} />}
    </div>
  );
}

const EditBtn = ({ onClick }: { onClick: () => void }) => (
  <Button variant="ghost" className="!min-h-[36px] px-2 text-xs" onClick={onClick}><Pencil size={14} /> Modifier</Button>
);

type SaveFn = (p: Partial<Patient>) => Promise<void>;

function IdentityModal({ patient, doctors, onSave, onClose }: { patient: Patient; doctors: Profile[]; onSave: SaveFn; onClose: () => void }) {
  const [f, setF] = useState({ ...patient });
  const set = (k: keyof Patient) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title="Identification du patient" wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prénom"><Input value={f.first_name} onChange={set('first_name')} /></Field>
        <Field label="Nom"><Input value={f.last_name} onChange={set('last_name')} /></Field>
        <Field label="Sexe"><Select value={f.sex} onChange={set('sex')}><option value="F">Femme</option><option value="M">Homme</option><option value="Autre">Autre</option></Select></Field>
        <Field label="Date de naissance"><Input type="date" value={f.birth_date} onChange={set('birth_date')} /></Field>
        <Field label="Téléphone"><Input value={f.phone ?? ''} onChange={set('phone')} /></Field>
        <Field label="Adresse / quartier"><Input value={f.address ?? ''} onChange={set('address')} /></Field>
        <Field label="Profession"><Input value={f.profession ?? ''} onChange={set('profession')} /></Field>
        <Field label="Groupe sanguin"><Select value={f.blood_group ?? ''} onChange={set('blood_group')}><option value="">Inconnu</option>{['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Poids (kg)"><Input type="number" value={f.weight_kg ?? ''} onChange={(e) => setF({ ...f, weight_kg: Number(e.target.value) || undefined })} /></Field>
        <Field label="Taille (cm)"><Input type="number" value={f.height_cm ?? ''} onChange={(e) => setF({ ...f, height_cm: Number(e.target.value) || undefined })} /></Field>
        <Field label="Personne à prévenir"><Input value={f.emergency_name ?? ''} onChange={set('emergency_name')} /></Field>
        <Field label="Téléphone à prévenir"><Input value={f.emergency_phone ?? ''} onChange={set('emergency_phone')} /></Field>
        <Field label="Médecin traitant">
          <Select value={f.primary_doctor_id ?? ''} onChange={set('primary_doctor_id')}>
            <option value="">Aucun</option>
            {doctors.filter((d) => d.role === 'doctor').map((d) => <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` – ${d.specialty}` : ''}</option>)}
          </Select>
        </Field>
        <Field label="Service / lit (hospitalisation)"><Input value={f.ward ?? ''} onChange={set('ward')} placeholder="Ex. : Médecine interne – Lit 4" /></Field>
      </div>
      <Button className="mt-4 w-full" onClick={() => onSave({
        first_name: f.first_name, last_name: f.last_name, sex: f.sex, birth_date: f.birth_date, phone: f.phone, address: f.address, profession: f.profession, blood_group: f.blood_group,
        weight_kg: f.weight_kg, height_cm: f.height_cm, emergency_name: f.emergency_name, emergency_phone: f.emergency_phone, primary_doctor_id: f.primary_doctor_id || null, ward: f.ward,
      })}>Enregistrer</Button>
    </Modal>
  );
}

function HistoryModal({ patient, onSave, onClose }: { patient: Patient; onSave: SaveFn; onClose: () => void }) {
  const [h, setH] = useState<DiseaseHistory>({ ...patient.record.history });
  const [goals, setGoals] = useState(patient.record.goals ?? { sys_target: 135, dia_target: 85 });
  const set = (k: keyof DiseaseHistory) => (e: { target: { value: string } }) => setH({ ...h, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title="Histoire de la maladie" wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date du diagnostic"><Input type="date" value={h.diagnosis_date ?? ''} onChange={set('diagnosis_date')} /></Field>
        <Field label="Stade de l’HTA"><Select value={h.hta_grade ?? ''} onChange={set('hta_grade')}>{['', 'Grade 1', 'Grade 1 contrôlé', 'Grade 2', 'Grade 3', 'HTA résistante'].map((g) => <option key={g} value={g}>{g || '—'}</option>)}</Select></Field>
        <Field label="TA lors du diagnostic"><Input value={h.initial_bp ?? ''} onChange={set('initial_bp')} placeholder="170/100 mmHg" /></Field>
        <Field label="Observance"><Input value={h.adherence ?? ''} onChange={set('adherence')} /></Field>
        <Field label="Objectif systolique (<)"><Input type="number" value={goals.sys_target} onChange={(e) => setGoals({ ...goals, sys_target: Number(e.target.value) })} /></Field>
        <Field label="Objectif diastolique (<)"><Input type="number" value={goals.dia_target} onChange={(e) => setGoals({ ...goals, dia_target: Number(e.target.value) })} /></Field>
      </div>
      <div className="mt-3 space-y-3">
        <Field label="Évolution"><Textarea value={h.evolution ?? ''} onChange={set('evolution')} /></Field>
        <Field label="Complications"><Textarea value={h.complications ?? ''} onChange={set('complications')} /></Field>
        <Field label="Traitements antérieurs"><Textarea value={h.previous_treatments ?? ''} onChange={set('previous_treatments')} /></Field>
      </div>
      <Button className="mt-4 w-full" onClick={() => onSave({ record: { ...patient.record, history: h, goals } })}>Enregistrer</Button>
    </Modal>
  );
}

function Checks({ list, value, onChange }: { list: { key: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {list.map((i) => (
        <label key={i.key} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={value.includes(i.key)} onChange={(e) => onChange(e.target.checked ? [...value, i.key] : value.filter((x) => x !== i.key))} />
          {i.label}
        </label>
      ))}
    </div>
  );
}

function AntecedentsModal({ patient, onSave, onClose }: { patient: Patient; onSave: SaveFn; onClose: () => void }) {
  const [a, setA] = useState<Antecedents>({ ...patient.record.antecedents });
  const set = (k: keyof Antecedents) => (e: { target: { value: string } }) => setA({ ...a, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title="Antécédents" wide>
      <p className="label">Antécédents médicaux</p>
      <Checks list={MEDICAL_ANTECEDENTS} value={a.medical} onChange={(medical) => setA({ ...a, medical })} />
      <p className="label mt-4">Antécédents familiaux</p>
      <Checks list={FAMILY_ANTECEDENTS} value={a.family} onChange={(family) => setA({ ...a, family })} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Tabac"><Select value={a.tobacco ?? ''} onChange={set('tobacco')}><option value="">—</option><option value="jamais">Jamais</option><option value="ancien">Ancien fumeur</option><option value="actuel">Fumeur actuel</option></Select></Field>
        <Field label="Alcool"><Select value={a.alcohol ?? ''} onChange={set('alcohol')}><option value="">—</option><option value="non">Non</option><option value="occasionnel">Occasionnel</option><option value="regulier">Régulier</option></Select></Field>
        <Field label="Activité physique"><Select value={a.activity ?? ''} onChange={set('activity')}><option value="">—</option><option value="sedentaire">Sédentaire</option><option value="moderee">Modérée</option><option value="active">Active</option></Select></Field>
        <Field label="Consommation de sel"><Select value={a.salt ?? ''} onChange={set('salt')}><option value="">—</option><option value="faible">Faible</option><option value="normal">Normale</option><option value="eleve">Élevée</option></Select></Field>
        <Field label="Chirurgicaux"><Input value={a.surgical ?? ''} onChange={set('surgical')} /></Field>
        <Field label="Allergies"><Input value={a.allergies ?? ''} onChange={set('allergies')} /></Field>
        {patient.sex === 'F' && <Field label="Gynéco-obstétricaux" className="sm:col-span-2"><Input value={a.gyneco ?? ''} onChange={set('gyneco')} placeholder="Grossesses, contraception, ménopause…" /></Field>}
      </div>
      <Button className="mt-4 w-full" onClick={() => onSave({ record: { ...patient.record, antecedents: a } })}>Enregistrer</Button>
    </Modal>
  );
}

function SystemicModal({ patient, onSave, onClose }: { patient: Patient; onSave: SaveFn; onClose: () => void }) {
  const [items, setItems] = useState<Record<string, boolean>>({ ...(patient.record.systemic?.items ?? {}) });
  const [notes, setNotes] = useState(patient.record.systemic?.notes ?? '');
  return (
    <Modal open onClose={onClose} title="Enquête systémique" wide>
      <p className="muted mb-3">Cochez les signes présents au cours des dernières semaines.</p>
      {SYSTEMIC_REVIEW.map((g) => (
        <div key={g.group} className="mb-4">
          <p className="label flex items-center gap-2"><HeartPulse size={14} /> {g.group}</p>
          <Checks list={g.items} value={Object.keys(items).filter((k) => items[k])} onChange={(keys) => setItems({ ...Object.fromEntries(Object.keys(items).map((k) => [k, false])), ...Object.fromEntries(keys.map((k) => [k, true])) })} />
        </div>
      ))}
      <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <Button className="mt-4 w-full" onClick={() => onSave({ record: { ...patient.record, systemic: { items, notes, date: nowIso() } } })}>Enregistrer</Button>
    </Modal>
  );
}
