-- Run once in the Supabase SQL editor (Project → SQL Editor).
-- Not wired into any build/migration tool — kept here for documentation.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date_key text not null,          -- "YYYY-MM-DD", matches lib/chatHistory.ts
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  time text not null,              -- display string already formatted client-side
  created_at timestamptz not null default now()
);

create index if not exists messages_user_date_idx
  on public.messages (user_id, date_key, created_at);

alter table public.messages enable row level security;

create policy "select own messages"
  on public.messages for select
  using (auth.uid() = user_id);

create policy "insert own messages"
  on public.messages for insert
  with check (auth.uid() = user_id);

-- Added later: persists symptom-check results (previously intentionally
-- non-persisted) so users can browse past checks at /symptom-check/history.
create table if not exists public.symptom_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body_part text not null,
  symptoms text[] not null,
  duration text not null,
  severity text not null,
  note text not null default '',
  conditions text[] not null default '{}',
  departments text[] not null default '{}',
  summary text not null default '',
  disclaimer text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists symptom_checks_user_created_idx
  on public.symptom_checks (user_id, created_at desc);

alter table public.symptom_checks enable row level security;

create policy "select own symptom checks"
  on public.symptom_checks for select
  using (auth.uid() = user_id);

create policy "insert own symptom checks"
  on public.symptom_checks for insert
  with check (auth.uid() = user_id);
