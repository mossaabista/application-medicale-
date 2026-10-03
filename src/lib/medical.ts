import type {
  Alert, AlertLevel, DayPeriod, Intake, Medication, Patient, Reading, SymptomEntry, SymptomKey, Thresholds,
} from './types';

/* ------------------------------------------------------------------ */
/* Référentiels                                                         */
/* ------------------------------------------------------------------ */

export const SYMPTOMS: { key: SymptomKey; label: string; hint: string; neuro: boolean; emoji: string }[] = [
  { key: 'cephalee', label: 'Céphalée', hint: 'Maux de tête', neuro: false, emoji: '🤕' },
  { key: 'vertiges', label: 'Vertiges', hint: 'Tête qui tourne, sensation d’instabilité', neuro: false, emoji: '💫' },
  { key: 'troubles_visuels', label: 'Troubles visuels', hint: 'Vision floue, double, perte de vision', neuro: true, emoji: '👁️' },
  { key: 'fourmillements', label: 'Fourmillements', hint: 'Picotements, engourdissement d’un membre ou du visage', neuro: true, emoji: '✋' },
  { key: 'faiblesse_musculaire', label: 'Faiblesse musculaire', hint: 'Bras/jambe faible, visage qui tombe', neuro: true, emoji: '💪' },
  { key: 'troubles_parole', label: 'Troubles de la parole', hint: 'Difficulté à parler ou à comprendre', neuro: true, emoji: '🗣️' },
  { key: 'confusion', label: 'Confusion', hint: 'Désorientation, troubles de la mémoire', neuro: true, emoji: '🌀' },
  { key: 'perte_equilibre', label: 'Perte d’équilibre', hint: 'Chutes, démarche instable', neuro: true, emoji: '⚖️' },
];
export const SYMPTOM_LABEL = Object.fromEntries(SYMPTOMS.map((s) => [s.key, s.label])) as Record<SymptomKey, string>;

export const PERIODS: { key: DayPeriod; label: string }[] = [
  { key: 'matin', label: 'Matin' },
  { key: 'apres_midi', label: 'Après-midi' },
  { key: 'soir', label: 'Soir' },
  { key: 'nuit', label: 'Nuit' },
];
export const PERIOD_LABEL = Object.fromEntries(PERIODS.map((p) => [p.key, p.label])) as Record<DayPeriod, string>;

export function periodOf(date: Date): DayPeriod {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'matin';
  if (h >= 12 && h < 18) return 'apres_midi';
  if (h >= 18 && h < 23) return 'soir';
  return 'nuit';
}

export const MEDICAL_ANTECEDENTS = [
  { key: 'diabete', label: 'Diabète' },
  { key: 'dyslipidemie', label: 'Dyslipidémie (cholestérol)' },
  { key: 'avc', label: 'AVC antérieur' },
  { key: 'ait', label: 'AIT (accident ischémique transitoire)' },
  { key: 'cardiopathie', label: 'Cardiopathie / infarctus' },
  { key: 'fa', label: 'Fibrillation atriale' },
  { key: 'irc', label: 'Insuffisance rénale chronique' },
  { key: 'obesite', label: 'Obésité' },
  { key: 'drepanocytose', label: 'Drépanocytose' },
  { key: 'apnee', label: 'Apnée du sommeil' },
  { key: 'vih', label: 'VIH' },
];
export const FAMILY_ANTECEDENTS = [
  { key: 'hta', label: 'Hypertension artérielle' },
  { key: 'avc', label: 'AVC' },
  { key: 'diabete', label: 'Diabète' },
  { key: 'cardiopathie', label: 'Maladie cardiaque précoce' },
  { key: 'mort_subite', label: 'Mort subite' },
];

export const SYSTEMIC_REVIEW: { group: string; items: { key: string; label: string }[] }[] = [
  {
    group: 'Neurologique',
    items: [
      { key: 'cephalees', label: 'Céphalées' },
      { key: 'vertiges', label: 'Vertiges' },
      { key: 'troubles_visuels', label: 'Troubles visuels' },
      { key: 'fourmillements', label: 'Fourmillements / paresthésies' },
      { key: 'deficit_moteur', label: 'Faiblesse d’un membre' },
      { key: 'aphasie', label: 'Troubles de la parole' },
      { key: 'confusion', label: 'Confusion' },
      { key: 'troubles_equilibre', label: 'Troubles de l’équilibre' },
      { key: 'syncope', label: 'Perte de connaissance' },
      { key: 'acouphenes', label: 'Acouphènes (bourdonnements)' },
    ],
  },
  {
    group: 'Cardio-respiratoire',
    items: [
      { key: 'douleur_thoracique', label: 'Douleur thoracique' },
      { key: 'palpitations', label: 'Palpitations' },
      { key: 'dyspnee', label: 'Essoufflement' },
      { key: 'oedemes', label: 'Œdèmes des jambes' },
    ],
  },
  {
    group: 'Rénal / général',
    items: [
      { key: 'nycturie', label: 'Urines fréquentes la nuit' },
      { key: 'hematurie', label: 'Sang dans les urines' },
      { key: 'epistaxis', label: 'Saignements de nez' },
      { key: 'fatigue', label: 'Fatigue inhabituelle' },
      { key: 'ronflements', label: 'Ronflements / somnolence diurne' },
    ],
  },
];

export const DEFAULT_ADVICE = [
  'Réduire le sel : moins de 5 g par jour (éviter cubes d’assaisonnement, poissons salés, conserves).',
  'Marcher au moins 30 minutes, 5 jours par semaine.',
  'Prendre les médicaments tous les jours à heure fixe, même sans symptômes.',
  'Mesurer la tension au calme, assis, après 5 minutes de repos, 2 fois le matin et 2 fois le soir.',
  'Arrêter le tabac et limiter l’alcool.',
  'Manger plus de fruits et légumes, limiter les graisses et fritures.',
];

export const BE_FAST = [
  { letter: 'B', word: 'Balance', text: 'Perte d’équilibre soudaine' },
  { letter: 'E', word: 'Eyes (Yeux)', text: 'Perte de vision soudaine' },
  { letter: 'F', word: 'Face (Visage)', text: 'Visage qui tombe d’un côté' },
  { letter: 'A', word: 'Arm (Bras)', text: 'Faiblesse d’un bras ou d’une jambe' },
  { letter: 'S', word: 'Speech (Parole)', text: 'Parole difficile ou incompréhensible' },
  { letter: 'T', word: 'Time (Temps)', text: 'Appelez le 119 (SAMU) immédiatement' },
];

export const EMERGENCY_NUMBERS = [
  { label: 'SAMU (ambulance)', number: '119' },
  { label: 'Pompiers', number: '118' },
  { label: 'Police', number: '117' },
  { label: 'Urgence générale', number: '112' },
];

/* ------------------------------------------------------------------ */
/* Classification tensionnelle (ESH 2023)                              */
/* ------------------------------------------------------------------ */

export interface BpCategory {
  key: string;
  label: string;
  short: string;
  color: string; // classe tailwind de fond
  text: string; // classe tailwind de texte
  hex: string;
  level: number; // 0..5
}

export const BP_CATEGORIES: BpCategory[] = [
  { key: 'hypo', label: 'Hypotension', short: 'Basse', color: 'bg-sky-100', text: 'text-sky-800', hex: '#0284c7', level: 1 },
  { key: 'optimale', label: 'Optimale', short: 'Optimale', color: 'bg-emerald-100', text: 'text-emerald-800', hex: '#059669', level: 0 },
  { key: 'normale', label: 'Normale', short: 'Normale', color: 'bg-emerald-100', text: 'text-emerald-800', hex: '#10b981', level: 0 },
  { key: 'normale_haute', label: 'Normale haute', short: 'Normale haute', color: 'bg-lime-100', text: 'text-lime-800', hex: '#65a30d', level: 1 },
  { key: 'grade1', label: 'HTA grade 1', short: 'HTA 1', color: 'bg-amber-100', text: 'text-amber-800', hex: '#d97706', level: 2 },
  { key: 'grade2', label: 'HTA grade 2', short: 'HTA 2', color: 'bg-orange-100', text: 'text-orange-800', hex: '#ea580c', level: 3 },
  { key: 'grade3', label: 'HTA grade 3 / crise', short: 'HTA 3', color: 'bg-red-100', text: 'text-red-800', hex: '#dc2626', level: 4 },
];

export function classifyBp(sys: number, dia: number): BpCategory {
  const c = (k: string) => BP_CATEGORIES.find((x) => x.key === k)!;
  if (sys >= 180 || dia >= 110) return c('grade3');
  if (sys >= 160 || dia >= 100) return c('grade2');
  if (sys >= 140 || dia >= 90) return c('grade1');
  if (sys < 90 || dia < 60) return c('hypo');
  if (sys >= 130 || dia >= 85) return c('normale_haute');
  if (sys >= 120 || dia >= 80) return c('normale');
  return c('optimale');
}

export const pulsePressure = (r: Pick<Reading, 'systolic' | 'diastolic'>) => r.systolic - r.diastolic;
export const meanArterialPressure = (r: Pick<Reading, 'systolic' | 'diastolic'>) =>
  Math.round(r.diastolic + (r.systolic - r.diastolic) / 3);

export function age(birth: string): number {
  const b = new Date(birth);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

/* ------------------------------------------------------------------ */
/* Statistiques                                                          */
/* ------------------------------------------------------------------ */

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export function sd(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}
const DAY = 86_400_000;
export const since = <T>(rows: T[], days: number, key: (r: T) => string) => {
  const t = Date.now() - days * DAY;
  return rows.filter((r) => new Date(key(r)).getTime() >= t);
};

export function readingStats(readings: Reading[]) {
  const sys = readings.map((r) => r.systolic);
  const dia = readings.map((r) => r.diastolic);
  const hr = readings.map((r) => r.pulse);
  const pp = readings.map(pulsePressure);
  return {
    count: readings.length,
    sys: Math.round(mean(sys)),
    dia: Math.round(mean(dia)),
    hr: Math.round(mean(hr)),
    pp: Math.round(mean(pp)),
    sysSd: Math.round(sd(sys) * 10) / 10,
    sysMax: sys.length ? Math.max(...sys) : 0,
    sysMin: sys.length ? Math.min(...sys) : 0,
    diaMax: dia.length ? Math.max(...dia) : 0,
    controlled: readings.length ? Math.round((readings.filter((r) => r.systolic < 140 && r.diastolic < 90).length / readings.length) * 100) : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Moteur d'alertes                                                     */
/* ------------------------------------------------------------------ */

export type AlertDraft = Omit<Alert, 'id' | 'created_at' | 'status' | 'patient_id'>;

const NEURO_KEYS: SymptomKey[] = ['troubles_visuels', 'fourmillements', 'faiblesse_musculaire', 'troubles_parole', 'confusion', 'perte_equilibre'];

/** Analyse d'une nouvelle mesure. `history` = mesures antérieures (n'importe quel ordre). */
export function evaluateReading(
  r: Reading,
  history: Reading[],
  t: Thresholds,
  recentSymptoms: SymptomEntry[] = [],
): AlertDraft[] {
  const out: AlertDraft[] = [];
  const pp = pulsePressure(r);
  const base = { reading_id: r.id, symptom_id: null };
  const when = new Date(r.measured_at).getTime();
  const prev = history
    .filter((h) => h.id !== r.id && new Date(h.measured_at).getTime() < when)
    .sort((a, b) => +new Date(b.measured_at) - +new Date(a.measured_at));
  const neuroRecent = recentSymptoms.filter(
    (s) => NEURO_KEYS.includes(s.symptom) && when - new Date(s.started_at).getTime() < DAY,
  );

  if (r.systolic >= t.sys_critical || r.diastolic >= t.dia_critical) {
    if (neuroRecent.length) {
      out.push({
        ...base, level: 'critical', type: 'urgence_hypertensive',
        title: 'Urgence hypertensive avec signes neurologiques',
        message: `Tension ${r.systolic}/${r.diastolic} mmHg associée à : ${[...new Set(neuroRecent.map((s) => SYMPTOM_LABEL[s.symptom]))].join(', ')}.`,
        advice: 'Appelez immédiatement le 119 (SAMU) ou rendez-vous aux urgences. Ne prenez pas de médicament supplémentaire sans avis médical.',
      });
    } else {
      out.push({
        ...base, level: 'critical', type: 'crise_hypertensive',
        title: 'Crise hypertensive',
        message: `Tension ${r.systolic}/${r.diastolic} mmHg (seuil critique ${t.sys_critical}/${t.dia_critical}).`,
        advice: 'Reposez-vous 5 minutes au calme et reprenez la mesure. Si elle reste élevée ou si des symptômes apparaissent (maux de tête violents, troubles de la vue, faiblesse, parole difficile) : appelez le 119.',
      });
    }
  } else if (r.systolic >= 160 || r.diastolic >= 100) {
    out.push({
      ...base, level: 'high', type: 'hta_severe',
      title: 'Tension très élevée',
      message: `Tension ${r.systolic}/${r.diastolic} mmHg (HTA grade 2).`,
      advice: 'Reprenez une mesure dans 15 minutes. Vérifiez la prise de votre traitement. Votre médecin a été prévenu.',
    });
  } else if (r.systolic >= t.sys_high || r.diastolic >= t.dia_high) {
    const last3 = [r, ...prev.slice(0, 2)];
    if (last3.length === 3 && last3.every((x) => x.systolic >= t.sys_high || x.diastolic >= t.dia_high)) {
      out.push({
        ...base, level: 'moderate', type: 'hta_persistante',
        title: 'Tension élevée persistante',
        message: `3 mesures consécutives au-dessus de ${t.sys_high}/${t.dia_high} mmHg.`,
        advice: 'Votre tension n’est pas contrôlée. Parlez-en à votre médecin ; le traitement doit peut-être être ajusté.',
      });
    }
  }

  if (r.systolic < t.sys_low || r.diastolic < t.dia_low) {
    out.push({
      ...base, level: 'high', type: 'hypotension',
      title: 'Tension trop basse',
      message: `Tension ${r.systolic}/${r.diastolic} mmHg (seuil bas ${t.sys_low}/${t.dia_low}).`,
      advice: 'Asseyez-vous ou allongez-vous, buvez de l’eau. En cas de malaise ou de chute, appelez le 119.',
    });
  }

  if (pp >= t.pp_high) {
    out.push({
      ...base, level: pp >= t.pp_high + 20 ? 'high' : 'moderate', type: 'pp_elevee',
      title: 'Pression pulsée élevée',
      message: `Pression pulsée de ${pp} mmHg (normale < ${t.pp_high}). Marqueur de rigidité artérielle et de risque cardio-vasculaire.`,
      advice: 'À signaler au médecin lors du prochain rendez-vous.',
    });
  } else if (pp < t.pp_low || pp < r.systolic * 0.25) {
    out.push({
      ...base, level: 'moderate', type: 'pp_pincee',
      title: 'Pression pulsée pincée',
      message: `Pression pulsée de ${pp} mmHg, anormalement basse.`,
      advice: 'Refaites la mesure. Si elle persiste, consultez votre médecin.',
    });
  }

  if (r.pulse > t.hr_high || r.pulse < t.hr_low) {
    out.push({
      ...base, level: 'moderate', type: r.pulse > t.hr_high ? 'tachycardie' : 'bradycardie',
      title: r.pulse > t.hr_high ? 'Pouls rapide' : 'Pouls lent',
      message: `Fréquence cardiaque de ${r.pulse} bpm.`,
      advice: 'Reposez-vous et refaites la mesure. En cas de palpitations, malaise ou douleur thoracique, appelez le 119.',
    });
  }

  // Variations brutales
  const last = prev[0];
  if (last && when - new Date(last.measured_at).getTime() <= 2 * DAY) {
    const dS = r.systolic - last.systolic;
    const dD = r.diastolic - last.diastolic;
    if (Math.abs(dS) >= t.delta_sys || Math.abs(dD) >= t.delta_dia) {
      out.push({
        ...base, level: 'high', type: 'variation_brutale',
        title: 'Variation brutale de la tension',
        message: `${dS >= 0 ? '+' : ''}${dS} mmHg (systolique) et ${dD >= 0 ? '+' : ''}${dD} mmHg (diastolique) depuis la mesure précédente.`,
        advice: 'Les variations brutales augmentent le risque d’AVC. Reprenez la mesure au calme ; le médecin a été informé.',
      });
    }
  } else {
    const week = prev.filter((h) => when - new Date(h.measured_at).getTime() <= 7 * DAY);
    if (week.length >= 3) {
      const m = mean(week.map((h) => h.systolic));
      if (Math.abs(r.systolic - m) >= t.delta_sys) {
        out.push({
          ...base, level: 'high', type: 'variation_brutale',
          title: 'Écart important avec votre moyenne',
          message: `Systolique ${r.systolic} mmHg contre ${Math.round(m)} mmHg en moyenne sur 7 jours.`,
          advice: 'Reprenez la mesure au calme. Le médecin a été informé.',
        });
      }
    }
  }
  return out;
}

/** Analyse d'un nouveau symptôme. */
export function evaluateSymptom(s: SymptomEntry, history: SymptomEntry[], lastReading?: Reading): AlertDraft[] {
  const out: AlertDraft[] = [];
  const base = { reading_id: null, symptom_id: s.id };
  const label = SYMPTOM_LABEL[s.symptom];
  const strongNeuro: SymptomKey[] = ['troubles_parole', 'faiblesse_musculaire', 'confusion'];
  const suddenNeuro: SymptomKey[] = ['troubles_visuels', 'perte_equilibre', 'fourmillements'];

  if ((strongNeuro.includes(s.symptom) && (s.sudden || s.intensity >= 5)) || (suddenNeuro.includes(s.symptom) && s.sudden && s.intensity >= 6)) {
    out.push({
      ...base, level: 'critical', type: 'signe_avc',
      title: 'Signe possible d’AVC',
      message: `${label}${s.sudden ? ' d’apparition brutale' : ''}${s.side ? ` (côté ${s.side})` : ''}, intensité ${s.intensity}/10.`,
      advice: 'APPELEZ LE 119 IMMÉDIATEMENT. Notez l’heure de début des symptômes. Ne mangez pas, ne buvez pas, ne prenez aucun médicament. Chaque minute compte.',
    });
  } else if (s.symptom === 'cephalee' && s.sudden && s.intensity >= 8) {
    out.push({
      ...base, level: 'critical', type: 'cephalee_brutale',
      title: 'Céphalée brutale et intense',
      message: `Mal de tête brutal d’intensité ${s.intensity}/10 (« coup de tonnerre »).`,
      advice: 'Une céphalée brutale et violente peut révéler une hémorragie cérébrale : appelez le 119.',
    });
  } else if (lastReading && Date.parse(s.started_at) - Date.parse(lastReading.measured_at) < 6 * 3_600_000 && (lastReading.systolic >= 180 || lastReading.diastolic >= 110)) {
    out.push({
      ...base, level: 'critical', type: 'symptome_hta_severe',
      title: 'Symptôme + tension très élevée',
      message: `${label} avec une dernière tension à ${lastReading.systolic}/${lastReading.diastolic} mmHg.`,
      advice: 'Appelez le 119 ou rendez-vous aux urgences.',
    });
  } else if (s.intensity >= 7) {
    out.push({
      ...base, level: 'moderate', type: 'symptome_intense',
      title: `${label} intense`,
      message: `Intensité ${s.intensity}/10 pendant ${s.duration_min} min.`,
      advice: 'Mesurez votre tension maintenant et notez-la dans l’application.',
    });
  }

  const week = history.filter(
    (h) => h.symptom === s.symptom && h.id !== s.id && Date.parse(s.started_at) - Date.parse(h.started_at) <= 7 * DAY,
  );
  if (week.length >= 2 && !out.some((a) => a.level === 'critical')) {
    out.push({
      ...base, level: 'moderate', type: 'symptome_recurrent',
      title: `${label} récurrent·e`,
      message: `${week.length + 1} épisodes sur les 7 derniers jours.`,
      advice: 'La répétition de ce symptôme doit être signalée au médecin.',
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Score de risque neurologique (indicatif)                             */
/* ------------------------------------------------------------------ */

export interface RiskResult {
  score: number;
  level: 'faible' | 'modere' | 'eleve' | 'critique';
  label: string;
  color: string;
  hex: string;
  factors: { label: string; points: number }[];
}

export const RISK_META = {
  faible: { label: 'Faible', color: 'bg-emerald-500', hex: '#10b981' },
  modere: { label: 'Modéré', color: 'bg-amber-500', hex: '#f59e0b' },
  eleve: { label: 'Élevé', color: 'bg-orange-600', hex: '#ea580c' },
  critique: { label: 'Critique', color: 'bg-red-600', hex: '#dc2626' },
} as const;

export function computeRisk(
  patient: Patient | undefined,
  readings: Reading[],
  symptoms: SymptomEntry[],
  alerts: Alert[] = [],
  adherence?: number,
): RiskResult {
  const f: { label: string; points: number }[] = [];
  const add = (label: string, points: number) => points > 0 && f.push({ label, points });

  const week = since(readings, 7, (r) => r.measured_at);
  const recent = week.length ? week : readings.slice().sort((a, b) => +new Date(b.measured_at) - +new Date(a.measured_at)).slice(0, 5);
  if (recent.length) {
    const s = mean(recent.map((r) => r.systolic));
    const d = mean(recent.map((r) => r.diastolic));
    const pts = s >= 180 || d >= 110 ? 40 : s >= 160 || d >= 100 ? 30 : s >= 140 || d >= 90 ? 20 : s >= 130 || d >= 85 ? 10 : 0;
    add(`Tension moyenne 7 j : ${Math.round(s)}/${Math.round(d)} mmHg`, pts);
    const pp = mean(recent.map(pulsePressure));
    add(`Pression pulsée moyenne ${Math.round(pp)} mmHg`, pp >= 60 ? 5 : 0);
  }
  const two = since(readings, 14, (r) => r.measured_at);
  const v = sd(two.map((r) => r.systolic));
  add(`Variabilité tensionnelle élevée (σ ${v.toFixed(1)})`, v > 15 ? 10 : v > 12 ? 5 : 0);

  const sw = since(symptoms, 7, (s) => s.started_at);
  const neuro = sw.filter((s) => NEURO_KEYS.includes(s.symptom) && s.intensity >= 4);
  add(`${neuro.length} symptôme(s) neurologique(s) sur 7 j`, Math.min(30, neuro.length * 10));
  const ceph = sw.filter((s) => s.symptom === 'cephalee' || s.symptom === 'vertiges');
  add('Céphalées / vertiges fréquents', ceph.length >= 3 ? 5 : 0);

  if (patient) {
    const m = patient.record?.antecedents?.medical ?? [];
    add('Antécédent d’AVC / AIT', m.includes('avc') || m.includes('ait') ? 10 : 0);
    add('Fibrillation atriale', m.includes('fa') ? 8 : 0);
    add('Diabète', m.includes('diabete') ? 5 : 0);
    add('Dyslipidémie', m.includes('dyslipidemie') ? 3 : 0);
    add('Insuffisance rénale', m.includes('irc') ? 3 : 0);
    add('Tabagisme actif', patient.record?.antecedents?.tobacco === 'actuel' ? 5 : 0);
    add('Âge ≥ 65 ans', patient.birth_date && age(patient.birth_date) >= 65 ? 5 : 0);
  }
  if (adherence !== undefined && adherence < 80) add(`Observance du traitement ${adherence}%`, 5);

  let score = Math.min(100, f.reduce((a, x) => a + x.points, 0));
  const crit = alerts.filter((a) => a.level === 'critical' && Date.now() - Date.parse(a.created_at) < DAY);
  if (crit.length) {
    if (score < 75) f.push({ label: 'Alerte critique dans les 24 h', points: 75 - score });
    score = Math.max(score, 75);
  }
  const level: RiskResult['level'] = score >= 75 ? 'critique' : score >= 50 ? 'eleve' : score >= 25 ? 'modere' : 'faible';
  return { score, level, ...RISK_META[level], factors: f.sort((a, b) => b.points - a.points) };
}

export function adherenceRate(intakes: Intake[], days = 14): number | undefined {
  const r = since(intakes, days, (i) => i.scheduled_for);
  if (!r.length) return undefined;
  return Math.round((r.filter((i) => i.status === 'pris').length / r.length) * 100);
}

/** Prises prévues aujourd'hui pour les médicaments actifs. */
export function todaysDoses(meds: Medication[], intakes: Intake[], day = new Date()) {
  const ymd = day.toISOString().slice(0, 10);
  const out: { med: Medication; time: string; scheduled: string; intake?: Intake }[] = [];
  for (const m of meds.filter((x) => x.active)) {
    if (m.start_date > ymd || (m.end_date && m.end_date < ymd)) continue;
    for (const time of m.times) {
      const d = new Date(day);
      const [h, mi] = time.split(':').map(Number);
      d.setHours(h, mi, 0, 0);
      const scheduled = d.toISOString();
      const intake = intakes.find((i) => i.medication_id === m.id && Math.abs(Date.parse(i.scheduled_for) - d.getTime()) < 60_000);
      out.push({ med: m, time, scheduled, intake });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

export const LEVEL_META: Record<AlertLevel, { label: string; badge: string; dot: string; ring: string }> = {
  info: { label: 'Info', badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400', ring: 'border-slate-300' },
  moderate: { label: 'Modérée', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', ring: 'border-amber-400' },
  high: { label: 'Élevée', badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-600', ring: 'border-orange-500' },
  critical: { label: 'Critique', badge: 'bg-red-100 text-red-800', dot: 'bg-red-600', ring: 'border-red-600' },
};
