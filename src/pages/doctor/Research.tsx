import { Download, FlaskConical, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePalette } from '../../components/charts';
import { PageHeader } from '../../components/Layout';
import { Button, Card, Stat } from '../../components/ui';
import { age, classifyBp, computeRisk, mean, pulsePressure, readingStats, since, SYMPTOMS } from '../../lib/medical';
import { downloadFile, toCsv } from '../../lib/util';
import { useStaffData } from './StaffApp';

/** Pseudonyme stable et non réversible côté interface. */
const pseudo = (id: string) => 'P-' + [...id].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381).toString(36).toUpperCase().slice(0, 6);
const ageBand = (a: number) => (a < 40 ? '< 40' : a < 50 ? '40–49' : a < 60 ? '50–59' : a < 70 ? '60–69' : '≥ 70');

export default function Research() {
  const d = useStaffData();
  const c = usePalette();
  const cohort = useMemo(
    () =>
      d.patients.map((p) => {
        const r = d.readings.filter((x) => x.patient_id === p.id);
        const s = d.symptoms.filter((x) => x.patient_id === p.id);
        const a = d.alerts.filter((x) => x.patient_id === p.id);
        const st = readingStats(since(r, 30, (x) => x.measured_at));
        return { id: pseudo(p.id), sex: p.sex, age: age(p.birth_date), band: ageBand(age(p.birth_date)), antecedents: p.record.antecedents.medical, st, symptoms: s, alerts: a, risk: computeRisk(p, r, s, a), readings: r };
      }),
    [d],
  );
  const allR = since(d.readings, 30, (x) => x.measured_at);
  const st = readingStats(allR);
  const dist = ['optimale', 'normale', 'normale_haute', 'grade1', 'grade2', 'grade3', 'hypo'].map((k) => ({
    name: { optimale: 'Optimale', normale: 'Normale', normale_haute: 'Norm. haute', grade1: 'HTA 1', grade2: 'HTA 2', grade3: 'HTA 3', hypo: 'Hypo' }[k],
    n: allR.filter((r) => classifyBp(r.systolic, r.diastolic).key === k).length,
  }));
  const symDist = SYMPTOMS.map((s) => ({ name: s.label, n: d.symptoms.filter((x) => x.symptom === s.key).length }));
  // Corrélation : TA systolique dans les 6 h précédant un symptôme neurologique vs moyenne
  const neuro = d.symptoms.filter((s) => SYMPTOMS.find((x) => x.key === s.symptom)?.neuro);
  const before = neuro.map((s) => d.readings.find((r) => r.patient_id === s.patient_id && r.measured_at <= s.started_at && Date.parse(s.started_at) - Date.parse(r.measured_at) < 6 * 36e5)).filter(Boolean) as typeof d.readings;

  const exportCsv = () =>
    downloadFile(
      'tensiocare_cohorte_anonymisee.csv',
      toCsv(
        cohort.flatMap((p) =>
          p.readings.map((r) => ({
            pseudo_id: p.id, sexe: p.sex, tranche_age: p.band, antecedents: p.antecedents.join('|'), date: r.measured_at.slice(0, 10), heure: r.measured_at.slice(11, 13),
            systolique: r.systolic, diastolique: r.diastolic, pouls: r.pulse, pression_pulsee: pulsePressure(r),
          })),
        ),
      ),
    );

  return (
    <div className="space-y-4">
      <PageHeader title="Recherche clinique" subtitle="Statistiques de cohorte – données anonymisées (pseudonymes, tranches d’âge, aucune donnée nominative)" actions={<Button onClick={exportCsv}><Download size={16} /> Export CSV anonymisé</Button>} />
      <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"><ShieldCheck size={18} className="mt-0.5 shrink-0" /> Aucun nom, téléphone ni adresse n’est affiché ou exporté. Les identifiants sont des pseudonymes non réversibles.</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Patient·es" value={cohort.length} icon={<FlaskConical size={20} />} sub={`${cohort.filter((p) => p.sex === 'F').length} F · ${cohort.filter((p) => p.sex === 'M').length} H`} />
        <Stat label="Mesures (30 j)" value={allR.length} sub={`TA moyenne ${st.sys}/${st.dia}`} />
        <Stat label="Contrôle tensionnel" value={`${st.controlled}%`} sub="mesures < 140/90" tone={st.controlled >= 60 ? 'good' : 'warn'} />
        <Stat label="TA avant symptôme neuro" value={before.length ? Math.round(mean(before.map((r) => r.systolic))) : '—'} unit="mmHg" sub={`vs ${st.sys} mmHg en moyenne (n=${before.length})`} tone="warn" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Répartition des mesures (classification ESH)" subtitle="30 derniers jours">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dist} margin={{ left: -16, right: 8 }}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="name" fontSize={11} stroke={c.axis} tickLine={false} />
              <YAxis fontSize={11} stroke={c.axis} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'rgba(100,116,139,0.1)' }} />
              <Bar dataKey="n" name="Mesures" fill={c.sys} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Symptômes déclarés" subtitle="Toute la période">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={symDist} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke={c.grid} horizontal={false} />
              <XAxis type="number" fontSize={11} stroke={c.axis} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={130} fontSize={11} stroke={c.axis} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(100,116,139,0.1)' }} />
              <Bar dataKey="n" name="Épisodes" fill={c.third} radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="Cohorte (30 derniers jours)">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Pseudonyme</th><th>Sexe</th><th>Âge</th><th>Antécédents</th><th className="text-right">Mesures</th><th className="text-right">TA moy.</th><th className="text-right">σ sys</th><th className="text-right">PP</th><th className="text-right">Symptômes</th><th className="text-right">Alertes crit.</th><th>Risque</th></tr></thead>
            <tbody>
              {cohort.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.id}</td>
                  <td>{p.sex}</td>
                  <td>{p.band}</td>
                  <td className="text-xs">{p.antecedents.join(', ') || '—'}</td>
                  <td className="text-right tabular-nums">{p.st.count}</td>
                  <td className="text-right tabular-nums">{p.st.count ? `${p.st.sys}/${p.st.dia}` : '—'}</td>
                  <td className="text-right tabular-nums">{p.st.sysSd}</td>
                  <td className="text-right tabular-nums">{p.st.pp || '—'}</td>
                  <td className="text-right tabular-nums">{p.symptoms.length}</td>
                  <td className="text-right tabular-nums">{p.alerts.filter((a) => a.level === 'critical').length}</td>
                  <td><span className={`chip text-white ${p.risk.color}`}>{p.risk.label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
