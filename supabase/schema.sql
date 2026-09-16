-- =========================================================
-- COACHPRO - Schema base (Módulo: Base do sistema + Clube + Elenco)
-- Desenvolvido por AB Labs
-- Rode este script no SQL Editor do seu projeto Supabase
-- =========================================================

-- Extensão usada para gerar UUIDs
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- PERFIS DE USUÁRIO
-- Cada usuário do Supabase Auth tem um perfil com papel (role)
-- e, se não for admin, uma data de expiração de acesso (1 ano),
-- renovável apenas pelo administrador.
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  club_id uuid, -- setado depois que a tabela clubs existir (ver alter abaixo)
  full_name text not null,
  role text not null default 'coach' check (role in ('admin', 'coach', 'assistant', 'staff')),
  access_granted_at timestamptz not null default now(),
  access_expires_at timestamptz, -- null para admin (nunca expira)
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- CLUBES
-- ---------------------------------------------------------
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  crest_url text, -- url do escudo do clube
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_club_fk foreign key (club_id) references public.clubs (id) on delete set null;

-- ---------------------------------------------------------
-- TIMES / QUADROS (um clube pode ter vários escalões/temporadas)
-- modality: 'futebol' ou 'futsal' -> exigido pelo requisito de adaptação
-- ---------------------------------------------------------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  category text not null,        -- ex: "Sub 10"
  modality text not null check (modality in ('futebol', 'futsal')),
  season int not null,           -- ex: 2026
  match_duration text,           -- ex: "30' + 30'"
  player_count_format text,      -- ex: "Futebol 9", "Futsal"
  created_at timestamptz not null default now(),
  unique (club_id, category, season, modality)
);

-- Competições e objetivos por time
create table if not exists public.team_competitions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  competition_name text not null,
  objective text, -- ex: "Final", "Semi final"
  sort_order int default 0
);

-- Responsáveis do clube (presidente, coordenador técnico etc.) por time
create table if not exists public.club_staff (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  role_title text not null,   -- "Presidente", "Coord. Técnico", "Equipe Técnica"
  full_name text not null,
  phone text,
  email text,
  sort_order int default 0
);

-- ---------------------------------------------------------
-- ELENCO (atletas)
-- ---------------------------------------------------------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  jersey_number int,
  full_name text not null,
  nickname text,
  birth_date date,
  nationality text default 'Brasileira',
  position text,          -- posição principal
  other_positions text,   -- posições secundárias
  phone text,
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists players_team_id_idx on public.players (team_id);

-- =========================================================
-- ROW LEVEL SECURITY
-- Regra: usuário só enxerga dados do próprio clube (club_id do perfil).
-- Escrita liberada para admin e coach; leitura para qualquer papel do clube.
-- A validade de 1 ano é verificada na aplicação (AuthContext) e também
-- pode ser reforçada aqui bloqueando updates/inserts se access_expires_at venceu.
-- =========================================================

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.teams enable row level security;
alter table public.team_competitions enable row level security;
alter table public.club_staff enable row level security;
alter table public.players enable row level security;

-- função auxiliar: club_id do usuário logado
create or replace function public.current_club_id()
returns uuid
language sql
stable
security definer
as $$
  select club_id from public.profiles where id = auth.uid();
$$;

-- função auxiliar: usuário logado é admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- função auxiliar: acesso do usuário logado está válido?
create or replace function public.access_is_valid()
returns boolean
language sql
stable
security definer
as $$
  select coalesce(
    (select role = 'admin' or access_expires_at is null or access_expires_at > now()
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- PROFILES: usuário vê o próprio perfil e perfis do mesmo clube se for admin
create policy "profiles_select_own_or_admin_same_club"
  on public.profiles for select
  using (id = auth.uid() or (public.is_admin() and club_id = public.current_club_id()));

create policy "profiles_update_own_limited"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_manage_same_club"
  on public.profiles for all
  using (public.is_admin() and club_id = public.current_club_id())
  with check (public.is_admin() and club_id = public.current_club_id());

-- CLUBS: qualquer membro autenticado do clube pode ler; só admin edita
create policy "clubs_select_members"
  on public.clubs for select
  using (id = public.current_club_id());

create policy "clubs_admin_write"
  on public.clubs for all
  using (public.is_admin() and id = public.current_club_id())
  with check (public.is_admin() and id = public.current_club_id());

-- TEAMS
create policy "teams_select_members"
  on public.teams for select
  using (club_id = public.current_club_id() and public.access_is_valid());

create policy "teams_write_admin_coach"
  on public.teams for all
  using (club_id = public.current_club_id() and public.access_is_valid()
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach')))
  with check (club_id = public.current_club_id());

-- TEAM_COMPETITIONS
create policy "team_competitions_select"
  on public.team_competitions for select
  using (exists (select 1 from public.teams t where t.id = team_id and t.club_id = public.current_club_id())
         and public.access_is_valid());

create policy "team_competitions_write"
  on public.team_competitions for all
  using (exists (select 1 from public.teams t where t.id = team_id and t.club_id = public.current_club_id())
         and public.access_is_valid()
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach')));

-- CLUB_STAFF
create policy "club_staff_select"
  on public.club_staff for select
  using (exists (select 1 from public.teams t where t.id = team_id and t.club_id = public.current_club_id())
         and public.access_is_valid());

create policy "club_staff_write"
  on public.club_staff for all
  using (exists (select 1 from public.teams t where t.id = team_id and t.club_id = public.current_club_id())
         and public.access_is_valid()
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach')));

-- PLAYERS
create policy "players_select"
  on public.players for select
  using (exists (select 1 from public.teams t where t.id = team_id and t.club_id = public.current_club_id())
         and public.access_is_valid());

create policy "players_write"
  on public.players for all
  using (exists (select 1 from public.teams t where t.id = team_id and t.club_id = public.current_club_id())
         and public.access_is_valid()
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach')));

-- =========================================================
-- Trigger: ao criar um usuário no Supabase Auth, cria o perfil
-- automaticamente com acesso válido por 1 ano (exceto se marcado admin
-- manualmente depois). Ajuste o club_id via app ou manualmente no início.
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, role, access_expires_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'coach',
    now() + interval '1 year'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- MÓDULO: BANCO DE EXERCÍCIOS, MONTAGEM DE TREINOS
-- E QUADRO SEMANAL
-- =========================================================

-- Pastas do banco de exercícios (ex: "Aquecimento", "Finalização", "Tático")
create table if not exists public.exercise_folders (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists exercise_folders_club_idx on public.exercise_folders (club_id);

-- Banco de atividades/exercícios
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  folder_id uuid references public.exercise_folders (id) on delete set null,
  name text not null,
  objective text,
  description text,
  materials text,
  duration_minutes int,
  modality text not null default 'ambos' check (modality in ('futebol', 'futsal', 'ambos')),
  diagram_url text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists exercises_club_idx on public.exercises (club_id);
create index if not exists exercises_folder_idx on public.exercises (folder_id);

-- Sessões de treino montadas (uma lista ordenada de exercícios para um dia)
create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text,
  objective text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists training_sessions_team_idx on public.training_sessions (team_id);

create table if not exists public.training_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  sort_order int not null default 0,
  duration_minutes int,
  notes text
);

create index if not exists tse_session_idx on public.training_session_exercises (session_id);

-- Quadro semanal: um slot fixo por dia da semana (0=domingo ... 6=sábado),
-- que pode ou não ter um treino montado vinculado
create table if not exists public.weekly_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  location text,
  training_session_id uuid references public.training_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists wss_team_idx on public.weekly_schedule_slots (team_id);

alter table public.exercise_folders enable row level security;
alter table public.exercises enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_session_exercises enable row level security;
alter table public.weekly_schedule_slots enable row level security;

-- EXERCISE_FOLDERS
create policy "exercise_folders_select"
  on public.exercise_folders for select
  using (club_id = public.current_club_id() and public.access_is_valid());

create policy "exercise_folders_write"
  on public.exercise_folders for all
  using (club_id = public.current_club_id() and public.access_is_valid()
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'coach')))
  with check (club_id = public.current_club_id());

-- EXERCISES
create policy "exercises_select"
  on public.exercises for select
  using (club_id = public.current_club_id() and public.access_is_valid());

create policy "exercises_write"
  on public.exercises for all
  using (club_id = public.current_club_id() and public.access_is_valid()
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'coach')))
  with check (club_id = public.current_club_id());

-- TRAINING_SESSIONS
create policy "training_sessions_select"
  on public.training_sessions for select
  using (exists (select 1 from public.teams t where t.id = team_id and t.club_id = public.current_club_id())
         and public.access_is_valid());

create policy "training_sessions_write"
  on public.training_sessions for all
  using (exists (select 1 from public.teams t where t.id = team_id and t.club_id = public.current_club_id())
         and public.access_is_valid()
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'coach')));

-- TRAINING_SESSION_EXERCISES
create policy "tse_select"
  on public.training_session_exercises for select
  using (exists (
    select 1 from public.training_sessions s
    join public.teams t on t.id = s.team_id
    where s.id = session_id and t.club_id = public.current_club_id()
  ) and public.access_is_valid());

create policy "tse_write"
  on public.training_session_exercises for all
  using (exists (
    select 1 from public.training_sessions s
    join public.teams t on t.id = s.team_id
    where s.id = session_id and t.club_id = public.current_club_id()
  ) and public.access_is_valid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'coach')));

-- WEEKLY_SCHEDULE_SLOTS
create policy "wss_select"
  on public.weekly_schedule_slots for select
  using (exists (select 1 from public.teams t where t.id = team_id and t.club_id = public.current_club_id())
         and public.access_is_valid());

create policy "wss_write"
  on public.weekly_schedule_slots for all
  using (exists (select 1 from public.teams t where t.id = team_id and t.club_id = public.current_club_id())
         and public.access_is_valid()
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'coach')));
