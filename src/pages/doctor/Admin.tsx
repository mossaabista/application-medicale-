import { Check, Minus, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/Layout';
import { Avatar, Badge, Card, Select, Stat, useToast } from '../../components/ui';
import { db, DEMO_STAFF_CODE, IS_DEMO } from '../../lib/db';
import { PERMISSION_LABELS, PLANS, ROLE_PERMISSIONS, can, type Permission } from '../../lib/permissions';
import { useSession } from '../../lib/session';
import { ROLE_LABELS, type Role } from '../../lib/types';
import { fmtDate } from '../../lib/util';
import { useStaffData } from './StaffApp';

const ROLES: Role[] = ['patient', 'doctor', 'nurse', 'researcher', 'hospital', 'admin'];

export default function Admin() {
  const { profile } = useSession();
  const { staff, patients } = useStaffData();
  const toast = useToast();
  const isAdmin = can(profile?.role, 'manage_users');
  const users = isAdmin ? staff : staff.filter((s) => s.role !== 'admin' && s.role !== 'patient');
  return (
    <div className="space-y-4">
      <PageHeader title="Administration" subtitle={isAdmin ? 'Comptes, rôles et permissions' : 'Personnel de l’établissement'} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Comptes" value={staff.length} />
        <Stat label="Soignant·es" value={staff.filter((s) => s.role === 'doctor' || s.role === 'nurse').length} />
        <Stat label="Dossiers patients" value={patients.length || staff.filter((s) => s.role === 'patient').length} />
        <Stat label="Abonnements payants" value={staff.filter((s) => s.plan !== 'gratuit').length} />
      </div>
      <Card title="Utilisateurs" subtitle={IS_DEMO ? `Code d’inscription professionnel (démo) : ${DEMO_STAFF_CODE}` : 'Le code d’inscription professionnel se modifie dans la table app_settings (Supabase).'}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Nom</th><th>Courriel</th><th>Rôle</th><th>Formule</th><th>Créé le</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><div className="flex items-center gap-2"><Avatar name={u.full_name} className="h-8 w-8 text-xs" /><span className="font-semibold">{u.full_name}</span></div></td>
                  <td className="text-slate-500">{u.email}</td>
                  <td>
                    {isAdmin && u.id !== profile?.id ? (
                      <Select className="!w-auto !py-1 text-sm" value={u.role} onChange={async (e) => { await db.update('profiles', u.id, { role: e.target.value as Role }); toast('Rôle modifié ✔'); }} aria-label={`Rôle de ${u.full_name}`}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </Select>
                    ) : <Badge className="bg-brand-100 text-brand-800">{ROLE_LABELS[u.role]}</Badge>}
                  </td>
                  <td>{PLANS.find((p) => p.key === u.plan)?.name}</td>
                  <td>{fmtDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={<span className="flex items-center gap-2"><ShieldCheck size={18} /> Matrice des rôles et permissions</span>}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Permission</th>{ROLES.map((r) => <th key={r} className="text-center">{ROLE_LABELS[r]}</th>)}</tr></thead>
            <tbody>
              {(Object.keys(PERMISSION_LABELS) as Permission[]).map((p) => (
                <tr key={p}>
                  <td>{PERMISSION_LABELS[p]}</td>
                  {ROLES.map((r) => <td key={r} className="text-center">{ROLE_PERMISSIONS[r].includes(p) ? <Check size={16} className="mx-auto text-emerald-600" aria-label="oui" /> : <Minus size={16} className="mx-auto text-slate-300" aria-label="non" />}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
