-- Apply in Supabase Dashboard → SQL → New query, or: supabase db push (CLI)

create extension if not exists "uuid-ossp";

create table if not exists public.survival_tips (
  id uuid primary key default uuid_generate_v4(),
  exa_doc_id text unique,
  title text not null,
  content text not null,
  category text not null default 'survival',
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists survival_tips_category_idx on public.survival_tips (category);
create index if not exists survival_tips_created_at_idx on public.survival_tips (created_at desc);

alter table public.survival_tips enable row level security;

create policy "survival_tips_select_anon"
  on public.survival_tips
  for select
  to anon
  using (true);

create policy "survival_tips_select_authenticated"
  on public.survival_tips
  for select
  to authenticated
  using (true);
