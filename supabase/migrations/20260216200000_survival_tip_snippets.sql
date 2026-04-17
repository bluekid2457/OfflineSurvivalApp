-- Atomic retrieval units (one row ≈ one embeddable fact). Run after survival_tips or standalone.

create extension if not exists "uuid-ossp";

create table if not exists public.survival_tip_snippets (
  id uuid primary key default uuid_generate_v4(),
  tip_key text not null unique,
  source_exa_doc_id text not null,
  parent_title text not null,
  body text not null,
  category text not null default 'survival',
  source_url text,
  ordinal int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists survival_tip_snippets_source_idx on public.survival_tip_snippets (source_exa_doc_id);
create index if not exists survival_tip_snippets_category_idx on public.survival_tip_snippets (category);

alter table public.survival_tip_snippets enable row level security;

drop policy if exists "survival_tip_snippets_select_anon" on public.survival_tip_snippets;
drop policy if exists "survival_tip_snippets_select_authenticated" on public.survival_tip_snippets;

create policy "survival_tip_snippets_select_anon"
  on public.survival_tip_snippets
  for select
  to anon
  using (true);

create policy "survival_tip_snippets_select_authenticated"
  on public.survival_tip_snippets
  for select
  to authenticated
  using (true);
