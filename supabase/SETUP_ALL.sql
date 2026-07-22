create extension if not exists pgcrypto;
create extension if not exists pg_cron;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'viewer' check (role in ('admin', 'manager', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_number bigint generated always as identity unique,
  submission_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_submitted_at timestamptz not null default now(),
  session_id uuid,
  calculator_step text,
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz,
  status text not null default 'started' check (status in (
    'started',
    'completed',
    'abandoned',
    'contacted',
    'qualified',
    'lost'
  )),
  name text not null,
  phone text not null,
  phone_normalized text not null,
  email text,
  city_or_address text,
  property_type text,
  monthly_bill numeric(12,2),
  preferred_contact_time text,
  message text,
  source_type text not null default 'site-form',
  source_page text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  gclid text,
  fbclid text,
  consent_at timestamptz not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  next_follow_up_at timestamptz,
  duplicate_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz
);

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  report_type text not null default 'roof-check',
  storage_path text,
  original_filename text,
  mime_type text,
  calculation jsonb not null default '{}'::jsonb,
  roof_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_phone_normalized_idx on public.leads(phone_normalized);
create unique index if not exists leads_session_id_unique_idx on public.leads(session_id) where session_id is not null;
create index if not exists leads_status_activity_idx on public.leads(status, last_activity_at) where archived_at is null;
create index if not exists leads_client_ip_created_idx on public.leads((metadata ->> 'clientIpHash'), created_at desc);
create index if not exists leads_assigned_to_idx on public.leads(assigned_to);
create index if not exists leads_next_follow_up_idx on public.leads(next_follow_up_at) where archived_at is null;
create index if not exists lead_events_lead_created_idx on public.lead_events(lead_id, created_at desc);
create index if not exists reports_lead_created_idx on public.reports(lead_id, created_at desc);
create index if not exists tasks_due_idx on public.tasks(due_at) where status = 'open';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.current_crm_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid() and is_active = true
  limit 1;
$$;

create or replace function public.is_crm_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_crm_role() in ('admin', 'manager', 'viewer'), false);
$$;

create or replace function public.is_crm_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_crm_role() in ('admin', 'manager'), false);
$$;

create or replace function public.is_crm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_crm_role() = 'admin', false);
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.reports enable row level security;
alter table public.tasks enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_crm_admin());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
for all to authenticated
using (public.is_crm_admin())
with check (public.is_crm_admin());

drop policy if exists leads_crm_select on public.leads;
create policy leads_crm_select on public.leads
for select to authenticated
using (public.is_crm_user());

drop policy if exists leads_crm_write on public.leads;
create policy leads_crm_write on public.leads
for all to authenticated
using (public.is_crm_manager())
with check (public.is_crm_manager());

drop policy if exists lead_events_crm_select on public.lead_events;
create policy lead_events_crm_select on public.lead_events
for select to authenticated
using (public.is_crm_user());

drop policy if exists lead_events_crm_write on public.lead_events;
create policy lead_events_crm_write on public.lead_events
for all to authenticated
using (public.is_crm_manager())
with check (public.is_crm_manager());

drop policy if exists reports_crm_select on public.reports;
create policy reports_crm_select on public.reports
for select to authenticated
using (public.is_crm_user());

drop policy if exists reports_crm_write on public.reports;
create policy reports_crm_write on public.reports
for all to authenticated
using (public.is_crm_manager())
with check (public.is_crm_manager());

drop policy if exists tasks_crm_select on public.tasks;
create policy tasks_crm_select on public.tasks
for select to authenticated
using (public.is_crm_user());

drop policy if exists tasks_crm_write on public.tasks;
create policy tasks_crm_write on public.tasks
for all to authenticated
using (public.is_crm_manager())
with check (public.is_crm_manager());

insert into storage.buckets (id, name, public)
values ('lead-reports', 'lead-reports', false)
on conflict (id) do update set public = false;

drop policy if exists lead_reports_select on storage.objects;
create policy lead_reports_select on storage.objects
for select to authenticated
using (bucket_id = 'lead-reports' and public.is_crm_user());

drop policy if exists lead_reports_write on storage.objects;
create policy lead_reports_write on storage.objects
for all to authenticated
using (bucket_id = 'lead-reports' and public.is_crm_manager())
with check (bucket_id = 'lead-reports' and public.is_crm_manager());

alter table public.leads
  add column if not exists internal_notes text,
  add column if not exists lost_reason text,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists tags text[] not null default '{}';

create index if not exists leads_tags_idx on public.leads using gin(tags);

comment on table public.leads is 'Primary CRM lead record. Public forms insert only through the submit-lead Edge Function.';
comment on table public.reports is 'Roof Check calculations and references to private report files.';

create or replace function public.abandon_inactive_roof_check_leads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  with abandoned as (
    update public.leads
    set status = 'abandoned', abandoned_at = now()
    where status = 'started'
      and archived_at is null
      and last_activity_at <= now() - interval '24 hours'
    returning id, calculator_step, last_activity_at
  ), inserted_events as (
    insert into public.lead_events (lead_id, event_type, payload)
    select id, 'lead_abandoned', jsonb_build_object(
      'calculatorStep', calculator_step,
      'lastActivityAt', last_activity_at,
      'reason', 'inactive_24_hours'
    )
    from abandoned
    returning 1
  )
  select count(*) into affected_count from inserted_events;
  return affected_count;
end;
$$;

revoke all on function public.abandon_inactive_roof_check_leads() from public;
grant execute on function public.abandon_inactive_roof_check_leads() to service_role;

do $$
declare existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job
  where jobname = 'solatrix-abandon-inactive-roof-check-leads' limit 1;
  if existing_job_id is not null then perform cron.unschedule(existing_job_id); end if;
  perform cron.schedule(
    'solatrix-abandon-inactive-roof-check-leads',
    '*/15 * * * *',
    'select public.abandon_inactive_roof_check_leads();'
  );
end;
$$;
