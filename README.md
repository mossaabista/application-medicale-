# TensioCare – Suivi tensionnel et prévention de l’AVC

Application web mobile (PWA, installable sur iPhone et Android) qui relie **patient·es hypertendu·es** et **soignant·es**
pour réduire les complications neurologiques de l’hypertension artérielle, en particulier l’AVC.

> Projet de cours (génie de la conception). Client : médecin généraliste, Douala (Cameroun).
> TensioCare est un outil d’aide au suivi et **ne remplace pas un avis médical**.

---

## 1. Essayer tout de suite

Application en ligne (Vercel, projet `application-medicale`) : le lien de production est affiché dans le tableau de bord Vercel du projet.

| Espace | Courriel | Mot de passe |
|---|---|---|
| Patient (Marie Ngo Bassa) | `patient@demo.cm` | `demo1234` |
| Patient à risque élevé (Jean-Paul Essomba) | `patient2@demo.cm` | `demo1234` |
| Médecin (Dr Aïcha Mbarga) | `medecin@demo.cm` | `demo1234` |
| Cardiologue | `cardio@demo.cm` | `demo1234` |
| Infirmier | `infirmier@demo.cm` | `demo1234` |
| Chercheuse | `chercheur@demo.cm` | `demo1234` |
| Hôpital / clinique | `hopital@demo.cm` | `demo1234` |
| Administrateur | `admin@demo.cm` | `demo1234` |

Sur la page de connexion, les comptes de démonstration s’affichent en boutons (onglets **Espace patient** / **Espace soignant**).
Code pour créer un compte soignant : **`TENSIO-PRO-2026`**.

**Lancer en local :**

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests du moteur d’alertes
npm run build      # build de production dans dist/
```

---

## 2. Fonctionnalités

### Interface patient
- **Accueil** : dernière mesure, classification (ESH 2023), courbe des 7 jours, **jauge de risque**, médicaments du jour, prochain rendez-vous, alertes.
- **Saisie de la tension** : systolique, diastolique, pouls, date/heure, bras, position, contexte, note. La pression pulsée est calculée et l’analyse est immédiate.
- **Saisie des symptômes** : céphalée, vertiges, troubles visuels, fourmillements, faiblesse musculaire, troubles de la parole, confusion, perte d’équilibre, avec intensité (1–10), durée, période de la journée, apparition brutale et côté atteint.
- **Suivi** : courbes (tension, pouls, pression pulsée) par jour, semaine, mois, 3 mois ou toute la période ; fréquence des symptômes ; carte de chaleur symptôme × moment de la journée ; évolution de l’intensité ; **comparaison tension ↔ symptômes** ; **tableau de surveillance journalier, hebdomadaire ou mensuel** ; historique et export CSV.
- **Alertes** et bouton **Urgence** (signes BE-FAST, appel du 119 – SAMU, numéros d’urgence du Cameroun).
- **Traitement** : prises du jour (pris / oublié), observance sur 14 jours, conseils du médecin, **rappels** de prise de tension et de médicaments.
- **Rendez-vous** (demande de rendez-vous) et historique des consultations.
- **Dossier médical** : identification, motif de consultation, histoire de la maladie, antécédents, enquête systémique. Rapport PDF imprimable.
- **Messagerie** sécurisée avec l’équipe soignante.
- **Abonnement et paiement** : formules Essentiel / Patient+ / Médecin Pro / Hôpital. Paiement Orange Money, MTN MoMo, carte ou virement (simulé).
- **Paramètres** : taille du texte, contraste élevé, thème sombre, notifications, mot de passe, export de mes données (JSON).

### Interface soignant (médecin, infirmier·ère, chercheur·euse, hôpital, administrateur)
- **Tableau de bord** : patient·es classé·es par **niveau de risque**, alertes à traiter, rendez-vous du jour, dernières mesures, taux de contrôle de l’HTA.
- **Liste des patient·es** : recherche, filtres (risque, mes patients, hospitalisés), tri, création d’un dossier pour un patient sans smartphone.
- **Fiche patient** : synthèse, courbes et données, dossier médical modifiable, **thérapie** (prescription, arrêt, conseils), consultations et rendez-vous, alertes avec **seuils personnalisables**, messagerie, saisie d’une mesure par le soignant.
- **Centre d’alertes en temps réel** : son, notification du navigateur, bannière. Le **médecin traitant** est notifié en priorité. Boutons « Prendre en charge » et « Résoudre ».
- **Agenda** hebdomadaire et demandes de rendez-vous des patients.
- **Écran de surveillance au lit** (`/moniteur`) : vue du service ou d’un seul patient, plein écran, écran maintenu allumé. Grands chiffres, courbes critiques, **niveau de risque** et alarme visuelle et sonore. Prévu pour une tablette ou un écran fixé près du lit.
- **Recherche** : statistiques de cohorte **pseudonymisées**, classification des mesures, symptômes, export CSV anonymisé.
- **Administration** : comptes, changement de rôle (admin), **matrice des rôles et permissions**.

### Système d’alerte (`src/lib/medical.ts`)
| Événement | Niveau |
|---|---|
| TA ≥ 180/110 (seuil critique) | Critique – crise hypertensive |
| TA critique + symptôme neurologique < 24 h | Critique – urgence, appeler le 119 |
| TA ≥ 160/100 | Élevé |
| 3 mesures consécutives ≥ 140/90 | Modéré – HTA persistante |
| Variation brutale ≥ 30 mmHg (systolique) ou ≥ 20 mmHg (diastolique) par rapport à la mesure précédente ou à la moyenne sur 7 jours | Élevé |
| Pression pulsée ≥ 60 (élevée) ou < 25 (pincée) | Modéré / élevé |
| Hypotension, pouls > 110 ou < 50 | Élevé / modéré |
| Faiblesse, troubles de la parole, confusion (brutale ou ≥ 5/10) ; troubles visuels, perte d’équilibre ou fourmillements brutaux | **Critique – signe possible d’AVC** |
| Céphalée brutale ≥ 8/10 (« coup de tonnerre ») | Critique |
| Même symptôme ≥ 3 fois en 7 jours | Modéré – symptôme récurrent |

Tous les seuils sont **personnalisables par patient** par le médecin.

Le **score de risque** (0–100) combine la tension moyenne sur 7 jours, la variabilité, la pression pulsée, les symptômes neurologiques, les antécédents (AVC/AIT, fibrillation atriale, diabète, tabac, âge…), l’observance et les alertes critiques. Ce score est **indicatif** : il aide à prioriser les patient·es et n’a pas été validé cliniquement.

### Rôles et permissions
`patient`, `doctor` (médecin), `nurse` (infirmier·ère), `researcher` (chercheur·euse), `hospital` (hôpital), `admin`.
La matrice complète se trouve dans `src/lib/permissions.ts` et s’affiche dans l’application (Administration).

---

## 3. Deux modes de données

| | Mode **DÉMO** (par défaut) | Mode **EN LIGNE** (Supabase) |
|---|---|---|
| Activation | aucune variable d’environnement | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| Données | stockées dans le navigateur, 6 patients fictifs avec 60 jours de mesures | base PostgreSQL partagée et sécurisée |
| Partage patient ↔ médecin | entre onglets du même navigateur | **entre tous les appareils, en temps réel** |
| Usage | présentation, essais individuels | tests en groupe, usage réel |

### Passer en mode en ligne (environ 10 minutes, gratuit)
1. Créer un projet sur <https://supabase.com> (offre gratuite).
2. **SQL Editor → New query** : coller le contenu de [`supabase/schema.sql`](supabase/schema.sql) puis cliquer sur **Run**. Le script crée les tables, la sécurité par ligne (RLS), le trigger d’inscription et le temps réel.
3. *(Facultatif pour les tests)* **Authentication → Providers → Email** : désactiver « Confirm email ». Sans ça, chaque nouveau compte doit d’abord valider son courriel.
4. **Project Settings → API** : copier l’**URL** et la clé **anon public**.
5. Dans Vercel (**Settings → Environment Variables**), ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, puis relancer le déploiement.
6. Créer d’abord un compte **Médecin** (code `TENSIO-PRO-2026`), puis les comptes patients. Chaque nouveau patient est rattaché automatiquement au premier médecin inscrit.
   Pour changer le code soignant : `update app_settings set value = 'NOUVEAU-CODE' where key = 'staff_code';`

Sécurité vérifiée (tests SQL) : un patient ne voit que son propre dossier, ne peut ni prescrire ni changer son rôle. Un mauvais code soignant crée un compte patient. Les soignants voient tous les patients de l’établissement.

---

## 4. Déploiement sur Vercel
1. <https://vercel.com/new> → **Import** du dépôt `application-medicale-` (branche `claude/medical-app-blood-pressure-labh1c`, ou `main` après fusion).
2. Vercel détecte Vite. Commande de build : `npm run build`, dossier de sortie : `dist` (déjà dans `vercel.json`).
3. **Deploy**. On obtient un lien à partager au groupe.

**Sur iPhone** : ouvrir le lien dans Safari → Partager → **Sur l’écran d’accueil**. L’application s’ouvre alors en plein écran avec son icône.
**Sur Android** : Chrome → menu → **Installer l’application**.

### Plus tard : App Store et Play Store
L’application est déjà compatible avec [Capacitor](https://capacitorjs.com) : routage par hash, chemins relatifs, PWA.
```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init TensioCare cm.tensiocare.app --web-dir dist
npm run build && npx cap add ios && npx cap open ios   # nécessite un Mac avec Xcode
```
Prochaines étapes possibles : notifications push natives (Capacitor Push + fonction serveur), connexion **Bluetooth** à un tensiomètre (`@capacitor-community/bluetooth-le`, profil GATT *Blood Pressure 0x1810*), Face ID.

---

## 5. Architecture
```
src/
  lib/
    types.ts          modèle de données (patients, mesures, symptômes, alertes, traitements…)
    medical.ts        classification ESH, moteur d’alertes, score de risque, référentiels
    db.ts             couche d’accès : mode démo (localStorage) ou Supabase, authentification
    seed.ts           données de démonstration (fictives)
    permissions.ts    rôles, permissions, formules d’abonnement
    actions.ts        enregistrement mesure/symptôme → alertes → notifications
  components/         UI (boutons, modales…), graphiques Recharts, formulaires médicaux, mise en page
  pages/
    Login.tsx         connexion / inscription (onglets patient / soignant)
    patient/          interface patient
    doctor/           interface soignant, écran de surveillance, recherche, admin
    shared/           vues réutilisées : suivi, dossier, thérapie, rendez-vous, messages, abonnement, rapport
supabase/schema.sql   base de données + Row Level Security
```
Pile technique : React 18, TypeScript, Vite, Tailwind CSS, Recharts, Supabase (PostgreSQL + Auth + Realtime).
L’interface est **en français**. Accessibilité : grandes zones tactiles, tailles de texte réglables, contraste élevé, thème sombre, libellés ARIA. La palette des graphiques a été vérifiée pour le daltonisme.

## 6. Limites connues
- Les paiements sont **simulés**. Il faudra un agrégateur (CinetPay, Campay, NotchPay…) pour encaisser réellement via Orange Money ou MTN MoMo.
- Les rappels et alertes s’affichent quand l’application est ouverte ou installée. Pour des notifications push quand l’application est fermée, il faut un service serveur (Supabase Edge Function + Web Push / APNs).
- En mode démo, chaque navigateur a ses propres données. Pour que tout le groupe partage les mêmes données, utilisez le mode en ligne.
- Le score de risque et les seuils s’appuient sur les recommandations ESH 2023 et AHA, mais doivent être **validés par le médecin client**.
