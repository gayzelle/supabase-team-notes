create extension if not exists "pgcrypto";
create table if not exists public.profiles (
id uuid primary key references auth.users(id) on delete cascade,
username text unique,
created_at timestamptz default now()
);

create table if not exists public.orgs (
id uuid primary key default gen_random_uuid(),
name text not null,
owner_id uuid not null references auth.users(id) on delete cascade,
created_at timestamptz default now()
);

create table if not exists public.memberships (
org_id uuid not null references public.orgs(id) on delete cascade,
user_id uuid not null references auth.users(id) on delete cascade,
role text not null check (role in ('owner','admin','member')),
created_at timestamptz default now(),
primary key (org_id, user_id)
);

create table if not exists public.notes (
id uuid primary key default gen_random_uuid(),
org_id uuid not null references public.orgs(id) on delete cascade,
author_id uuid not null references auth.users(id) on delete cascade,
title text not null,
content text,
updated_at timestamptz default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
new.updated_at = now();
return new;
end;
$$;

create trigger trg_notes_updated
before update on public.notes
for each row execute function public.set_updated_at();

create table if not exists public.attachments (
id uuid primary key default gen_random_uuid(),
note_id uuid references public.notes(id) on delete cascade,
org_id uuid not null references public.orgs(id) on delete cascade,
path text not null,
created_by uuid not null references auth.users(id) on delete cascade,
created_at timestamptz default now()
);

create index if not exists idx_memberships_user on public.memberships(user_id);
create index if not exists idx_notes_org_updated on public.notes(org_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.orgs enable row level security;
alter table public.memberships enable row level security;
alter table public.notes enable row level security;
alter table public.attachments enable row level security;

create policy "read own profile" on public.profiles
for select using (auth.uid() = id);

create policy "update own profile" on public.profiles
for update using (auth.uid() = id);

create policy "members can read orgs" on public.orgs
for select using (
exists (select 1 from public.memberships m where m.org_id = orgs.id and m.user_id = auth.uid())
);

create policy "user can insert org they own" on public.orgs
for insert with check (owner_id = auth.uid());

create policy "members can read memberships" on public.memberships
for select using (
exists (select 1 from public.memberships m where m.org_id = memberships.org_id and m.user_id = auth.uid())
);

create policy "user can insert own membership" on public.memberships
for insert with check (user_id = auth.uid());

create policy "members read notes" on public.notes
for select using (
exists (select 1 from public.memberships m where m.org_id = notes.org_id and m.user_id = auth.uid())
);

create policy "members insert notes" on public.notes
for insert with check (
exists (select 1 from public.memberships m where m.org_id = notes.org_id and m.user_id = auth.uid())
and author_id = auth.uid()
);

create policy "members update notes" on public.notes
for update using (
exists (select 1 from public.memberships m where m.org_id = notes.org_id and m.user_id = auth.uid())
);

create policy "members delete notes" on public.notes
for delete using (
exists (select 1 from public.memberships m where m.org_id = notes.org_id and m.user_id = auth.uid())
);

create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
as $$
select exists (
select 1
from public.memberships m
where m.org_id = org
and m.user_id = auth.uid()
);
$$;

DO $$
BEGIN
-- Only run if the storage schema is present
IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
-- Create the bucket if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'attachments') THEN
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false);
END IF;
END IF;
END
$$;

create policy "org members can upload to attachments"
on storage.objects for insert to authenticated
with check (
bucket_id = 'attachments'
and public.is_org_member((split_part(name, '/', 2))::uuid)
);

create policy "org members can read attachments"
on storage.objects for select to authenticated
using (
bucket_id = 'attachments'
and public.is_org_member((split_part(name, '/', 2))::uuid)
);

create policy "org members can update attachments"
on storage.objects for update to authenticated
using (
bucket_id = 'attachments'
and public.is_org_member((split_part(name, '/', 2))::uuid)
);

create policy "org members can delete attachments"
on storage.objects for delete to authenticated
using (
bucket_id = 'attachments'
and public.is_org_member((split_part(name, '/', 2))::uuid)
);
