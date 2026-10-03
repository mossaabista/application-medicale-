-- =====================================================================
-- TensioCare – schéma PostgreSQL (Supabase) avec Row Level Security
-- À exécuter une seule fois dans Supabase → SQL Editor → New query → Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Paramètres (code d'inscription des soignants) ----------
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
insert into public.app_settings(key, value) values ('staff_code', 'TENSIO-PRO-2026')
  on conflict (key) do nothing;
alter table public.app_settings enable row level security; -- aucune policy : illisible depuis l'app

-- ---------- Profils (1 par compte) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'patient' check (role in ('patient','doctor','nurse','researcher','hospital','admin')),
  full_name text not null default '',
  email text not null default '',
  phone text,
  specialty text,
  hospital text,
  plan text not null default 'gratuit' check (plan in ('gratuit','patient_plus','medecin_pro','hopital')),
  plan_renews_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Dossiers patients ----------
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  mrn text not null unique default ('TC-' || upper(substr(md5(random()::text), 1, 6))),
  first_name text not null default '',
  last_name text not null default '',
  sex text not null default 'F',
  birth_date date not null default '1970-01-01',
  phone text, email text, address text, city text, profession text, blood_group text,
  weight_kg numeric, height_cm numeric,
  emergency_name text, emergency_phone text,
  primary_doctor_id uuid references public.profiles(id) on delete set null,
  ward text,
  record jsonb not null default '{"history":{},"antecedents":{"medical":[],"family":[]},"systemic":{"items":{}},"advice":["Réduire le sel : moins de 5 g par jour (éviter cubes d’assaisonnement, poissons salés, conserves).","Marcher au moins 30 minutes, 5 jours par semaine.","Prendre les médicaments tous les jours à heure fixe, même sans symptômes.","Mesurer la tension au calme, assis, après 5 minutes de repos, 2 fois le matin et 2 fois le soir."],"goals":{"sys_target":135,"dia_target":85}}',
  thresholds jsonb not null default '{"sys_high":140,"dia_high":90,"sys_critical":180,"dia_critical":110,"sys_low":90,"dia_low":60,"pp_high":60,"pp_low":25,"hr_high":110,"hr_low":50,"delta_sys":30,"delta_dia":20}',
  created_at timestamptz not null default now()
);

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  measured_at timestamptz not null default now(),
  systolic int not null check (systolic between 40 and 300),
  diastolic int not null check (diastolic between 20 and 200),
  pulse int not null check (pulse between 20 and 250),
  arm text, position text, context text, note text,
  source text not null default 'manuel',
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists readings_patient_idx on public.readings(patient_id, measured_at desc);

create table if not exists public.symptoms (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  symptom text not null,
  intensity int not null check (intensity between 1 and 10),
  started_at timestamptz not null default now(),
  duration_min int not null default 0,
  period text not null,
  sudden boolean not null default false,
  side text, note text,
  created_at timestamptz not null default now()
);
create index if not exists symptoms_patient_idx on public.symptoms(patient_id, started_at desc);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  level text not null, type text not null, title text not null, message text not null, advice text,
  reading_id uuid, symptom_id uuid,
  status text not null default 'active',
  acknowledged_by uuid, acknowledged_name text, acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists alerts_patient_idx on public.alerts(patient_id, created_at desc);

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null, dosage text not null, form text,
  times text[] not null default '{}',
  start_date date not null default current_date, end_date date,
  instructions text, prescribed_by uuid, prescribed_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.intakes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  scheduled_for timestamptz not null, status text not null, taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.profiles(id) on delete set null, doctor_name text,
  starts_at timestamptz not null, duration_min int not null default 30,
  type text not null default 'consultation', location text,
  status text not null default 'prevu', notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.profiles(id) on delete set null, doctor_name text,
  date timestamptz not null default now(),
  motif text not null, history text, exam text, bp text, diagnosis text, plan text,
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null, label text not null,
  times text[] not null default '{}', days int[] not null default '{0,1,2,3,4,5,6}',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  sender_id uuid not null, sender_name text not null, sender_role text not null,
  body text not null, read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null, amount int not null, currency text not null default 'XAF',
  method text not null, status text not null, reference text not null,
  created_at timestamptz not null default now()
);

-- ---------- Fonctions d'aide (security definer : pas de récursion RLS) ----------
create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_clinical() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('doctor','nurse','hospital','admin') from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_researcher() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'researcher' from public.profiles where id = auth.uid()), false) $$;

create or replace function public.owns_patient(pid uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.patients where id = pid and user_id = auth.uid()) $$;

-- ---------- Création automatique du profil à l'inscription ----------
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text := coalesce(meta->>'role', 'patient');
  code text := (select value from public.app_settings where key = 'staff_code');
  final_role text;
  fname text := coalesce(nullif(meta->>'full_name', ''), split_part(new.email, '@', 1));
  doc uuid;
begin
  final_role := case when wanted = 'patient' then 'patient'
                     when wanted in ('doctor','nurse','researcher','hospital','admin') and meta->>'staff_code' = code then wanted
                     else 'patient' end;
  insert into public.profiles(id, role, full_name, email, phone, specialty, hospital)
  values (new.id, final_role, fname, new.email, nullif(meta->>'phone',''), nullif(meta->>'specialty',''), nullif(meta->>'hospital',''));
  if final_role = 'patient' then
    select id into doc from public.profiles where role = 'doctor' order by created_at limit 1;
    insert into public.patients(user_id, first_name, last_name, sex, birth_date, phone, email, primary_doctor_id)
    values (new.id, split_part(fname, ' ', 1), coalesce(substr(fname, length(split_part(fname, ' ', 1)) + 2), ''),
            coalesce(nullif(meta->>'sex',''), 'F'), coalesce(nullif(meta->>'birth_date','')::date, '1970-01-01'),
            nullif(meta->>'phone',''), new.email, doc);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Empêche un utilisateur de s'attribuer un rôle (seul un admin le peut)
create or replace function public.protect_role() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if new.role is distinct from old.role and coalesce(public.my_role(), '') <> 'admin' then
    raise exception 'Seul un administrateur peut modifier un rôle';
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_role();

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.readings enable row level security;
alter table public.symptoms enable row level security;
alter table public.alerts enable row level security;
alter table public.medications enable row level security;
alter table public.intakes enable row level security;
alter table public.appointments enable row level security;
alter table public.consultations enable row level security;
alter table public.reminders enable row level security;
alter table public.messages enable row level security;
alter table public.payments enable row level security;

-- profils : chacun voit le sien ; les profils soignants sont visibles (choix du médecin) ; les soignants voient tout
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or role <> 'patient' or public.is_clinical());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.my_role() = 'admin');

-- patients
drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients for select to authenticated
  using (user_id = auth.uid() or public.is_clinical() or public.is_researcher());
drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients for insert to authenticated with check (public.is_clinical());
drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients for update to authenticated
  using (user_id = auth.uid() or public.is_clinical());

-- tables liées à un patient : le patient (ses données) + les soignants
do $$
declare t text;
begin
  foreach t in array array['readings','symptoms','alerts','intakes','appointments','reminders','messages'] loop
    execute format('drop policy if exists %1$s_all on public.%1$s', t);
    execute format('create policy %1$s_all on public.%1$s for all to authenticated using (public.owns_patient(patient_id) or public.is_clinical()) with check (public.owns_patient(patient_id) or public.is_clinical())', t);
  end loop;
  -- prescriptions et consultations : lecture seule pour le patient
  foreach t in array array['medications','consultations'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (public.owns_patient(patient_id) or public.is_clinical())', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (public.is_clinical()) with check (public.is_clinical())', t);
  end loop;
  -- chercheurs : lecture des mesures / symptômes / alertes (l'interface les pseudonymise)
  foreach t in array array['readings','symptoms','alerts'] loop
    execute format('drop policy if exists %1$s_research on public.%1$s', t);
    execute format('create policy %1$s_research on public.%1$s for select to authenticated using (public.is_researcher())', t);
  end loop;
end $$;

drop policy if exists payments_own on public.payments;
create policy payments_own on public.payments for all to authenticated
  using (user_id = auth.uid() or public.my_role() = 'admin') with check (user_id = auth.uid());

-- ---------- Temps réel (alertes instantanées pour les médecins) ----------
do $$
declare t text;
begin
  foreach t in array array['alerts','readings','symptoms','messages','appointments','patients','medications','intakes'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%s', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
