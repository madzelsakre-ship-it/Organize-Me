-- Organize Me - schema Supabase
-- A executer dans Supabase > SQL Editor > New query.

create extension if not exists pgcrypto;

create table if not exists public.habitude (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom text not null,
  emoji text default '⭐',
  categorie text default 'autre',
  frequence text default 'quotidien',
  jours_cibles integer[] default '{}',
  objectif_minutes integer default 0,
  couleur text default '#F97316',
  completions text[] default '{}',
  archivee boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.programme (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom text not null,
  description text,
  cellules jsonb not null default '[]'::jsonb,
  jours jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.note_calendrier (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titre text not null,
  contenu text,
  date date not null,
  heure_rappel text,
  notifie boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.rappel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titre text not null,
  description text,
  date date,
  heure text,
  termine boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titre text not null,
  description text,
  date date,
  heure text,
  categorie text default 'autre',
  priorite text default 'normale',
  terminee boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tache_enfant (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  suivi_id uuid,
  titre text not null,
  note_parent text,
  heure text,
  statut text not null default 'a_faire',
  important boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.score_discipline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  score integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.stat_jour (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  taches_terminees integer not null default 0,
  minutes_concentration integer not null default 0,
  habitudes_completees integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.suivi_enfant (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  enfant_id uuid references auth.users(id) on delete set null,
  nom_enfant text,
  code_appairage text,
  created_at timestamptz not null default now()
);

create table if not exists public.objectif (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null default 'court_terme',
  titre text not null,
  emoji text default '🎯',
  atteint boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public."user" (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  email text,
  nom text,
  role text not null default 'user',
  objectif_principal text,
  objectif_emoji text,
  mantra text,
  created_at timestamptz not null default now()
);

-- RLS : chaque utilisateur ne peut acceder qu'a ses propres donnees.
alter table public.habitude enable row level security;
alter table public.programme enable row level security;
alter table public.note_calendrier enable row level security;
alter table public.rappel enable row level security;
alter table public.tache enable row level security;
alter table public.tache_enfant enable row level security;
alter table public.score_discipline enable row level security;
alter table public.stat_jour enable row level security;
alter table public.suivi_enfant enable row level security;
alter table public.objectif enable row level security;
alter table public."user" enable row level security;

create policy "own habitude select" on public.habitude for select using (auth.uid() = user_id);
create policy "own habitude insert" on public.habitude for insert with check (auth.uid() = user_id);
create policy "own habitude update" on public.habitude for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own habitude delete" on public.habitude for delete using (auth.uid() = user_id);

create policy "own programme select" on public.programme for select using (auth.uid() = user_id);
create policy "own programme insert" on public.programme for insert with check (auth.uid() = user_id);
create policy "own programme update" on public.programme for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own programme delete" on public.programme for delete using (auth.uid() = user_id);

create policy "own note calendrier select" on public.note_calendrier for select using (auth.uid() = user_id);
create policy "own note calendrier insert" on public.note_calendrier for insert with check (auth.uid() = user_id);
create policy "own note calendrier update" on public.note_calendrier for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own note calendrier delete" on public.note_calendrier for delete using (auth.uid() = user_id);

create policy "own rappel select" on public.rappel for select using (auth.uid() = user_id);
create policy "own rappel insert" on public.rappel for insert with check (auth.uid() = user_id);
create policy "own rappel update" on public.rappel for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rappel delete" on public.rappel for delete using (auth.uid() = user_id);

create policy "own tache select" on public.tache for select using (auth.uid() = user_id);
create policy "own tache insert" on public.tache for insert with check (auth.uid() = user_id);
create policy "own tache update" on public.tache for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tache delete" on public.tache for delete using (auth.uid() = user_id);

create policy "own tache enfant select" on public.tache_enfant for select using (auth.uid() = user_id);
create policy "own tache enfant insert" on public.tache_enfant for insert with check (auth.uid() = user_id);
create policy "own tache enfant update" on public.tache_enfant for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tache enfant delete" on public.tache_enfant for delete using (auth.uid() = user_id);

create policy "own score discipline all" on public.score_discipline for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own stat jour all" on public.stat_jour for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own suivi enfant all" on public.suivi_enfant for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own objectif all" on public.objectif for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own user all" on public."user" for all using (auth.uid() = id) with check (auth.uid() = id);
