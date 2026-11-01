-- DAYBACK persistence schema. Apply after creating a Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  input_text text not null,
  canonical_title text not null,
  event_type text,
  event_start_date date,
  event_end_date date,
  location text,
  timezone text,
  key_entities jsonb not null default '[]'::jsonb,
  aliases jsonb not null default '[]'::jsonb,
  context_keywords jsonb not null default '[]'::jsonb,
  resolution_confidence numeric(4,3),
  created_at timestamptz not null default now()
);

create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null default 'planned',
  resolver_mode text,
  query_plan jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  original_url text not null unique,
  platform_content_id text,
  title text,
  author text,
  excerpt text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  content_type text,
  thumbnail_url text,
  embed_url text,
  verification_status text not null default 'unverified',
  provenance jsonb not null default '{}'::jsonb
);

create table if not exists public.event_content (
  event_id uuid not null references public.events(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  phase text not null,
  category text,
  emotion_tags jsonb not null default '[]'::jsonb,
  relevance_score numeric(4,3),
  curator_status text not null default 'pending',
  curator_note text,
  display_order integer,
  primary key (event_id, content_id)
);

create index if not exists idx_events_event_start_date on public.events(event_start_date);
create index if not exists idx_content_items_published_at on public.content_items(published_at);
create index if not exists idx_event_content_phase on public.event_content(event_id, phase, display_order);
