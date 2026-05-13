-- ============================================================
--  Call Center Hub — Supabase Setup
--  Run this in your Supabase project → SQL Editor
-- ============================================================

-- Tickets table
create table if not exists public.cch_tickets (
  id                 text primary key,
  title              text not null,
  description        text,
  category           text,
  priority           text default 'normal',
  status             text default 'open',
  assigned_team_id   text,
  assigned_person_id text,
  created_by_team_id text,
  created_by         text,
  created_by_name    text,
  due_date           date,
  reminder_at        timestamptz,
  reminder_sent      boolean default false,
  closed_at          timestamptz,
  created_at         timestamptz default now(),
  comments           jsonb default '[]'::jsonb,
  history            jsonb default '[]'::jsonb
);

-- Activity feed table
create table if not exists public.cch_activity (
  id   bigserial primary key,
  msg  text,
  who  text,
  time timestamptz default now()
);

-- Enable RLS (Row Level Security)
alter table public.cch_tickets  enable row level security;
alter table public.cch_activity enable row level security;

-- Allow full access via anon key (tighten these later with proper auth)
create policy "anon full access" on public.cch_tickets
  for all using (true) with check (true);

create policy "anon full access" on public.cch_activity
  for all using (true) with check (true);

-- Enable Realtime for live updates across users
alter publication supabase_realtime add table public.cch_tickets;

-- ============================================================
--  After running this SQL:
--  1. Go to your Supabase project → Settings → API
--  2. Copy "Project URL" and "anon public" key
--  3. Paste them into app.html at the top of the <script>:
--       const SUPABASE_URL      = 'https://xxxx.supabase.co'
--       const SUPABASE_ANON_KEY = 'eyJhbGci...'
--  4. Refresh app.html — the dot in the header turns green
-- ============================================================
