import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Patient, Profile, Role, TableMap, TableName } from './types';
import { DEFAULT_THRESHOLDS } from './types';
import { DEFAULT_ADVICE } from './medical';
import { makeMrn, nowIso, sha256, uid } from './util';

/* ------------------------------------------------------------------ */
/* Interface commune                                                    */
/* ------------------------------------------------------------------ */

export interface ListOpts {
  order?: string;
  ascending?: boolean;
  limit?: number;
}

export interface DataStore {
  list<T extends TableName>(table: T, filter?: Partial<TableMap[T]>, opts?: ListOpts): Promise<TableMap[T][]>;
  get<T extends TableName>(table: T, id: string): Promise<TableMap[T] | null>;
  insert<T extends TableName>(table: T, row: Partial<TableMap[T]>): Promise<TableMap[T]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>): Promise<TableMap[T]>;
  remove(table: TableName, id: string): Promise<void>;
  subscribe(tables: TableName[], cb: () => void): () => void;
}

export interface SignUpInput {
  email: string;
  password: string;
  full_name: string;
  role: Role;
  staff_code?: string;
  phone?: string;
  sex?: Patient['sex'];
  birth_date?: string;
  specialty?: string;
  hospital?: string;
}

export interface AuthService {
  currentUserId(): Promise<string | null>;
  signIn(email: string, password: string): Promise<string>;
  signUp(input: SignUpInput): Promise<string>;
  signOut(): Promise<void>;
  changePassword(newPassword: string): Promise<void>;
}

/** Code d'accès exigé pour créer un compte professionnel (modifiable dans la table app_settings en mode en ligne). */
export const DEMO_STAFF_CODE = 'TENSIO-PRO-2026';

const DEFAULT_ORDER: Partial<Record<TableName, string>> = {
  readings: 'measured_at',
  symptoms: 'started_at',
  alerts: 'created_at',
  appointments: 'starts_at',
  consultations: 'date',
  messages: 'created_at',
  intakes: 'scheduled_for',
  payments: 'created_at',
};

export function newPatientRecord(): Patient['record'] {
  return {
    history: {},
    antecedents: { medical: [], family: [] },
    systemic: { items: {} },
    advice: [...DEFAULT_ADVICE.slice(0, 4)],
    goals: { sys_target: 135, dia_target: 85 },
  };
}

/* ------------------------------------------------------------------ */
/* Mode DÉMO : base locale (localStorage) avec synchronisation inter-onglets */
/* ------------------------------------------------------------------ */

const LS_KEY = 'tensiocare_db_v1';
const LS_SESSION = 'tensiocare_session_v1';

interface LocalUser {
  id: string;
  email: string;
  pw: string;
}
interface LocalDb {
  users: LocalUser[];
  tables: { [K in TableName]: TableMap[K][] };
}

const emptyDb = (): LocalDb => ({
  users: [],
  tables: {
    profiles: [], patients: [], readings: [], symptoms: [], alerts: [], medications: [], intakes: [],
    appointments: [], consultations: [], reminders: [], messages: [], payments: [],
  },
});

class LocalStore implements DataStore, AuthService {
  private db: LocalDb;
  private subs = new Set<{ tables: TableName[]; cb: () => void }>();
  ready: Promise<void>;

  constructor() {
    this.db = this.load() ?? emptyDb();
    this.ready = this.db.users.length ? Promise.resolve() : this.seed();
    window.addEventListener('storage', (e) => {
      if (e.key === LS_KEY) {
        this.db = this.load() ?? emptyDb();
        this.subs.forEach((s) => s.cb());
      }
    });
  }

  private load(): LocalDb | null {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as LocalDb) : null;
    } catch {
      return null;
    }
  }
  private save(changed: TableName) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.db));
    } catch (e) {
      console.warn('Stockage local plein ou indisponible', e);
    }
    this.subs.forEach((s) => s.tables.includes(changed) && s.cb());
  }

  async seed() {
    const { buildSeed } = await import('./seed');
    const seed = await buildSeed();
    this.db = seed as LocalDb;
    this.save('profiles');
  }

  async reset() {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_SESSION);
    await this.seed();
  }

  async list<T extends TableName>(table: T, filter: Partial<TableMap[T]> = {}, opts: ListOpts = {}) {
    await this.ready;
    let rows = (this.db.tables[table] as TableMap[T][]).filter((r) =>
      Object.entries(filter).every(([k, v]) => v === undefined || (r as unknown as Record<string, unknown>)[k] === v),
    );
    const order = opts.order ?? DEFAULT_ORDER[table];
    if (order) {
      const asc = opts.ascending ?? false;
      rows = rows.slice().sort((a, b) => {
        const x = String((a as unknown as Record<string, unknown>)[order] ?? '');
        const y = String((b as unknown as Record<string, unknown>)[order] ?? '');
        return asc ? x.localeCompare(y) : y.localeCompare(x);
      });
    }
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return structuredClone(rows);
  }
  async get<T extends TableName>(table: T, id: string) {
    await this.ready;
    const r = (this.db.tables[table] as TableMap[T][]).find((x) => (x as { id: string }).id === id);
    return r ? structuredClone(r) : null;
  }
  async insert<T extends TableName>(table: T, row: Partial<TableMap[T]>) {
    await this.ready;
    const full = { id: uid(), created_at: nowIso(), ...row } as TableMap[T];
    (this.db.tables[table] as TableMap[T][]).push(full);
    this.save(table);
    return structuredClone(full);
  }
  async update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>) {
    await this.ready;
    const rows = this.db.tables[table] as TableMap[T][];
    const i = rows.findIndex((x) => (x as { id: string }).id === id);
    if (i < 0) throw new Error('Enregistrement introuvable');
    rows[i] = { ...rows[i], ...patch };
    this.save(table);
    return structuredClone(rows[i]);
  }
  async remove(table: TableName, id: string) {
    await this.ready;
    const rows = this.db.tables[table] as { id: string }[];
    (this.db.tables[table] as unknown) = rows.filter((x) => x.id !== id);
    this.save(table);
  }
  subscribe(tables: TableName[], cb: () => void) {
    const s = { tables, cb };
    this.subs.add(s);
    return () => void this.subs.delete(s);
  }

  /* --- Auth --- */
  async currentUserId() {
    await this.ready;
    const id = localStorage.getItem(LS_SESSION);
    return id && this.db.users.some((u) => u.id === id) ? id : null;
  }
  async signIn(email: string, password: string) {
    await this.ready;
    const u = this.db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.pw !== (await sha256(password))) throw new Error('Adresse courriel ou mot de passe incorrect.');
    localStorage.setItem(LS_SESSION, u.id);
    return u.id;
  }
  async signUp(input: SignUpInput) {
    await this.ready;
    const email = input.email.trim().toLowerCase();
    if (this.db.users.some((x) => x.email === email)) throw new Error('Un compte existe déjà avec cette adresse.');
    if (input.role !== 'patient' && input.staff_code !== DEMO_STAFF_CODE)
      throw new Error('Code d’accès professionnel invalide.');
    const id = uid();
    this.db.users.push({ id, email, pw: await sha256(input.password) });
    const profile: Profile = {
      id, role: input.role, full_name: input.full_name, email, phone: input.phone, specialty: input.specialty,
      hospital: input.hospital, plan: 'gratuit', created_at: nowIso(),
    };
    this.db.tables.profiles.push(profile);
    if (input.role === 'patient') {
      const [first, ...rest] = input.full_name.trim().split(/\s+/);
      this.db.tables.patients.push({
        id: uid(), user_id: id, mrn: makeMrn(), first_name: first, last_name: rest.join(' '),
        sex: input.sex ?? 'F', birth_date: input.birth_date ?? '1970-01-01', phone: input.phone, email,
        record: newPatientRecord(), thresholds: { ...DEFAULT_THRESHOLDS }, created_at: nowIso(),
        primary_doctor_id: this.db.tables.profiles.find((p) => p.role === 'doctor')?.id ?? null,
      });
    }
    this.save('profiles');
    localStorage.setItem(LS_SESSION, id);
    return id;
  }
  async signOut() {
    localStorage.removeItem(LS_SESSION);
  }
  async changePassword(newPassword: string) {
    const id = await this.currentUserId();
    const u = this.db.users.find((x) => x.id === id);
    if (!u) throw new Error('Non connecté');
    u.pw = await sha256(newPassword);
    this.save('profiles');
  }
}

/* ------------------------------------------------------------------ */
/* Mode EN LIGNE : Supabase (PostgreSQL + Row Level Security + Auth)    */
/* ------------------------------------------------------------------ */

class SupabaseStore implements DataStore, AuthService {
  constructor(private sb: SupabaseClient) {}

  async list<T extends TableName>(table: T, filter: Partial<TableMap[T]> = {}, opts: ListOpts = {}) {
    let q = this.sb.from(table).select('*');
    for (const [k, v] of Object.entries(filter)) if (v !== undefined) q = q.eq(k, v as never);
    const order = opts.order ?? DEFAULT_ORDER[table];
    if (order) q = q.order(order, { ascending: opts.ascending ?? false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as TableMap[T][];
  }
  async get<T extends TableName>(table: T, id: string) {
    const { data, error } = await this.sb.from(table).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as TableMap[T] | null;
  }
  async insert<T extends TableName>(table: T, row: Partial<TableMap[T]>) {
    const { data, error } = await this.sb.from(table).insert({ id: uid(), ...row }).select().single();
    if (error) throw new Error(error.message);
    return data as TableMap[T];
  }
  async update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>) {
    const { data, error } = await this.sb.from(table).update(patch as never).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as TableMap[T];
  }
  async remove(table: TableName, id: string) {
    const { error } = await this.sb.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
  subscribe(tables: TableName[], cb: () => void) {
    const ch = this.sb.channel('rt-' + uid());
    for (const t of tables) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => cb());
    ch.subscribe();
    // Filet de sécurité si le temps réel n'est pas activé sur la table
    const iv = window.setInterval(cb, 30_000);
    return () => {
      window.clearInterval(iv);
      void this.sb.removeChannel(ch);
    };
  }

  async currentUserId() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }
  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Adresse courriel ou mot de passe incorrect.' : error.message);
    return data.user.id;
  }
  async signUp(input: SignUpInput) {
    const { data, error } = await this.sb.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          full_name: input.full_name, role: input.role, staff_code: input.staff_code ?? '', phone: input.phone ?? '',
          sex: input.sex ?? '', birth_date: input.birth_date ?? '', specialty: input.specialty ?? '', hospital: input.hospital ?? '',
        },
      },
    });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Compte créé ! Confirmez votre adresse courriel puis connectez-vous.');
    return data.user!.id;
  }
  async signOut() {
    await this.sb.auth.signOut();
  }
  async changePassword(newPassword: string) {
    const { error } = await this.sb.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  }
}

/* ------------------------------------------------------------------ */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const IS_DEMO = !(url && key);
const local = IS_DEMO ? new LocalStore() : null;
const impl: DataStore & AuthService = local ?? new SupabaseStore(createClient(url!, key!));

export const db: DataStore = impl;
export const auth: AuthService = impl;
export const resetDemo = () => local?.reset();
