create table if not exists public.leads (
  id bigint generated always as identity primary key,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  organization text not null default '',
  role text not null default '',
  message text not null default '',
  source text not null default 'imperia',
  persona text not null default 'general',
  session_id text not null default '',
  captured_at timestamptz not null default timezone('utc', now()),
  status text not null default 'new'
);

create table if not exists public.analytics (
  id bigint generated always as identity primary key,
  event_type text not null,
  source text not null,
  persona text not null,
  session_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default timezone('utc', now())
);

create table if not exists public.sessions (
  id bigint generated always as identity primary key,
  session_id text not null,
  summary text not null default '',
  name text not null default '',
  email text not null default '',
  organization text not null default '',
  source text not null default 'imperia',
  persona text not null default 'general',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_session_id_idx on public.leads (session_id);
create index if not exists analytics_session_id_idx on public.analytics (session_id);
create index if not exists sessions_session_id_idx on public.sessions (session_id);
