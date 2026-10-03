import type { Plan, Role } from './types';

export type Permission =
  | 'view_own_data'
  | 'record_own_data'
  | 'view_patients'
  | 'record_patient_data'
  | 'edit_medical_record'
  | 'prescribe'
  | 'manage_appointments'
  | 'acknowledge_alerts'
  | 'edit_thresholds'
  | 'message_patients'
  | 'bedside_monitor'
  | 'research_anonymized'
  | 'export_data'
  | 'manage_staff'
  | 'manage_users'
  | 'manage_billing';

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_own_data: 'Consulter ses propres données',
  record_own_data: 'Saisir ses mesures et symptômes',
  view_patients: 'Consulter les dossiers patients',
  record_patient_data: 'Saisir des mesures pour un patient',
  edit_medical_record: 'Modifier le dossier médical',
  prescribe: 'Prescrire un traitement',
  manage_appointments: 'Gérer les rendez-vous',
  acknowledge_alerts: 'Prendre en charge les alertes',
  edit_thresholds: 'Personnaliser les seuils d’alerte',
  message_patients: 'Messagerie avec les patients',
  bedside_monitor: 'Écran de surveillance au lit',
  research_anonymized: 'Statistiques anonymisées (recherche)',
  export_data: 'Exporter les données',
  manage_staff: 'Gérer le personnel de l’établissement',
  manage_users: 'Gérer tous les comptes et rôles',
  manage_billing: 'Gérer abonnements et facturation',
};

const P = (...p: Permission[]) => p;
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  patient: P('view_own_data', 'record_own_data', 'manage_billing'),
  doctor: P('view_patients', 'record_patient_data', 'edit_medical_record', 'prescribe', 'manage_appointments', 'acknowledge_alerts', 'edit_thresholds', 'message_patients', 'bedside_monitor', 'export_data', 'manage_billing'),
  nurse: P('view_patients', 'record_patient_data', 'manage_appointments', 'acknowledge_alerts', 'message_patients', 'bedside_monitor'),
  researcher: P('research_anonymized', 'export_data'),
  hospital: P('view_patients', 'bedside_monitor', 'research_anonymized', 'export_data', 'manage_staff', 'manage_billing'),
  admin: Object.keys(PERMISSION_LABELS) as Permission[],
};

export const can = (role: Role | undefined, p: Permission) => !!role && ROLE_PERMISSIONS[role].includes(p);
export const isStaff = (role?: Role) => !!role && role !== 'patient';

export interface PlanInfo {
  key: Plan;
  name: string;
  price: number; // FCFA / mois
  audience: Role[];
  features: string[];
  highlight?: boolean;
}

export const PLANS: PlanInfo[] = [
  {
    key: 'gratuit', name: 'Essentiel', price: 0, audience: ['patient'],
    features: ['Saisie illimitée de la tension et des symptômes', 'Alertes de sécurité et conseils d’urgence', 'Courbes sur 30 jours', 'Rappels de mesure et de médicaments'],
  },
  {
    key: 'patient_plus', name: 'Patient+', price: 1500, audience: ['patient'], highlight: true,
    features: ['Tout Essentiel', 'Historique illimité et rapports PDF', 'Partage en temps réel avec votre médecin', 'Messagerie sécurisée avec le médecin', 'Téléconsultation (selon disponibilité)'],
  },
  {
    key: 'medecin_pro', name: 'Médecin Pro', price: 10000, audience: ['doctor', 'nurse'], highlight: true,
    features: ['Jusqu’à 300 patients suivis', 'Tableau de bord des risques et alertes temps réel', 'Dossier médical complet et prescriptions', 'Écran de surveillance au lit', 'Export des données'],
  },
  {
    key: 'hopital', name: 'Hôpital', price: 75000, audience: ['hospital', 'admin'],
    features: ['Comptes illimités (médecins, infirmier·ères, chercheur·euses)', 'Écrans de surveillance de service', 'Statistiques de cohorte anonymisées', 'Gestion des rôles et permissions', 'Support prioritaire'],
  },
];

export const PAYMENT_METHODS = [
  { key: 'orange_money', label: 'Orange Money', hint: 'Paiement par code USSD #150#' },
  { key: 'mtn_momo', label: 'MTN Mobile Money', hint: 'Paiement par code USSD *126#' },
  { key: 'carte', label: 'Carte bancaire', hint: 'Visa / Mastercard' },
  { key: 'virement', label: 'Virement (établissements)', hint: 'Facture mensuelle' },
] as const;
