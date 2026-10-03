import { useEffect, useMemo, useState } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PERIODS, SYMPTOMS, SYMPTOM_LABEL, mean, pulsePressure, readingStats } from '../lib/medical';
import type { Reading, SymptomEntry, SymptomKey, Thresholds } from '../lib/types';
import { cx, Segmented } from './ui';

/* Palette validée (daltonisme, contraste) – clair / sombre */
const PALETTE = {
  light: { sys: '#2563eb', dia: '#d97706', third: '#7c3aed', grid: '#e2e8f0', axis: '#64748b', band: '#fee2e2', bandOk: '#dcfce7', seq: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'] },
  dark: { sys: '#60a5fa', dia: '#e8890c', third: '#a78bfa', grid: '#1e293b', axis: '#94a3b8', band: '#450a0a', bandOk: '#052e16', seq: ['#0f172a', '#1e3a8a', '#1d4ed8', '#3b82f6', '#93c5fd'] },
};

function useDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const o = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => o.disconnect();
  }, []);
  return dark;
}
export const usePalette = () => PALETTE[useDark() ? 'dark' : 'light'];

export type Range = '24h' | '7j' | '30j' | '90j' | 'tout';
export const RANGES: { value: Range; label: string }[] = [
  { value: '24h', label: 'Jour' },
  { value: '7j', label: 'Semaine' },
  { value: '30j', label: 'Mois' },
  { value: '90j', label: '3 mois' },
  { value: 'tout', label: 'Tout' },
];
const RANGE_MS: Record<Range, number> = { '24h': 864e5, '7j': 7 * 864e5, '30j': 30 * 864e5, '90j': 90 * 864e5, tout: Infinity };

export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return <Segmented size="sm" value={value} onChange={onChange} options={RANGES} />;
}

export function filterRange<T>(rows: T[], range: Range, key: (r: T) => string) {
  const t = Date.now() - RANGE_MS[range];
  return rows.filter((r) => Date.parse(key(r)) >= t);
}

const fmtTick = (range: Range) => (t: number) => {
  const d = new Date(t);
  if (range === '24h') return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};
const fmtFull = (t: number) => new Date(t).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900/95">
      <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          {r.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-slate-900 dark:text-white">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: i.dashed ? 'none' : i.color, borderTop: i.dashed ? `2px dashed ${i.color}` : undefined }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/* ---------------- Courbe tensionnelle ---------------- */
export function BpChart({ readings, range, thresholds, height = 260, syncId, big }: { readings: Reading[]; range: Range; thresholds?: Thresholds; height?: number; syncId?: string; big?: boolean }) {
  const c = usePalette();
  const data = useMemo(
    () => filterRange(readings, range, (r) => r.measured_at).map((r) => ({ t: Date.parse(r.measured_at), sys: r.systolic, dia: r.diastolic })).sort((a, b) => a.t - b.t),
    [readings, range],
  );
  if (!data.length) return <NoData height={height} />;
  const sh = thresholds?.sys_high ?? 140;
  const dh = thresholds?.dia_high ?? 90;
  const maxY = Math.max(200, ...data.map((d) => d.sys + 10));
  return (
    <div>
      <Legend items={[{ label: 'Systolique', color: c.sys }, { label: 'Diastolique', color: c.dia }, { label: `Seuils ${sh}/${dh}`, color: '#dc2626', dashed: true }]} />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} syncId={syncId} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <ReferenceArea y1={sh} y2={maxY} fill={c.band} fillOpacity={0.5} ifOverflow="hidden" />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtTick(range)} stroke={c.axis} fontSize={big ? 14 : 11} tickLine={false} minTickGap={30} />
          <YAxis domain={[40, maxY]} stroke={c.axis} fontSize={big ? 14 : 11} tickLine={false} axisLine={false} unit="" />
          <ReferenceLine y={sh} stroke="#dc2626" strokeDasharray="5 4" />
          <ReferenceLine y={dh} stroke="#dc2626" strokeDasharray="5 4" strokeOpacity={0.6} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={fmtFull(label as number)}
                  rows={[
                    { label: 'Systolique', value: `${payload[0].payload.sys} mmHg`, color: c.sys },
                    { label: 'Diastolique', value: `${payload[0].payload.dia} mmHg`, color: c.dia },
                    { label: 'Pression pulsée', value: `${payload[0].payload.sys - payload[0].payload.dia} mmHg` },
                  ]}
                />
              ) : null
            }
          />
          <Line type="monotone" dataKey="sys" stroke={c.sys} strokeWidth={big ? 3 : 2} dot={data.length < 40 ? { r: 3 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="dia" stroke={c.dia} strokeWidth={big ? 3 : 2} dot={data.length < 40 ? { r: 3 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- Pouls / pression pulsée (un graphique par mesure) ---------------- */
export function SingleMetricChart({ readings, range, metric, height = 180, syncId, big }: { readings: Reading[]; range: Range; metric: 'pulse' | 'pp'; height?: number; syncId?: string; big?: boolean }) {
  const c = usePalette();
  const data = useMemo(
    () => filterRange(readings, range, (r) => r.measured_at).map((r) => ({ t: Date.parse(r.measured_at), v: metric === 'pulse' ? r.pulse : pulsePressure(r) })).sort((a, b) => a.t - b.t),
    [readings, range, metric],
  );
  if (!data.length) return <NoData height={height} />;
  const color = metric === 'pulse' ? c.third : c.sys;
  const [lo, hi] = metric === 'pulse' ? [50, 100] : [25, 60];
  const label = metric === 'pulse' ? 'Pouls' : 'Pression pulsée';
  const unit = metric === 'pulse' ? 'bpm' : 'mmHg';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} syncId={syncId} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <ReferenceArea y1={lo} y2={hi} fill={c.bandOk} fillOpacity={0.5} />
        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtTick(range)} stroke={c.axis} fontSize={big ? 14 : 11} tickLine={false} minTickGap={30} />
        <YAxis stroke={c.axis} fontSize={big ? 14 : 11} tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 10']} allowDecimals={false} />
        <Tooltip content={({ active, payload, label: l }) => (active && payload?.length ? <TooltipBox title={fmtFull(l as number)} rows={[{ label, value: `${payload[0].payload.v} ${unit}`, color }]} /> : null)} />
        <Area type="monotone" dataKey="v" stroke="none" fill={color} fillOpacity={0.08} isAnimationActive={false} />
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={big ? 3 : 2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Comparaison tension / symptômes (petits multiples synchronisés, un seul axe chacun) ---------------- */
export function BpSymptomComparison({ readings, symptoms, range }: { readings: Reading[]; symptoms: SymptomEntry[]; range: Range }) {
  const c = usePalette();
  const daily = useMemo(() => {
    const byDay = new Map<string, { sys: number[]; dia: number[]; intensity: number; count: number; labels: Set<string> }>();
    const day = (s: string) => s.slice(0, 10);
    for (const r of filterRange(readings, range, (x) => x.measured_at)) {
      const k = day(r.measured_at);
      const e = byDay.get(k) ?? { sys: [], dia: [], intensity: 0, count: 0, labels: new Set() };
      e.sys.push(r.systolic);
      e.dia.push(r.diastolic);
      byDay.set(k, e);
    }
    for (const s of filterRange(symptoms, range, (x) => x.started_at)) {
      const k = day(s.started_at);
      const e = byDay.get(k) ?? { sys: [], dia: [], intensity: 0, count: 0, labels: new Set() };
      e.intensity = Math.max(e.intensity, s.intensity);
      e.count++;
      e.labels.add(SYMPTOM_LABEL[s.symptom]);
      byDay.set(k, e);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, e]) => ({
        t: Date.parse(k + 'T12:00:00'),
        sys: e.sys.length ? Math.round(mean(e.sys)) : null,
        dia: e.dia.length ? Math.round(mean(e.dia)) : null,
        intensity: e.intensity || null,
        count: e.count,
        labels: [...e.labels].join(', '),
      }));
  }, [readings, symptoms, range]);
  if (!daily.length) return <NoData height={300} />;

  // Corrélation tension systolique ↔ intensité des symptômes
  const withBoth = daily.filter((d) => d.sys != null);
  const symDays = withBoth.filter((d) => d.count > 0);
  const calmDays = withBoth.filter((d) => d.count === 0);
  const avgSym = Math.round(mean(symDays.map((d) => d.sys!)));
  const avgCalm = Math.round(mean(calmDays.map((d) => d.sys!)));
  const r = (range === '24h' ? '7j' : range) as Range;
  return (
    <div className="space-y-2">
      <Legend items={[{ label: 'Systolique (moyenne du jour)', color: c.sys }, { label: 'Diastolique (moyenne du jour)', color: c.dia }]} />
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={daily} syncId="cmp" margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtTick(r)} hide />
          <YAxis domain={[50, 'dataMax + 10']} stroke={c.axis} fontSize={11} tickLine={false} axisLine={false} />
          <ReferenceLine y={140} stroke="#dc2626" strokeDasharray="5 4" />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={new Date(label as number).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  rows={[
                    { label: 'Tension moyenne', value: payload[0].payload.sys ? `${payload[0].payload.sys}/${payload[0].payload.dia}` : '—', color: c.sys },
                    { label: 'Symptômes', value: payload[0].payload.labels || 'aucun' },
                    { label: 'Intensité max', value: payload[0].payload.intensity ? `${payload[0].payload.intensity}/10` : '—' },
                  ]}
                />
              ) : null
            }
          />
          <Line type="monotone" dataKey="sys" stroke={c.sys} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="dia" stroke={c.dia} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs font-medium text-slate-500">Intensité maximale des symptômes (0–10)</p>
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={daily} syncId="cmp" margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtTick(r)} stroke={c.axis} fontSize={11} tickLine={false} minTickGap={30} />
          <YAxis domain={[0, 10]} ticks={[0, 5, 10]} stroke={c.axis} fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'rgba(100,116,139,0.1)' }} content={() => null} />
          <Bar dataKey="intensity" fill={c.third} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      {symDays.length > 0 && calmDays.length > 0 && (
        <p className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
          Les jours avec symptômes, la systolique moyenne est de <b>{avgSym} mmHg</b> contre <b>{avgCalm} mmHg</b> les jours sans symptôme
          {avgSym - avgCalm >= 8 ? ' : les symptômes semblent liés aux pics tensionnels.' : '.'}
        </p>
      )}
    </div>
  );
}

/* ---------------- Fréquence et intensité des symptômes ---------------- */
export function SymptomFrequency({ symptoms }: { symptoms: SymptomEntry[] }) {
  const c = usePalette();
  const data = SYMPTOMS.map((s) => {
    const rows = symptoms.filter((x) => x.symptom === s.key);
    return { name: s.label, count: rows.length, avg: rows.length ? Math.round(mean(rows.map((x) => x.intensity)) * 10) / 10 : 0 };
  });
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} horizontal={false} />
        <XAxis type="number" allowDecimals={false} stroke={c.axis} fontSize={11} tickLine={false} />
        <YAxis type="category" dataKey="name" width={130} stroke={c.axis} fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'rgba(100,116,139,0.1)' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={payload[0].payload.name} rows={[{ label: 'Épisodes', value: String(payload[0].payload.count), color: c.sys }, { label: 'Intensité moyenne', value: `${payload[0].payload.avg}/10` }]} /> : null)} />
        <Bar dataKey="count" fill={c.sys} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false} label={{ position: 'right', fontSize: 11, fill: c.axis }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Carte de chaleur symptôme × période de la journée (séquentiel, une teinte). */
export function SymptomHeatmap({ symptoms }: { symptoms: SymptomEntry[] }) {
  const c = usePalette();
  const counts = new Map<string, number>();
  for (const s of symptoms) counts.set(`${s.symptom}|${s.period}`, (counts.get(`${s.symptom}|${s.period}`) ?? 0) + 1);
  const max = Math.max(1, ...counts.values());
  const cell = (n: number) => (n === 0 ? c.seq[0] : c.seq[Math.min(4, 1 + Math.floor(((n - 1) / max) * 4))]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="p-1 text-left font-medium text-slate-500">Symptôme</th>
            {PERIODS.map((p) => (
              <th key={p.key} className="p-1 font-medium text-slate-500">{p.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SYMPTOMS.map((s) => (
            <tr key={s.key}>
              <td className="whitespace-nowrap p-1 pr-2 text-slate-700 dark:text-slate-300">{s.label}</td>
              {PERIODS.map((p) => {
                const n = counts.get(`${s.key}|${p.key}`) ?? 0;
                return (
                  <td key={p.key} title={`${s.label} – ${p.label} : ${n} épisode(s)`} className="h-8 min-w-[56px] rounded-md text-center font-semibold tabular-nums" style={{ background: cell(n), color: n / max > 0.5 ? '#fff' : undefined }}>
                    {n || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Évolution d'un symptôme dans le temps (intensité par épisode). */
export function SymptomTimeline({ symptoms, symptom, range }: { symptoms: SymptomEntry[]; symptom: SymptomKey | 'all'; range: Range }) {
  const c = usePalette();
  const data = filterRange(symptoms, range, (s) => s.started_at)
    .filter((s) => symptom === 'all' || s.symptom === symptom)
    .map((s) => ({ t: Date.parse(s.started_at), v: s.intensity, name: SYMPTOM_LABEL[s.symptom], d: s.duration_min }))
    .sort((a, b) => a.t - b.t);
  if (!data.length) return <NoData height={180} text="Aucun épisode sur la période" />;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin - 43200000', 'dataMax + 43200000']} tickFormatter={fmtTick(range)} stroke={c.axis} fontSize={11} tickLine={false} minTickGap={30} />
        <YAxis domain={[0, 10]} ticks={[0, 5, 10]} stroke={c.axis} fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'rgba(100,116,139,0.1)' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={fmtFull(payload[0].payload.t)} rows={[{ label: payload[0].payload.name, value: `${payload[0].payload.v}/10`, color: c.third }, { label: 'Durée', value: `${payload[0].payload.d} min` }]} /> : null)} />
        <Bar dataKey="v" fill={c.third} radius={[4, 4, 0, 0]} maxBarSize={10} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Tableau de surveillance (jour / semaine / mois) ---------------- */
export function MonitoringTable({ readings, symptoms, granularity }: { readings: Reading[]; symptoms: SymptomEntry[]; granularity: 'jour' | 'semaine' | 'mois' }) {
  const keyOf = (iso: string) => {
    const d = new Date(iso);
    if (granularity === 'jour') return iso.slice(0, 10);
    if (granularity === 'mois') return iso.slice(0, 7);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return monday.toISOString().slice(0, 10);
  };
  const label = (k: string) => {
    if (granularity === 'jour') return new Date(k + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
    if (granularity === 'mois') return new Date(k + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return 'Sem. du ' + new Date(k + 'T12:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };
  const groups = new Map<string, { r: Reading[]; s: SymptomEntry[] }>();
  for (const r of readings) {
    const k = keyOf(r.measured_at);
    groups.set(k, { r: [...(groups.get(k)?.r ?? []), r], s: groups.get(k)?.s ?? [] });
  }
  for (const s of symptoms) {
    const k = keyOf(s.started_at);
    groups.set(k, { r: groups.get(k)?.r ?? [], s: [...(groups.get(k)?.s ?? []), s] });
  }
  const rows = [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, granularity === 'jour' ? 31 : 26);
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>Période</th>
            <th className="text-right">Mesures</th>
            <th className="text-right">TA moyenne</th>
            <th className="text-right">Max</th>
            <th className="text-right">Min</th>
            <th className="text-right">Pouls</th>
            <th className="text-right">PP</th>
            <th className="text-right">Contrôle</th>
            <th>Symptômes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, g]) => {
            const st = readingStats(g.r);
            const symCount = new Map<string, number>();
            g.s.forEach((s) => symCount.set(SYMPTOM_LABEL[s.symptom], (symCount.get(SYMPTOM_LABEL[s.symptom]) ?? 0) + 1));
            return (
              <tr key={k}>
                <td className="whitespace-nowrap font-medium capitalize">{label(k)}</td>
                <td className="text-right tabular-nums">{st.count}</td>
                <td className={cx('text-right font-semibold tabular-nums', st.sys >= 140 || st.dia >= 90 ? 'text-red-600' : 'text-emerald-600')}>{st.count ? `${st.sys}/${st.dia}` : '—'}</td>
                <td className="text-right tabular-nums">{st.count ? st.sysMax : '—'}</td>
                <td className="text-right tabular-nums">{st.count ? st.sysMin : '—'}</td>
                <td className="text-right tabular-nums">{st.count ? st.hr : '—'}</td>
                <td className="text-right tabular-nums">{st.count ? st.pp : '—'}</td>
                <td className="text-right tabular-nums">{st.count ? `${st.controlled}%` : '—'}</td>
                <td className="min-w-[160px] text-xs">{[...symCount.entries()].map(([n, c]) => `${n}${c > 1 ? ` ×${c}` : ''}`).join(', ') || <span className="text-slate-400">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Jauge de risque ---------------- */
export function RiskGauge({ score, label, hex, size = 140 }: { score: number; label: string; hex: string; size?: number }) {
  const r = size / 2 - 10;
  const circ = Math.PI * r;
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }} role="img" aria-label={`Risque ${label}, score ${score} sur 100`}>
      <svg width={size} height={size / 2 + 14} viewBox={`0 0 ${size} ${size / 2 + 14}`}>
        <path d={`M10 ${size / 2} A ${r} ${r} 0 0 1 ${size - 10} ${size / 2}`} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth={12} strokeLinecap="round" />
        <path d={`M10 ${size / 2} A ${r} ${r} 0 0 1 ${size - 10} ${size / 2}`} fill="none" stroke={hex} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${(score / 100) * circ} ${circ}`} />
      </svg>
      <div className="absolute bottom-1 text-center">
        <p className="text-2xl font-extrabold tabular-nums leading-none">{score}</p>
        <p className="text-xs font-semibold" style={{ color: hex }}>{label}</p>
      </div>
    </div>
  );
}

export function NoData({ height = 200, text = 'Pas encore de données sur cette période' }: { height?: number; text?: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700" style={{ height }}>
      {text}
    </div>
  );
}

export function Sparkline({ values, color = '#2563eb', width = 90, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-xs text-slate-400">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 2 - ((v - min) / (max - min || 1)) * (height - 4)}`).join(' ');
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
