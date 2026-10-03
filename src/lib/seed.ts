/* Données de démonstration (fictives) pour le mode DÉMO. */
import type {
  Alert, Appointment, Consultation, Intake, Medication, Message, Patient, Payment, Profile, Reading, Reminder,
  SymptomEntry, SymptomKey, TableMap, TableName,
} from './types';
import { DEFAULT_THRESHOLDS } from './types';
import { DEFAULT_ADVICE, evaluateReading, evaluateSymptom, periodOf } from './medical';
import { sha256, uid } from './util';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;

export async function buildSeed() {
  const r = rng(42);
  const gauss = () => (r() + r() + r() + r() - 2) * 1.2;
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const pw = await sha256('demo1234');
  const now = Date.now();
  const iso = (t: number) => new Date(t).toISOString();
  const created = iso(now - 120 * DAY);

  const users: { id: string; email: string; pw: string }[] = [];
  const t: { [K in TableName]: TableMap[K][] } = {
    profiles: [], patients: [], readings: [], symptoms: [], alerts: [], medications: [], intakes: [],
    appointments: [], consultations: [], reminders: [], messages: [], payments: [],
  };

  const staff = (email: string, role: Profile['role'], full_name: string, extra: Partial<Profile> = {}) => {
    const id = uid();
    users.push({ id, email, pw });
    const p: Profile = { id, role, full_name, email, plan: 'gratuit', created_at: created, ...extra };
    t.profiles.push(p);
    return p;
  };
  const doctor = staff('medecin@demo.cm', 'doctor', 'Dr Aïcha Mbarga', {
    specialty: 'Médecine générale', hospital: 'Centre médical de démonstration – Makepe', phone: '+237 6 99 00 00 01', plan: 'medecin_pro',
    plan_renews_at: iso(now + 20 * DAY),
  });
  const cardio = staff('cardio@demo.cm', 'doctor', 'Dr Joseph Kamga', { specialty: 'Cardiologie', hospital: 'Centre médical de démonstration – Makepe', plan: 'medecin_pro' });
  const nurse = staff('infirmier@demo.cm', 'nurse', 'Paul Nkodo', { hospital: 'Centre médical de démonstration – Makepe' });
  staff('chercheur@demo.cm', 'researcher', 'Dr Claire Etoa', { hospital: 'Unité de recherche clinique (démo)' });
  staff('hopital@demo.cm', 'hospital', 'Centre médical de démonstration', { plan: 'hopital', plan_renews_at: iso(now + 200 * DAY) });
  staff('admin@demo.cm', 'admin', 'Administrateur TensioCare');

  interface Spec {
    email?: string; first: string; last: string; sex: Patient['sex']; birth: string; city: string; profession: string;
    sys: number; dia: number; hr: number; noise: number; trend: number; adherence: number;
    medical: string[]; family: string[]; tobacco: 'jamais' | 'ancien' | 'actuel'; ward?: string;
    symptomRate: number; symptomPool: SymptomKey[]; spikeDaysAgo?: number; doctorId: string; diag: string;
    meds: [string, string, string[]][]; plan?: Profile['plan'];
  }
  const specs: Spec[] = [
    {
      email: 'patient@demo.cm', first: 'Marie', last: 'Ngo Bassa', sex: 'F', birth: '1967-04-12', city: 'Douala – Makepe', profession: 'Commerçante',
      sys: 152, dia: 94, hr: 78, noise: 9, trend: -0.25, adherence: 0.85, medical: ['diabete', 'obesite'], family: ['hta', 'avc'], tobacco: 'jamais',
      symptomRate: 0.12, symptomPool: ['cephalee', 'cephalee', 'vertiges', 'troubles_visuels'], doctorId: doctor.id, diag: '2019-03-01',
      meds: [['Amlodipine', '10 mg', ['08:00']], ['Hydrochlorothiazide', '12,5 mg', ['08:00']], ['Metformine', '850 mg', ['08:00', '20:00']]], plan: 'patient_plus',
    },
    {
      email: 'patient2@demo.cm', first: 'Jean-Paul', last: 'Essomba', sex: 'M', birth: '1958-09-30', city: 'Douala – Bonamoussadi', profession: 'Enseignant retraité',
      sys: 164, dia: 101, hr: 84, noise: 12, trend: 0.15, adherence: 0.7, medical: ['ait', 'dyslipidemie'], family: ['avc'], tobacco: 'actuel',
      symptomRate: 0.18, symptomPool: ['cephalee', 'vertiges', 'fourmillements', 'perte_equilibre', 'troubles_visuels'], spikeDaysAgo: 0.3, doctorId: doctor.id, diag: '2012-06-15',
      meds: [['Losartan', '100 mg', ['08:00']], ['Amlodipine', '10 mg', ['20:00']], ['Atorvastatine', '40 mg', ['20:00']], ['Aspirine', '100 mg', ['12:00']]],
    },
    {
      first: 'Aminatou', last: 'Bello', sex: 'F', birth: '1981-01-22', city: 'Douala – Akwa', profession: 'Comptable',
      sys: 128, dia: 82, hr: 72, noise: 6, trend: 0, adherence: 0.97, medical: [], family: ['hta'], tobacco: 'jamais',
      symptomRate: 0.02, symptomPool: ['cephalee'], doctorId: doctor.id, diag: '2022-11-08', meds: [['Périndopril', '5 mg', ['08:00']]],
    },
    {
      first: 'Samuel', last: 'Fotso', sex: 'M', birth: '1973-07-03', city: 'Douala – Logpom', profession: 'Chauffeur',
      sys: 148, dia: 96, hr: 80, noise: 18, trend: 0.05, adherence: 0.55, medical: ['apnee'], family: ['hta', 'diabete'], tobacco: 'ancien',
      symptomRate: 0.1, symptomPool: ['cephalee', 'vertiges', 'confusion'], doctorId: doctor.id, diag: '2020-02-14',
      meds: [['Nifédipine LP', '30 mg', ['08:00']], ['Indapamide', '1,5 mg', ['08:00']]],
    },
    {
      first: 'Grace', last: 'Ewane', sex: 'F', birth: '1986-12-11', city: 'Douala – Kotto', profession: 'Infirmière',
      sys: 142, dia: 91, hr: 76, noise: 7, trend: -0.3, adherence: 0.9, medical: [], family: ['hta'], tobacco: 'jamais',
      symptomRate: 0.05, symptomPool: ['cephalee', 'vertiges'], doctorId: cardio.id, diag: '2026-07-20', meds: [['Amlodipine', '5 mg', ['08:00']]],
    },
    {
      first: 'Ibrahim', last: 'Moussa', sex: 'M', birth: '1953-05-18', city: 'Douala – Deïdo', profession: 'Commerçant retraité',
      sys: 171, dia: 98, hr: 92, noise: 14, trend: -0.1, adherence: 0.8, medical: ['fa', 'irc', 'diabete'], family: [], tobacco: 'ancien',
      ward: 'Médecine interne – Lit 4', symptomRate: 0.15, symptomPool: ['cephalee', 'faiblesse_musculaire', 'confusion', 'vertiges'], doctorId: cardio.id, diag: '2005-01-10',
      meds: [['Bisoprolol', '5 mg', ['08:00']], ['Ramipril', '10 mg', ['08:00']], ['Apixaban', '5 mg', ['08:00', '20:00']], ['Furosémide', '40 mg', ['08:00']]],
    },
  ];

  for (const [idx, s] of specs.entries()) {
    let user_id: string | null = null;
    if (s.email) {
      user_id = uid();
      users.push({ id: user_id, email: s.email, pw });
      t.profiles.push({
        id: user_id, role: 'patient', full_name: `${s.first} ${s.last}`, email: s.email, plan: s.plan ?? 'gratuit',
        plan_renews_at: s.plan ? iso(now + 12 * DAY) : null, created_at: created, phone: '+237 6 77 00 00 0' + idx,
      });
    }
    const pid = uid();
    const patient: Patient = {
      id: pid, user_id, mrn: `TC-${(100231 + idx * 1379).toString(36).toUpperCase()}`, first_name: s.first, last_name: s.last, sex: s.sex,
      birth_date: s.birth, phone: '+237 6 77 00 00 0' + idx, email: s.email, city: s.city, address: s.city, profession: s.profession,
      blood_group: pick(['O+', 'A+', 'B+', 'AB+', 'O-']), weight_kg: Math.round(62 + r() * 30), height_cm: Math.round(155 + r() * 25),
      emergency_name: pick(['Époux·se', 'Fils', 'Fille', 'Frère', 'Sœur']) + ' – ' + pick(['Rose', 'Eric', 'Brice', 'Sandrine', 'Hélène']),
      emergency_phone: '+237 6 55 12 34 0' + idx, primary_doctor_id: s.doctorId, ward: s.ward, created_at: created,
      thresholds: { ...DEFAULT_THRESHOLDS },
      record: {
        history: {
          diagnosis_date: s.diag,
          hta_grade: s.sys >= 160 ? 'Grade 2' : s.sys >= 140 ? 'Grade 1' : 'Grade 1 contrôlé',
          initial_bp: `${s.sys + 18}/${s.dia + 10} mmHg`,
          evolution: s.trend < 0 ? 'Amélioration progressive depuis l’ajustement du traitement.' : 'Contrôle tensionnel insuffisant, plusieurs pics récents.',
          complications: s.medical.includes('ait') ? 'AIT en 2023 (hémiparésie droite transitoire, récupération complète).' : s.medical.includes('irc') ? 'Néphropathie hypertensive.' : 'Aucune complication connue.',
          previous_treatments: 'Monothérapie initiale, puis bithérapie.',
          adherence: s.adherence > 0.85 ? 'Bonne' : s.adherence > 0.65 ? 'Moyenne – oublis le soir' : 'Faible – ruptures de stock et oublis fréquents',
        },
        antecedents: {
          medical: s.medical, family: s.family, tobacco: s.tobacco, alcohol: pick(['non', 'occasionnel', 'regulier']),
          activity: pick(['sedentaire', 'moderee']), salt: pick(['normal', 'eleve']), allergies: idx === 1 ? 'Pénicilline' : 'Aucune connue',
          surgical: idx === 0 ? 'Césarienne (1995)' : '',
        },
        systemic: {
          date: iso(now - 20 * DAY),
          items: Object.fromEntries(['cephalees', 'vertiges', 'acouphenes', 'fatigue', 'nycturie', 'palpitations'].map((k) => [k, r() < 0.4])),
          notes: 'Enquête réalisée lors de la dernière consultation.',
        },
        advice: DEFAULT_ADVICE.slice(0, 5),
        goals: { sys_target: s.medical.includes('diabete') ? 130 : 135, dia_target: s.medical.includes('diabete') ? 80 : 85 },
      },
    };
    t.patients.push(patient);

    // Mesures : 60 jours, matin et soir
    const readings: Reading[] = [];
    for (let d = 60; d >= 0; d--) {
      for (const hour of [7, 19]) {
        if (r() < 0.12 && d > 0) continue;
        const at = now - d * DAY + (hour - new Date(now).getHours()) * 3_600_000 + Math.floor(r() * 40) * 60_000;
        if (at > now) continue;
        const drift = s.trend * (60 - d);
        const evening = hour === 19 ? -3 : 3;
        let sys = Math.round(s.sys + drift + evening + gauss() * s.noise);
        let dia = Math.round(s.dia + drift * 0.5 + evening * 0.5 + gauss() * s.noise * 0.55);
        if (s.spikeDaysAgo !== undefined && Math.abs(d - s.spikeDaysAgo) < 0.6 && hour === 7) {
          sys = 192; dia = 116;
        }
        if (idx === 3 && d % 9 === 4 && hour === 7) sys += 32; // pics irréguliers (mauvaise observance)
        const reading: Reading = {
          id: uid(), patient_id: pid, measured_at: iso(at), systolic: sys, diastolic: Math.min(dia, sys - 22),
          pulse: Math.round(s.hr + gauss() * 6), arm: 'gauche', position: 'assis', context: hour === 7 ? 'Au réveil' : 'Le soir, au repos',
          source: s.ward ? 'soignant' : 'manuel', created_at: iso(at),
        };
        readings.push(reading);
      }
    }
    t.readings.push(...readings);

    // Symptômes
    const symptoms: SymptomEntry[] = [];
    for (const rd of readings) {
      const boost = rd.systolic >= 160 ? 2.5 : 1;
      if (r() < s.symptomRate * boost) {
        const key = pick(s.symptomPool);
        const at = Date.parse(rd.measured_at) + 30 * 60_000;
        const neuro = !['cephalee', 'vertiges'].includes(key);
        symptoms.push({
          id: uid(), patient_id: pid, symptom: key, intensity: Math.min(10, Math.max(1, Math.round((neuro ? 3 : 4) + r() * 4 + (rd.systolic - 140) / 15))),
          started_at: iso(at), duration_min: pick([10, 15, 30, 45, 60, 120]), period: periodOf(new Date(at)),
          sudden: false, side: neuro ? pick(['', 'gauche', 'droit']) : '', created_at: iso(at),
        });
      }
    }
    if (s.spikeDaysAgo !== undefined) {
      const spike = readings.find((x) => x.systolic === 192)!;
      const at = Date.parse(spike.measured_at) + 10 * 60_000;
      symptoms.push({
        id: uid(), patient_id: pid, symptom: 'fourmillements', intensity: 6, started_at: iso(at), duration_min: 20,
        period: periodOf(new Date(at)), sudden: true, side: 'droit', note: 'Fourmillements main droite, résolutifs', created_at: iso(at),
      });
    }
    t.symptoms.push(...symptoms);

    // Alertes générées par le moteur
    const sorted = readings.slice().sort((a, b) => a.measured_at.localeCompare(b.measured_at));
    const alerts: Alert[] = [];
    const lastByType = new Map<string, number>();
    const pushAlerts = (drafts: ReturnType<typeof evaluateReading>, at: string) => {
      for (const a of drafts) {
        const prev = lastByType.get(a.type);
        if (prev && Date.parse(at) - prev < 12 * 3_600_000 && a.level !== 'critical') continue;
        lastByType.set(a.type, Date.parse(at));
        const old = now - Date.parse(at) > 2 * DAY;
        alerts.push({
          ...a, id: uid(), patient_id: pid, created_at: at, status: old ? 'acknowledged' : 'active',
          acknowledged_by: old ? doctor.id : null, acknowledged_name: old ? doctor.full_name : null, acknowledged_at: old ? iso(Date.parse(at) + 3 * 3_600_000) : null,
        });
      }
    };
    sorted.forEach((rd, i) => pushAlerts(evaluateReading(rd, sorted.slice(0, i), patient.thresholds, symptoms), rd.measured_at));
    for (const sy of symptoms) {
      const before = sorted.filter((x) => x.measured_at <= sy.started_at).pop();
      pushAlerts(evaluateSymptom(sy, symptoms, before), sy.started_at);
    }
    // on garde un historique raisonnable
    t.alerts.push(...alerts.filter((a) => a.status === 'active' || a.level !== 'moderate' || r() < 0.3));

    // Traitements
    const meds: Medication[] = s.meds.map(([name, dosage, times]) => ({
      id: uid(), patient_id: pid, name, dosage, form: 'Comprimé', times, start_date: iso(now - 90 * DAY).slice(0, 10), end_date: null,
      instructions: name === 'Metformine' ? 'Pendant le repas' : name === 'Furosémide' ? 'Le matin uniquement' : 'Tous les jours, même heure',
      prescribed_by: s.doctorId, prescribed_name: s.doctorId === doctor.id ? doctor.full_name : cardio.full_name, active: true, created_at: iso(now - 90 * DAY),
    }));
    t.medications.push(...meds);
    const intakes: Intake[] = [];
    for (let d = 14; d >= 1; d--) {
      for (const m of meds) {
        for (const time of m.times) {
          const day = new Date(now - d * DAY);
          const [h, mi] = time.split(':').map(Number);
          day.setHours(h, mi, 0, 0);
          const taken = r() < s.adherence;
          intakes.push({
            id: uid(), patient_id: pid, medication_id: m.id, scheduled_for: day.toISOString(), status: taken ? 'pris' : 'oublie',
            taken_at: iso(day.getTime() + Math.floor(r() * 50) * 60_000), created_at: day.toISOString(),
          });
        }
      }
    }
    t.intakes.push(...intakes);

    // Rendez-vous & consultations
    const docName = s.doctorId === doctor.id ? doctor.full_name : cardio.full_name;
    const appts: Appointment[] = [
      { id: uid(), patient_id: pid, doctor_id: s.doctorId, doctor_name: docName, starts_at: iso(now - 45 * DAY), duration_min: 30, type: 'consultation', location: 'Centre médical – Makepe', status: 'termine', created_at: created },
      { id: uid(), patient_id: pid, doctor_id: s.doctorId, doctor_name: docName, starts_at: iso(now - 15 * DAY), duration_min: 20, type: 'controle', location: 'Centre médical – Makepe', status: 'termine', created_at: created },
      {
        id: uid(), patient_id: pid, doctor_id: s.doctorId, doctor_name: docName,
        starts_at: (() => { const d = new Date(now + (idx === 0 ? 0 : idx + 1) * DAY); d.setHours(9 + idx, idx % 2 ? 30 : 0, 0, 0); if (d.getTime() < now) d.setHours(17, 0); return d.toISOString(); })(),
        duration_min: 30, type: idx === 2 ? 'teleconsultation' : 'consultation', location: idx === 2 ? 'Vidéo' : 'Centre médical – Makepe', status: 'prevu', notes: 'Bilan tensionnel et ajustement du traitement', created_at: iso(now - 10 * DAY),
      },
    ];
    t.appointments.push(...appts);
    const cons: Consultation[] = [
      {
        id: uid(), patient_id: pid, doctor_id: s.doctorId, doctor_name: docName, date: iso(now - 45 * DAY), motif: 'Suivi de l’hypertension artérielle',
        history: 'Céphalées occipitales matinales, observance irrégulière.', exam: 'État général conservé. Auscultation cardiaque normale. Pas de déficit neurologique.',
        bp: `${s.sys + 8}/${s.dia + 4} mmHg`, diagnosis: 'HTA non contrôlée', plan: 'Majoration du traitement, auto-mesure 2×/jour avec TensioCare, contrôle dans 1 mois.', created_at: iso(now - 45 * DAY),
      },
      {
        id: uid(), patient_id: pid, doctor_id: s.doctorId, doctor_name: docName, date: iso(now - 15 * DAY), motif: 'Contrôle',
        history: 'Moins de céphalées. Quelques vertiges en se levant.', exam: 'RAS. Pas de signe de focalisation.',
        bp: `${s.sys}/${s.dia} mmHg`, diagnosis: s.sys >= 150 ? 'HTA partiellement contrôlée' : 'HTA en cours de contrôle',
        plan: 'Poursuite du traitement. Bilan : créatininémie, ionogramme, glycémie, bilan lipidique, ECG.', created_at: iso(now - 15 * DAY),
      },
    ];
    t.consultations.push(...cons);

    const reminders: Reminder[] = [
      { id: uid(), patient_id: pid, kind: 'tension', label: 'Mesurer ma tension (matin)', times: ['07:00'], days: [0, 1, 2, 3, 4, 5, 6], enabled: true, created_at: created },
      { id: uid(), patient_id: pid, kind: 'tension', label: 'Mesurer ma tension (soir)', times: ['19:00'], days: [0, 1, 2, 3, 4, 5, 6], enabled: true, created_at: created },
      { id: uid(), patient_id: pid, kind: 'medicament', label: 'Prendre mes médicaments', times: [...new Set(meds.flatMap((m) => m.times))].sort(), days: [0, 1, 2, 3, 4, 5, 6], enabled: true, created_at: created },
    ];
    t.reminders.push(...reminders);

    if (user_id) {
      const msgs: Message[] = [
        { id: uid(), patient_id: pid, sender_id: user_id, sender_name: `${s.first} ${s.last}`, sender_role: 'patient', body: 'Bonjour docteur, j’ai eu des maux de tête ce matin avec une tension élevée. Dois-je m’inquiéter ?', read: true, created_at: iso(now - 3 * DAY) },
        { id: uid(), patient_id: pid, sender_id: s.doctorId, sender_name: docName, sender_role: 'doctor', body: 'Bonjour. J’ai bien vu vos mesures. Continuez votre traitement, reprenez la tension ce soir au calme. Si les maux de tête deviennent violents ou si vous avez des troubles de la parole ou une faiblesse, appelez le 119.', read: true, created_at: iso(now - 3 * DAY + 2 * 3_600_000) },
        { id: uid(), patient_id: pid, sender_id: user_id, sender_name: `${s.first} ${s.last}`, sender_role: 'patient', body: 'Merci docteur, c’est redescendu à la mesure du soir.', read: false, created_at: iso(now - 2 * DAY) },
      ];
      t.messages.push(...msgs);
      if (s.plan) {
        const pay: Payment = { id: uid(), user_id, plan: s.plan, amount: 1500, currency: 'XAF', method: 'orange_money', status: 'reussi', reference: 'OM-' + Math.floor(r() * 1e8), created_at: iso(now - 18 * DAY) };
        t.payments.push(pay);
      }
    }
  }
  t.payments.push({ id: uid(), user_id: doctor.id, plan: 'medecin_pro', amount: 10000, currency: 'XAF', method: 'mtn_momo', status: 'reussi', reference: 'MOMO-58213377', created_at: iso(now - 10 * DAY) });
  void nurse;
  return { users, tables: t };
}
