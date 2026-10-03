import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  BpChart, BpSymptomComparison, MonitoringTable, RangePicker, SingleMetricChart, SymptomFrequency, SymptomHeatmap, SymptomTimeline, filterRange, type Range,
} from '../../components/charts';
import { BpBadge } from '../../components/medical-ui';
import { Button, Card, Empty, Segmented, Select, Stat } from '../../components/ui';
import { db } from '../../lib/db';
import { PERIOD_LABEL, SYMPTOMS, SYMPTOM_LABEL, pulsePressure, readingStats } from '../../lib/medical';
import type { Patient, Reading, SymptomEntry, SymptomKey } from '../../lib/types';
import { downloadFile, fmtDateTime, toCsv } from '../../lib/util';

export function SuiviView({ patient, readings, symptoms, canDelete }: { patient: Patient; readings: Reading[]; symptoms: SymptomEntry[]; canDelete?: boolean }) {
  const [range, setRange] = useState<Range>('30j');
  const [tab, setTab] = useState<'courbes' | 'symptomes' | 'comparaison' | 'tableau' | 'historique'>('courbes');
  const [gran, setGran] = useState<'jour' | 'semaine' | 'mois'>('jour');
  const [sym, setSym] = useState<SymptomKey | 'all'>('all');
  const r = filterRange(readings, range, (x) => x.measured_at);
  const s = filterRange(symptoms, range, (x) => x.started_at);
  const st = readingStats(r);

  const exportCsv = () =>
    downloadFile(
      `tensiocare_${patient.mrn}_mesures.csv`,
      toCsv(readings.map((x) => ({ date: fmtDateTime(x.measured_at), systolique: x.systolic, diastolique: x.diastolic, pouls: x.pulse, pression_pulsee: pulsePressure(x), bras: x.arm, position: x.position, contexte: x.context, note: x.note }))),
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'courbes', label: 'Courbes' },
            { value: 'symptomes', label: 'Symptômes' },
            { value: 'comparaison', label: 'Tension ↔ symptômes' },
            { value: 'tableau', label: 'Tableau' },
            { value: 'historique', label: 'Historique' },
          ]}
        />
        {tab !== 'tableau' && <RangePicker value={range} onChange={setRange} />}
      </div>

      {tab === 'courbes' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="TA moyenne" value={st.count ? `${st.sys}/${st.dia}` : '—'} unit="mmHg" sub={st.count ? <BpBadge sys={st.sys} dia={st.dia} /> : null} />
            <Stat label="Pouls moyen" value={st.count ? st.hr : '—'} unit="bpm" />
            <Stat label="Pression pulsée" value={st.count ? st.pp : '—'} unit="mmHg" sub={st.pp >= 60 ? 'Élevée' : 'Normale < 60'} tone={st.pp >= 60 ? 'warn' : 'default'} />
            <Stat label="Mesures contrôlées" value={st.count ? `${st.controlled}%` : '—'} sub={`${st.count} mesures · σ ${st.sysSd}`} tone={st.controlled >= 70 ? 'good' : st.controlled >= 40 ? 'warn' : 'bad'} />
          </div>
          <Card title="Pression artérielle" subtitle="Zone rouge : au-dessus du seuil d’alerte">
            <BpChart readings={readings} range={range} thresholds={patient.thresholds} syncId="suivi" />
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Pouls (fréquence cardiaque)" subtitle="Zone verte : 50–100 bpm">
              <SingleMetricChart readings={readings} range={range} metric="pulse" syncId="suivi" />
            </Card>
            <Card title="Pression pulsée (systolique − diastolique)" subtitle="Zone verte : 25–60 mmHg">
              <SingleMetricChart readings={readings} range={range} metric="pp" syncId="suivi" />
            </Card>
          </div>
        </>
      )}

      {tab === 'symptomes' && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Fréquence des symptômes" subtitle={`${s.length} épisode(s) sur la période`}>
              <SymptomFrequency symptoms={s} />
            </Card>
            <Card title="Moment de la journée" subtitle="Nombre d’épisodes par période">
              <SymptomHeatmap symptoms={s} />
            </Card>
          </div>
          <Card
            title="Évolution de l’intensité"
            action={
              <Select value={sym} onChange={(e) => setSym(e.target.value as SymptomKey | 'all')} className="!w-auto !py-1.5 text-sm">
                <option value="all">Tous les symptômes</option>
                {SYMPTOMS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </Select>
            }
          >
            <SymptomTimeline symptoms={symptoms} symptom={sym} range={range} />
          </Card>
        </>
      )}

      {tab === 'comparaison' && (
        <Card title="Comparaison tension / symptômes" subtitle="Moyenne journalière de la tension et intensité maximale des symptômes, sur le même axe du temps">
          <BpSymptomComparison readings={readings} symptoms={symptoms} range={range} />
        </Card>
      )}

      {tab === 'tableau' && (
        <Card
          title="Tableau de surveillance"
          action={<Segmented size="sm" value={gran} onChange={setGran} options={[{ value: 'jour', label: 'Journalier' }, { value: 'semaine', label: 'Hebdomadaire' }, { value: 'mois', label: 'Mensuel' }]} />}
        >
          <MonitoringTable readings={readings} symptoms={symptoms} granularity={gran} />
        </Card>
      )}

      {tab === 'historique' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Mesures" action={<Button variant="secondary" className="!min-h-[36px] text-xs" onClick={exportCsv}><Download size={14} /> CSV</Button>}>
            {r.length === 0 ? (
              <Empty title="Aucune mesure sur la période" />
            ) : (
              <div className="max-h-[520px] overflow-auto">
                <table className="table-base">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr><th>Date</th><th className="text-right">TA</th><th className="text-right">Pouls</th><th>Classe</th>{canDelete && <th />}</tr>
                  </thead>
                  <tbody>
                    {r.map((x) => (
                      <tr key={x.id}>
                        <td className="whitespace-nowrap">{fmtDateTime(x.measured_at)}<span className="block text-xs text-slate-500">{x.context}{x.source === 'soignant' ? ' · soignant' : ''}</span></td>
                        <td className="text-right font-semibold tabular-nums">{x.systolic}/{x.diastolic}</td>
                        <td className="text-right tabular-nums">{x.pulse}</td>
                        <td><BpBadge sys={x.systolic} dia={x.diastolic} /></td>
                        {canDelete && (
                          <td><button className="p-1 text-slate-400 hover:text-red-600" aria-label="Supprimer la mesure" onClick={() => confirm('Supprimer cette mesure ?') && db.remove('readings', x.id)}><Trash2 size={16} /></button></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Symptômes">
            {s.length === 0 ? (
              <Empty title="Aucun symptôme sur la période" />
            ) : (
              <div className="max-h-[520px] overflow-auto">
                <table className="table-base">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr><th>Date</th><th>Symptôme</th><th className="text-right">Intensité</th><th>Durée</th>{canDelete && <th />}</tr>
                  </thead>
                  <tbody>
                    {s.map((x) => (
                      <tr key={x.id}>
                        <td className="whitespace-nowrap">{fmtDateTime(x.started_at)}<span className="block text-xs text-slate-500">{PERIOD_LABEL[x.period]}</span></td>
                        <td>
                          {SYMPTOM_LABEL[x.symptom]}
                          {x.sudden && <span className="chip ml-1 bg-red-100 text-red-700">brutal</span>}
                          {x.side && <span className="block text-xs text-slate-500">côté {x.side}</span>}
                        </td>
                        <td className="text-right font-semibold tabular-nums">{x.intensity}/10</td>
                        <td className="whitespace-nowrap">{x.duration_min} min</td>
                        {canDelete && (
                          <td><button className="p-1 text-slate-400 hover:text-red-600" aria-label="Supprimer le symptôme" onClick={() => confirm('Supprimer ce symptôme ?') && db.remove('symptoms', x.id)}><Trash2 size={16} /></button></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
