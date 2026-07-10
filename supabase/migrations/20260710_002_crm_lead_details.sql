alter table public.leads
  add column if not exists internal_notes text,
  add column if not exists lost_reason text,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists tags text[] not null default '{}';

create index if not exists leads_tags_idx on public.leads using gin(tags);
