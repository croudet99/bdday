-- ============================================================
--  BIRTHDAY GLOBE — Supabase schema (run once in SQL Editor)
-- ============================================================
create extension if not exists pgcrypto;

-- PROFILES: identity + the user's OWN birthday
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  country text,
  country_code text,
  x_handle text,
  instagram_handle text,
  birth_month int check (birth_month between 1 and 12),
  birth_day int check (birth_day between 1 and 31),
  birth_year int,
  birth_year_public boolean not null default false,
  is_public boolean not null default true,
  reminders_enabled boolean not null default true,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PERSONAL BIRTHDAYS: birthdays a user adds for OTHER people (always private)
create table if not exists public.personal_birthdays (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  person_name text not null,
  birth_month int not null check (birth_month between 1 and 12),
  birth_day int not null check (birth_day between 1 and 31),
  birth_year int,
  relationship text,
  notes text,
  created_at timestamptz not null default now()
);

-- FOLLOWS: subscribe to a public user's birthday
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

-- NOTIFICATIONS: in-app
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- EMAIL LOG: dedupe reminders (service-role only)
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  sent_at timestamptz not null default now()
);

create index if not exists profiles_public_bday_idx on public.profiles(is_public, birth_month, birth_day);
create index if not exists personal_owner_idx on public.personal_birthdays(owner_id);
create index if not exists follows_followed_idx on public.follows(followed_id);
create index if not exists notif_recipient_idx on public.notifications(recipient_id, created_at desc);

-- Auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ---------------- Row Level Security ----------------
alter table public.profiles enable row level security;
alter table public.personal_birthdays enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.email_log enable row level security;  -- no policies => only service_role can touch it

-- PROFILES
drop policy if exists "read public or own profile" on public.profiles;
create policy "read public or own profile" on public.profiles
  for select to anon, authenticated
  using (is_public = true or (select auth.uid()) = id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- PERSONAL BIRTHDAYS (owner only, always private)
drop policy if exists "own personal birthdays" on public.personal_birthdays;
create policy "own personal birthdays" on public.personal_birthdays
  for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- FOLLOWS
drop policy if exists "read own follows" on public.follows;
create policy "read own follows" on public.follows
  for select to authenticated using (follower_id = (select auth.uid()) or followed_id = (select auth.uid()));
drop policy if exists "create own follows" on public.follows;
create policy "create own follows" on public.follows
  for insert to authenticated with check (follower_id = (select auth.uid()));
drop policy if exists "delete own follows" on public.follows;
create policy "delete own follows" on public.follows
  for delete to authenticated using (follower_id = (select auth.uid()));

-- NOTIFICATIONS (recipient reads/updates; inserts happen via service role backend)
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));
drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications
  for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
