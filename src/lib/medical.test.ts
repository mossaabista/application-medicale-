import { describe, expect, it } from 'vitest';
import { classifyBp, computeRisk, evaluateReading, evaluateSymptom, pulsePressure } from './medical';
import { DEFAULT_THRESHOLDS, type Reading, type SymptomEntry } from './types';

const now = Date.now();
const R = (sys: number, dia: number, hoursAgo = 0, pulse = 75): Reading => ({
  id: Math.random().toString(36), patient_id: 'p', measured_at: new Date(now - hoursAgo * 3_600_000).toISOString(),
  systolic: sys, diastolic: dia, pulse, source: 'manuel', created_at: '',
});
const S = (symptom: SymptomEntry['symptom'], intensity: number, sudden = false, hoursAgo = 0): SymptomEntry => ({
  id: Math.random().toString(36), patient_id: 'p', symptom, intensity, sudden, started_at: new Date(now - hoursAgo * 3_600_000).toISOString(),
  duration_min: 30, period: 'matin', created_at: '',
});
const types = (xs: { type: string }[]) => xs.map((x) => x.type);

describe('classification ESH', () => {
  it('classe correctement', () => {
    expect(classifyBp(118, 76).key).toBe('optimale');
    expect(classifyBp(135, 80).key).toBe('normale_haute');
    expect(classifyBp(145, 85).key).toBe('grade1');
    expect(classifyBp(150, 102).key).toBe('grade2');
    expect(classifyBp(185, 100).key).toBe('grade3');
    expect(classifyBp(85, 55).key).toBe('hypo');
    expect(pulsePressure({ systolic: 140, diastolic: 80 })).toBe(60);
  });
});

describe('alertes sur mesure', () => {
  it('crise hypertensive', () => {
    expect(types(evaluateReading(R(190, 115), [], DEFAULT_THRESHOLDS))).toContain('crise_hypertensive');
  });
  it('urgence si signes neurologiques récents', () => {
    const a = evaluateReading(R(190, 115), [], DEFAULT_THRESHOLDS, [S('troubles_parole', 5, false, 2)]);
    expect(a[0].type).toBe('urgence_hypertensive');
    expect(a[0].level).toBe('critical');
  });
  it('variation brutale', () => {
    expect(types(evaluateReading(R(165, 95), [R(125, 80, 5)], DEFAULT_THRESHOLDS))).toContain('variation_brutale');
  });
  it('pression pulsée anormale et pouls', () => {
    expect(types(evaluateReading(R(170, 80), [], DEFAULT_THRESHOLDS))).toContain('pp_elevee');
    expect(types(evaluateReading(R(110, 95, 0, 130), [], DEFAULT_THRESHOLDS))).toEqual(expect.arrayContaining(['pp_pincee', 'tachycardie']));
  });
  it('HTA persistante seulement après 3 mesures', () => {
    expect(types(evaluateReading(R(145, 92), [R(120, 80, 10)], DEFAULT_THRESHOLDS))).not.toContain('hta_persistante');
    expect(types(evaluateReading(R(145, 92), [R(146, 91, 10), R(148, 93, 20)], DEFAULT_THRESHOLDS))).toContain('hta_persistante');
  });
  it('aucune alerte pour une mesure normale', () => {
    expect(evaluateReading(R(122, 78), [R(120, 79, 12)], DEFAULT_THRESHOLDS)).toEqual([]);
  });
});

describe('alertes sur symptôme', () => {
  it('signe d’AVC', () => {
    expect(evaluateSymptom(S('faiblesse_musculaire', 6, true), [])[0].level).toBe('critical');
  });
  it('céphalée en coup de tonnerre', () => {
    expect(evaluateSymptom(S('cephalee', 9, true), [])[0].type).toBe('cephalee_brutale');
  });
  it('symptôme récurrent', () => {
    expect(types(evaluateSymptom(S('vertiges', 3), [S('vertiges', 3, false, 24), S('vertiges', 3, false, 48)]))).toContain('symptome_recurrent');
  });
});

describe('score de risque', () => {
  it('augmente avec la tension et les symptômes', () => {
    const low = computeRisk(undefined, [R(120, 75, 1), R(122, 78, 12)], []);
    const high = computeRisk(undefined, [R(185, 112, 1), R(178, 108, 12)], [S('confusion', 6, false, 3)]);
    expect(low.level).toBe('faible');
    expect(high.score).toBeGreaterThan(low.score);
    expect(['eleve', 'critique']).toContain(high.level);
  });
});
