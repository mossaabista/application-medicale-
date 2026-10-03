import { Plus, Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkline } from '../../components/charts';
import { PageHeader } from '../../components/Layout';
import { BpBadge } from '../../components/medical-ui';
import { Avatar, Button, Card, cx, Empty, Field, Input, Modal, Segmented, Select, useToast } from '../../components/ui';
import { db, newPatientRecord } from '../../lib/db';
import { age, since } from '../../lib/medical';
import { can } from '../../lib/permissions';
import { useSession } from '../../lib/session';
import { DEFAULT_THRESHOLDS, type Patient } from '../../lib/types';
import { fullName, makeMrn, nowIso, timeAgo } from '../../lib/util';
import { usePatientRows } from './Dashboard';
import { useStaffData } from './StaffApp';

export default function Patients() {
  const rows = usePatientRows();
  const { profile } = useSession();
  const { staff } = useStaffData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [risk, setRisk] = useState<'all' | 'critique' | 'eleve' | 'modere' | 'faible'>('all');
  const [scope, setScope] = useState<'all' | 'mine' | 'hosp'>('all');
  const [sort, setSort] = useState<'risk' | 'name' | 'last'>('risk');
  const [create, setCreate] = useState(false);

  let list = rows.filter(({ p }) => `${p.first_name} ${p.last_name} ${p.mrn} ${p.city ?? ''} ${p.ward ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  if (risk !== 'all') list = list.filter((r) => r.risk.level === risk);
  if (scope === 'mine') list = list.filter((r) => r.p.primary_doctor_id === profile?.id);
  if (scope === 'hosp') list = list.filter((r) => !!r.p.ward);
  list = list.slice().sort((a, b) =>
    sort === 'risk' ? b.risk.score - a.risk.score : sort === 'name' ? a.p.last_name.localeCompare(b.p.last_name) : (b.last?.measured_at ?? '').localeCompare(a.last?.measured_at ?? ''),
  );

  return (
    <div>
      <PageHeader title="Patient·es" subtitle={`${rows.length} dossier(s)`} actions={can(profile?.role, 'record_patient_data') && <Button onClick={() => setCreate(true)}><UserPlus size={16} /> Nouveau patient</Button>} />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par nom, identifiant, quartier, lit…" className="pl-10" aria-label="Rechercher un patient" />
          </div>
          <Segmented size="sm" value={scope} onChange={setScope} options={[{ value: 'all', label: 'Tous' }, { value: 'mine', label: 'Mes patients' }, { value: 'hosp', label: 'Hospitalisés' }]} />
          <Select value={risk} onChange={(e) => setRisk(e.target.value as typeof risk)} className="!w-auto" aria-label="Filtrer par risque">
            <option value="all">Tous les risques</option>
            <option value="critique">Critique</option>
            <option value="eleve">Élevé</option>
            <option value="modere">Modéré</option>
            <option value="faible">Faible</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="!w-auto" aria-label="Trier">
            <option value="risk">Trier : risque</option>
            <option value="last">Trier : dernière mesure</option>
            <option value="name">Trier : nom</option>
          </Select>
        </div>
      </Card>
      {list.length === 0 ? <Card><Empty title="Aucun patient trouvé" /></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map(({ p, last, readings, risk: r, active }) => (
            <button key={p.id} onClick={() => navigate(`/d/patients/${p.id}`)} className="card flex flex-col gap-3 p-4 text-left transition hover:border-brand-400 hover:shadow-md">
              <div className="flex items-center gap-3">
                <Avatar name={fullName(p)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{fullName(p)}</p>
                  <p className="truncate text-xs text-slate-500">{p.sex === 'F' ? 'F' : 'M'} · {age(p.birth_date)} ans · {p.ward ?? p.city ?? p.mrn}</p>
                </div>
                <span className={cx('chip text-white', r.color)}>{r.label}</span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  {last ? (
                    <>
                      <p className="text-2xl font-extrabold tabular-nums">{last.systolic}/{last.diastolic}</p>
                      <p className="text-xs text-slate-500">{timeAgo(last.measured_at)} · pouls {last.pulse}</p>
                    </>
                  ) : <p className="muted">Aucune mesure</p>}
                </div>
                <Sparkline values={since(readings, 14, (x) => x.measured_at).slice().reverse().map((x) => x.systolic)} width={110} height={36} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {last && <BpBadge sys={last.systolic} dia={last.diastolic} />}
                {active.length > 0 && <span className="chip bg-red-100 text-red-700">{active.length} alerte(s)</span>}
                {p.primary_doctor_id && <span className="text-xs text-slate-500">{staff.find((s) => s.id === p.primary_doctor_id)?.full_name}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
      {create && <CreatePatient onClose={() => setCreate(false)} onCreated={(id) => navigate(`/d/patients/${id}`)} />}
    </div>
  );
}

function CreatePatient({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { profile } = useSession();
  const { staff } = useStaffData();
  const toast = useToast();
  const [f, setF] = useState<Partial<Patient>>({ sex: 'F', primary_doctor_id: profile?.role === 'doctor' ? profile.id : '' });
  const set = (k: keyof Patient) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title="Nouveau dossier patient" wide>
      <p className="muted mb-3">Pour un·e patient·e hospitalisé·e ou sans smartphone : les soignant·es saisiront les mesures. Le patient pourra créer son compte plus tard.</p>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const p = await db.insert('patients', {
            ...f, user_id: null, mrn: makeMrn(), primary_doctor_id: f.primary_doctor_id || null, record: newPatientRecord(), thresholds: { ...DEFAULT_THRESHOLDS }, created_at: nowIso(),
          } as Partial<Patient>);
          toast('Dossier créé ✔');
          onCreated(p.id);
        }}
      >
        <Field label="Prénom"><Input required value={f.first_name ?? ''} onChange={set('first_name')} /></Field>
        <Field label="Nom"><Input required value={f.last_name ?? ''} onChange={set('last_name')} /></Field>
        <Field label="Sexe"><Select value={f.sex} onChange={set('sex')}><option value="F">Femme</option><option value="M">Homme</option></Select></Field>
        <Field label="Date de naissance"><Input type="date" required value={f.birth_date ?? ''} onChange={set('birth_date')} /></Field>
        <Field label="Téléphone"><Input value={f.phone ?? ''} onChange={set('phone')} /></Field>
        <Field label="Quartier / ville"><Input value={f.city ?? ''} onChange={set('city')} /></Field>
        <Field label="Médecin traitant">
          <Select value={f.primary_doctor_id ?? ''} onChange={set('primary_doctor_id')}>
            <option value="">—</option>
            {staff.filter((s) => s.role === 'doctor').map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Service / lit (si hospitalisé)"><Input value={f.ward ?? ''} onChange={set('ward')} /></Field>
        <Button type="submit" className="sm:col-span-2"><Plus size={16} /> Créer le dossier</Button>
      </form>
    </Modal>
  );
}
