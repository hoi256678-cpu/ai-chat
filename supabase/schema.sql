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

-- Added later: one mood per day per user (calendar mood badge).
create table if not exists public.moods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date_key text not null,          -- "YYYY-MM-DD", matches lib/chatHistory.ts
  mood text not null check (mood in ('happy', 'calm', 'tired', 'sad', 'angry', 'sick')),
  created_at timestamptz not null default now(),
  unique (user_id, date_key)
);

create index if not exists moods_user_date_idx
  on public.moods (user_id, date_key);

alter table public.moods enable row level security;

create policy "select own moods"
  on public.moods for select
  using (auth.uid() = user_id);

create policy "insert own moods"
  on public.moods for insert
  with check (auth.uid() = user_id);

create policy "update own moods"
  on public.moods for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Added later: simple title-only calendar events (schedule), any date,
-- multiple per day. Used to give the AI chat a heads-up context for
-- events happening today/tomorrow (see lib/events.ts buildEventContext).
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date_key text not null,
  title text not null,
  created_at timestamptz not null default now()
);

create index if not exists events_user_date_idx
  on public.events (user_id, date_key, created_at);

alter table public.events enable row level security;

create policy "select own events"
  on public.events for select
  using (auth.uid() = user_id);

create policy "insert own events"
  on public.events for insert
  with check (auth.uid() = user_id);

create policy "delete own events"
  on public.events for delete
  using (auth.uid() = user_id);

-- Added later: optional end date turns a single-day event into a period
-- event (e.g. "입원" spanning several days), rendered as a spanning bar
-- on the calendar instead of a single-day pill (see app/chats/page.tsx).
alter table public.events add column if not exists end_date_key text;

alter table public.events drop constraint if exists events_end_after_start;
alter table public.events add constraint events_end_after_start
  check (end_date_key is null or end_date_key >= date_key);
