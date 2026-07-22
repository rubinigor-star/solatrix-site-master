create extension if not exists pg_cron;

alter table public.leads
  add column if not exists session_id uuid,
  add column if not exists calculator_step text,
  add column if not exists last_activity_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists abandoned_at timestamptz;

alter table public.leads drop constraint if exists leads_status_check;

update public.leads
set
  status = case
    when status in ('new', 'contact_required') then 'completed'
    when status = 'contacted' then 'contacted'
    when status in ('site_visit_scheduled', 'site_visit_completed', 'proposal_preparing', 'proposal_sent', 'negotiation', 'won') then 'qualified'
    when status in ('lost', 'not_relevant') then 'lost'
    else 'completed'
  end,
  last_activity_at = coalesce(last_activity_at, last_submitted_at, updated_at, created_at),
  completed_at = case
    when status in ('new', 'contact_required') then coalesce(completed_at, last_submitted_at, updated_at, created_at)
    else completed_at
  end;

alter table public.leads alter column status set default 'started';
alter table public.leads
  add constraint leads_status_check check (status in (
    'started',
    'completed',
    'abandoned',
    'contacted',
    'qualified',
    'lost'
  ));

alter table public.leads alter column last_activity_at set default now();
update public.leads set last_activity_at = coalesce(last_activity_at, now()) where last_activity_at is null;
alter table public.leads alter column last_activity_at set not null;

create unique index if not exists leads_session_id_unique_idx
  on public.leads(session_id)
  where session_id is not null;
create index if not exists leads_status_activity_idx
  on public.leads(status, last_activity_at)
  where archived_at is null;
create index if not exists leads_client_ip_created_idx
  on public.leads((metadata ->> 'clientIpHash'), created_at desc);

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
    set
      status = 'abandoned',
      abandoned_at = now()
    where status = 'started'
      and archived_at is null
      and last_activity_at <= now() - interval '24 hours'
    returning id, calculator_step, last_activity_at
  ), inserted_events as (
    insert into public.lead_events (lead_id, event_type, payload)
    select
      id,
      'lead_abandoned',
      jsonb_build_object(
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
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'solatrix-abandon-inactive-roof-check-leads'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'solatrix-abandon-inactive-roof-check-leads',
    '*/15 * * * *',
    'select public.abandon_inactive_roof_check_leads();'
  );
end;
$$;

comment on column public.leads.session_id is 'Stable browser calculator session used for idempotent lifecycle updates.';
comment on column public.leads.calculator_step is 'Current Roof Check calculator step, stored separately from CRM status.';
comment on column public.leads.last_activity_at is 'Last debounced calculator activity used by the 24-hour abandonment job.';
