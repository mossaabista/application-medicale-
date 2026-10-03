import { db } from './db';
import { evaluateReading, evaluateSymptom, type AlertDraft } from './medical';
import type { Alert, Patient, Profile, Reading, SymptomEntry } from './types';
import { nowIso } from './util';

export async function createAlerts(patientId: string, drafts: AlertDraft[]): Promise<Alert[]> {
  if (!drafts.length) return [];
  const existing = await db.list('alerts', { patient_id: patientId, status: 'active' }, { limit: 50 });
  const out: Alert[] = [];
  for (const d of drafts) {
    const dup = existing.find((a) => a.type === d.type && Date.now() - Date.parse(a.created_at) < 12 * 3_600_000);
    if (dup && d.level !== 'critical') continue;
    out.push(await db.insert('alerts', { ...d, patient_id: patientId, status: 'active', created_at: nowIso() }));
  }
  return out;
}

export async function addReading(
  patient: Patient,
  data: Omit<Reading, 'id' | 'patient_id' | 'created_at'>,
): Promise<{ reading: Reading; alerts: Alert[] }> {
  const reading = await db.insert('readings', { ...data, patient_id: patient.id, created_at: nowIso() });
  const [history, symptoms] = await Promise.all([
    db.list('readings', { patient_id: patient.id }, { limit: 60 }),
    db.list('symptoms', { patient_id: patient.id }, { limit: 40 }),
  ]);
  const alerts = await createAlerts(patient.id, evaluateReading(reading, history, patient.thresholds, symptoms));
  return { reading, alerts };
}

export async function addSymptom(
  patient: Patient,
  data: Omit<SymptomEntry, 'id' | 'patient_id' | 'created_at'>,
): Promise<{ symptom: SymptomEntry; alerts: Alert[] }> {
  const symptom = await db.insert('symptoms', { ...data, patient_id: patient.id, created_at: nowIso() });
  const [history, readings] = await Promise.all([
    db.list('symptoms', { patient_id: patient.id }, { limit: 60 }),
    db.list('readings', { patient_id: patient.id }, { limit: 1 }),
  ]);
  const alerts = await createAlerts(patient.id, evaluateSymptom(symptom, history, readings[0]));
  return { symptom, alerts };
}

export async function acknowledgeAlert(a: Alert, by: Profile, resolve = false) {
  return db.update('alerts', a.id, {
    status: resolve ? 'resolved' : 'acknowledged',
    acknowledged_by: by.id,
    acknowledged_name: by.full_name,
    acknowledged_at: nowIso(),
  });
}

/* ---------------- Notifications navigateur ---------------- */

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Notification.permission;
}

export function notify(title: string, body: string, tag?: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      if (navigator.serviceWorker?.controller) {
        void navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body, tag, icon: './icon-192.png', badge: './icon-192.png' }));
      } else {
        new Notification(title, { body, tag, icon: './icon-192.png' });
      }
    }
  } catch {
    /* certains navigateurs (iOS hors écran d'accueil) refusent */
  }
}

export function beep(critical = false) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const tones = critical ? [880, 660, 880, 660] : [660];
    tones.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.25;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.start(t0);
      o.stop(t0 + 0.23);
    });
  } catch {
    /* ignore */
  }
}
