import { Bell, Check, CreditCard, Download, KeyRound, Moon, Shield, Smartphone, Type } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../components/Layout';
import { Badge, Button, Card, cx, Field, Input, Modal, Segmented, useToast } from '../../components/ui';
import { requestNotificationPermission } from '../../lib/actions';
import { auth, db, IS_DEMO } from '../../lib/db';
import { useTable } from '../../lib/hooks';
import { PAYMENT_METHODS, PLANS, ROLE_PERMISSIONS, PERMISSION_LABELS, type PlanInfo } from '../../lib/permissions';
import { usePrefs } from '../../lib/prefs';
import { useSession } from '../../lib/session';
import { ROLE_LABELS, type Payment } from '../../lib/types';
import { downloadFile, fmtDate, formatXaf } from '../../lib/util';

async function exportMine(userId: string, isPatient: boolean) {
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), profile: await db.get('profiles', userId) };
  if (isPatient) {
    const [patient] = await db.list('patients', { user_id: userId });
    if (patient) {
      out.patient = patient;
      for (const t of ['readings', 'symptoms', 'alerts', 'medications', 'intakes', 'appointments', 'consultations', 'reminders', 'messages'] as const) out[t] = await db.list(t, { patient_id: patient.id });
    }
  }
  out.payments = await db.list('payments', { user_id: userId });
  downloadFile('tensiocare_mes_donnees.json', JSON.stringify(out, null, 2), 'application/json');
}

export function SubscriptionPage() {
  const { profile } = useSession();
  const toast = useToast();
  const { rows: payments } = useTable('payments', profile ? { user_id: profile.id } : null);
  const [checkout, setCheckout] = useState<PlanInfo | null>(null);
  const [method, setMethod] = useState<Payment['method']>('orange_money');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [step, setStep] = useState<'form' | 'pending' | 'done'>('form');
  if (!profile) return null;
  const plans = PLANS.filter((p) => p.audience.includes(profile.role) || (profile.role !== 'patient' && p.key === 'hopital'));
  const current = PLANS.find((p) => p.key === profile.plan) ?? PLANS[0];

  const pay = async () => {
    if (!checkout) return;
    setStep('pending');
    await new Promise((r) => setTimeout(r, 1800)); // simulation de la confirmation opérateur
    await db.insert('payments', {
      user_id: profile.id, plan: checkout.key, amount: checkout.price, currency: 'XAF', method, status: 'reussi',
      reference: (method === 'orange_money' ? 'OM-' : method === 'mtn_momo' ? 'MOMO-' : 'CB-') + Math.floor(Math.random() * 1e8),
    });
    await db.update('profiles', profile.id, { plan: checkout.key, plan_renews_at: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    setStep('done');
    toast('Abonnement activé ✔');
  };

  return (
    <div>
      <PageHeader title="Abonnement et paiement" subtitle={`Type de compte : ${ROLE_LABELS[profile.role]} · Formule actuelle : ${current.name}${profile.plan_renews_at ? ` (renouvellement le ${fmtDate(profile.plan_renews_at)})` : ''}`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <div key={p.key} className={cx('card relative flex flex-col p-5', p.highlight && 'ring-2 ring-brand-500')}>
            {p.highlight && <span className="chip absolute -top-3 left-5 bg-brand-600 text-white">Recommandé</span>}
            <p className="text-lg font-bold">{p.name}</p>
            <p className="mt-1 text-3xl font-extrabold">{p.price === 0 ? 'Gratuit' : formatXaf(p.price)}<span className="text-sm font-medium text-slate-500">{p.price ? ' / mois' : ''}</span></p>
            <ul className="my-4 flex-1 space-y-2 text-sm">
              {p.features.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />{f}</li>)}
            </ul>
            {profile.plan === p.key ? (
              <Badge className="justify-center bg-emerald-100 py-2 text-emerald-800">Formule actuelle</Badge>
            ) : p.price === 0 ? (
              <Button variant="secondary" onClick={() => db.update('profiles', profile.id, { plan: p.key, plan_renews_at: null })}>Revenir à cette formule</Button>
            ) : (
              <Button onClick={() => { setCheckout(p); setStep('form'); }}>Choisir {p.name}</Button>
            )}
          </div>
        ))}
      </div>

      <Card title="Historique des paiements" className="mt-6">
        {payments.length === 0 ? <p className="muted">Aucun paiement.</p> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Date</th><th>Formule</th><th>Moyen</th><th>Référence</th><th className="text-right">Montant</th><th>Statut</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.created_at)}</td>
                    <td>{PLANS.find((x) => x.key === p.plan)?.name}</td>
                    <td>{PAYMENT_METHODS.find((m) => m.key === p.method)?.label}</td>
                    <td className="font-mono text-xs">{p.reference}</td>
                    <td className="text-right tabular-nums">{formatXaf(p.amount)}</td>
                    <td><Badge className="bg-emerald-100 text-emerald-800">Réussi</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="muted mt-3">{IS_DEMO ? 'Mode démo : les paiements sont simulés, aucun montant n’est débité.' : 'Les paiements Mobile Money sont confirmés par l’opérateur (intégration agrégateur à configurer).'}</p>

      {checkout && (
        <Modal open onClose={() => setCheckout(null)} title={`Souscrire à ${checkout.name}`}>
          {step === 'done' ? (
            <div className="space-y-3 text-center">
              <Check className="mx-auto rounded-full bg-emerald-100 p-2 text-emerald-600" size={56} />
              <p className="text-lg font-bold">Paiement confirmé</p>
              <p className="muted">Votre formule {checkout.name} est active pour 30 jours.</p>
              <Button className="w-full" onClick={() => setCheckout(null)}>Terminer</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">Montant : <b>{formatXaf(checkout.price)}</b> / mois</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m.key} onClick={() => setMethod(m.key)} className={cx('rounded-xl border-2 p-3 text-left text-sm', method === m.key ? 'border-brand-600 bg-brand-50 dark:bg-brand-950' : 'border-slate-200 dark:border-slate-700')}>
                    <p className="font-semibold">{m.label}</p>
                    <p className="text-xs text-slate-500">{m.hint}</p>
                  </button>
                ))}
              </div>
              {(method === 'orange_money' || method === 'mtn_momo') && <Field label="Numéro Mobile Money"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6XX XX XX XX" /></Field>}
              {method === 'carte' && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Numéro de carte" className="col-span-2"><Input placeholder="4242 4242 4242 4242" inputMode="numeric" /></Field>
                  <Field label="Expiration"><Input placeholder="MM/AA" /></Field>
                  <Field label="CVC"><Input placeholder="123" inputMode="numeric" /></Field>
                </div>
              )}
              <Button className="w-full" onClick={pay} disabled={step === 'pending'}><CreditCard size={16} /> {step === 'pending' ? 'Validation sur votre téléphone…' : `Payer ${formatXaf(checkout.price)}`}</Button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { profile } = useSession();
  const { prefs, setPrefs } = usePrefs();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [notif, setNotif] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  if (!profile) return null;
  return (
    <div className="space-y-4">
      <PageHeader title="Profil et paramètres" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Mon profil">
          <div className="space-y-3">
            <Field label="Nom complet"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Téléphone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Adresse courriel"><Input value={profile.email} disabled /></Field>
            <p className="text-sm">Rôle : <Badge className="bg-brand-100 text-brand-800">{ROLE_LABELS[profile.role]}</Badge></p>
            <Button onClick={async () => { await db.update('profiles', profile.id, { full_name: name, phone }); toast('Profil enregistré ✔'); }}>Enregistrer</Button>
          </div>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Type size={18} /> Accessibilité et affichage</span>}>
          <div className="space-y-4">
            <div><p className="label">Taille du texte</p><Segmented value={prefs.font} onChange={(font) => setPrefs({ ...prefs, font })} options={[{ value: 'md', label: 'Normale' }, { value: 'lg', label: 'Grande' }, { value: 'xl', label: 'Très grande' }]} /></div>
            <div><p className="label">Contraste</p><Segmented value={prefs.contrast} onChange={(contrast) => setPrefs({ ...prefs, contrast })} options={[{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'Élevé' }]} /></div>
            <div><p className="label flex items-center gap-1"><Moon size={14} /> Thème</p><Segmented value={prefs.theme} onChange={(theme) => setPrefs({ ...prefs, theme })} options={[{ value: 'system', label: 'Automatique' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]} /></div>
          </div>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Bell size={18} /> Notifications</span>}>
          <p className="muted mb-3">Recevez les alertes et rappels même lorsque l’onglet est en arrière-plan.</p>
          <p className="mb-3 text-sm">État : <b>{notif === 'granted' ? 'Autorisées' : notif === 'denied' ? 'Bloquées (à réactiver dans le navigateur)' : notif === 'unsupported' ? 'Non prises en charge sur cet appareil' : 'Non demandées'}</b></p>
          <Button variant="secondary" disabled={notif === 'granted' || notif === 'unsupported'} onClick={async () => setNotif(String(await requestNotificationPermission()) as NotificationPermission)}>Autoriser les notifications</Button>
          <p className="mt-3 flex items-start gap-2 text-xs text-slate-500"><Smartphone size={14} className="mt-0.5 shrink-0" /> Sur iPhone : ouvrez le site dans Safari → Partager → « Sur l’écran d’accueil », puis ouvrez TensioCare depuis l’icône pour autoriser les notifications.</p>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Shield size={18} /> Sécurité et confidentialité</span>}>
          <div className="space-y-3">
            <Field label="Nouveau mot de passe"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} autoComplete="new-password" /></Field>
            <Button variant="secondary" disabled={pw.length < 8} onClick={async () => { try { await auth.changePassword(pw); setPw(''); toast('Mot de passe modifié ✔'); } catch (e) { toast((e as Error).message, 'error'); } }}><KeyRound size={16} /> Changer le mot de passe</Button>
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
              <li>Données chiffrées en transit (HTTPS) et au repos (base PostgreSQL hébergée).</li>
              <li>Accès limité par rôle : un·e patient·e ne voit que son dossier (Row Level Security).</li>
              <li>Les chercheur·euses n’accèdent qu’à des données anonymisées.</li>
            </ul>
            <Button variant="ghost" className="text-xs" onClick={() => exportMine(profile.id, profile.role === 'patient')}><Download size={14} /> Exporter mes données</Button>
          </div>
        </Card>
        <Card title="Mes permissions" className="lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            {ROLE_PERMISSIONS[profile.role].map((p) => <Badge key={p} className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><Check size={12} /> {PERMISSION_LABELS[p]}</Badge>)}
          </div>
        </Card>
      </div>
      <p className="text-center text-xs text-slate-500">TensioCare v1.0 · Outil d’aide au suivi, ne remplace pas un avis médical. Urgence : 119.</p>
    </div>
  );
}
