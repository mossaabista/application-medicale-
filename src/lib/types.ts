export type Role = 'patient' | 'doctor' | 'nurse' | 'researcher' | 'hospital' | 'admin';

export const ROLE_LABELS: Record<Role, string> = {
  patient: 'Patient·e',
  doctor: 'Médecin',
  nurse: 'Infirmier·ère',
  researcher: 'Chercheur·euse',
  hospital: 'Hôpital / Clinique',
  admin: 'Administrateur',
};

export type Plan = 'gratuit' | 'patient_plus' | 'medecin_pro' | 'hopital';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  phone?: string;
  specialty?: string;
  hospital?: string;
  plan: Plan;
  plan_renews_at?: string | null;
  created_at: string;
}

export interface Thresholds {
  sys_high: number; // seuil systolique « élevé »
  dia_high: number;
  sys_critical: number; // crise hypertensive
  dia_critical: number;
  sys_low: number;
  dia_low: number;
  pp_high: number; // pression pulsée (différentielle) élevée
  pp_low: number;
  hr_high: number;
  hr_low: number;
  delta_sys: number; // variation brutale (mmHg) par rapport à la mesure précédente / moyenne récente
  delta_dia: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  sys_high: 140,
  dia_high: 90,
  sys_critical: 180,
  dia_critical: 110,
  sys_low: 90,
  dia_low: 60,
  pp_high: 60,
  pp_low: 25,
  hr_high: 110,
  hr_low: 50,
  delta_sys: 30,
  delta_dia: 20,
};

export interface DiseaseHistory {
  diagnosis_date?: string;
  hta_grade?: string;
  initial_bp?: string;
  evolution?: string;
  complications?: string;
  previous_treatments?: string;
  adherence?: string;
  notes?: string;
}

export interface Antecedents {
  medical: string[]; // ex. diabete, avc, ait…
  surgical?: string;
  family: string[];
  allergies?: string;
  tobacco?: 'jamais' | 'ancien' | 'actuel';
  alcohol?: 'non' | 'occasionnel' | 'regulier';
  activity?: 'sedentaire' | 'moderee' | 'active';
  salt?: 'faible' | 'normal' | 'eleve';
  gyneco?: string;
  other?: string;
}

export interface SystemicReview {
  date?: string;
  items: Record<string, boolean>;
  notes?: string;
}

export interface MedicalRecord {
  history: DiseaseHistory;
  antecedents: Antecedents;
  systemic: SystemicReview;
  advice: string[]; // conseils hygiéno-diététiques
  goals?: { sys_target: number; dia_target: number };
}

export interface Patient {
  id: string;
  user_id: string | null;
  mrn: string; // identifiant patient
  first_name: string;
  last_name: string;
  sex: 'F' | 'M' | 'Autre';
  birth_date: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  profession?: string;
  blood_group?: string;
  weight_kg?: number;
  height_cm?: number;
  emergency_name?: string;
  emergency_phone?: string;
  primary_doctor_id?: string | null;
  ward?: string; // service / lit (usage hospitalier)
  record: MedicalRecord;
  thresholds: Thresholds;
  created_at: string;
}

export type Arm = 'gauche' | 'droit';
export type Position = 'assis' | 'couché' | 'debout';

export interface Reading {
  id: string;
  patient_id: string;
  measured_at: string;
  systolic: number;
  diastolic: number;
  pulse: number; // fréquence cardiaque (bpm)
  arm?: Arm;
  position?: Position;
  context?: string; // au réveil, après effort, …
  note?: string;
  source: 'manuel' | 'appareil' | 'soignant';
  created_by?: string;
  created_at: string;
}

export type SymptomKey =
  | 'cephalee'
  | 'vertiges'
  | 'troubles_visuels'
  | 'fourmillements'
  | 'faiblesse_musculaire'
  | 'troubles_parole'
  | 'confusion'
  | 'perte_equilibre';

export type DayPeriod = 'matin' | 'apres_midi' | 'soir' | 'nuit';

export interface SymptomEntry {
  id: string;
  patient_id: string;
  symptom: SymptomKey;
  intensity: number; // 1–10
  started_at: string;
  duration_min: number;
  period: DayPeriod;
  sudden: boolean; // apparition brutale
  side?: 'gauche' | 'droit' | 'bilateral' | '';
  note?: string;
  created_at: string;
}

export type AlertLevel = 'info' | 'moderate' | 'high' | 'critical';

export interface Alert {
  id: string;
  patient_id: string;
  level: AlertLevel;
  type: string;
  title: string;
  message: string;
  advice?: string;
  reading_id?: string | null;
  symptom_id?: string | null;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by?: string | null;
  acknowledged_name?: string | null;
  acknowledged_at?: string | null;
  created_at: string;
}

export interface Medication {
  id: string;
  patient_id: string;
  name: string;
  dosage: string;
  form?: string;
  times: string[]; // ["08:00","20:00"]
  start_date: string;
  end_date?: string | null;
  instructions?: string;
  prescribed_by?: string;
  prescribed_name?: string;
  active: boolean;
  created_at: string;
}

export interface Intake {
  id: string;
  patient_id: string;
  medication_id: string;
  scheduled_for: string; // ISO date + heure
  status: 'pris' | 'oublie';
  taken_at: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id?: string | null;
  doctor_name?: string;
  starts_at: string;
  duration_min: number;
  type: 'consultation' | 'teleconsultation' | 'controle' | 'urgence';
  location?: string;
  status: 'prevu' | 'termine' | 'annule';
  notes?: string;
  created_at: string;
}

export interface Consultation {
  id: string;
  patient_id: string;
  doctor_id?: string | null;
  doctor_name?: string;
  date: string;
  motif: string;
  history?: string;
  exam?: string; // examen clinique
  bp?: string;
  diagnosis?: string;
  plan?: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  patient_id: string;
  kind: 'tension' | 'medicament' | 'rdv';
  label: string;
  times: string[];
  days: number[]; // 0 = dimanche … 6 = samedi
  enabled: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  patient_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: Role;
  body: string;
  read: boolean;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  plan: Plan;
  amount: number;
  currency: 'XAF';
  method: 'orange_money' | 'mtn_momo' | 'carte' | 'virement';
  status: 'reussi' | 'echoue' | 'en_attente';
  reference: string;
  created_at: string;
}

export interface TableMap {
  profiles: Profile;
  patients: Patient;
  readings: Reading;
  symptoms: SymptomEntry;
  alerts: Alert;
  medications: Medication;
  intakes: Intake;
  appointments: Appointment;
  consultations: Consultation;
  reminders: Reminder;
  messages: Message;
  payments: Payment;
}
export type TableName = keyof TableMap;
