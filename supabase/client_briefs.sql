create extension if not exists pgcrypto;

create table if not exists public.client_briefs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'submitted',
  client_name text not null,
  brand_name text,
  contact_name text not null,
  contact_email text not null,
  project_name text not null,
  project_type text not null,
  publish_window text,
  payload jsonb not null,
  material_files jsonb not null default '[]'::jsonb,
  share_summary text not null,
  submitted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.client_briefs
  add column if not exists material_files jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit)
values ('brief-materials', 'brief-materials', false, 52428800)
on conflict (id) do nothing;

create or replace function public.set_client_briefs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_client_briefs_updated_at on public.client_briefs;

create trigger set_client_briefs_updated_at
before update on public.client_briefs
for each row
execute function public.set_client_briefs_updated_at();

create index if not exists client_briefs_contact_email_idx
  on public.client_briefs (contact_email);

create index if not exists client_briefs_project_name_idx
  on public.client_briefs (project_name);
