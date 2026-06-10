create extension if not exists pgcrypto;

create table if not exists app_installations (
  id uuid primary key default gen_random_uuid(),
  ghl_company_id text,
  ghl_location_id text not null,
  ghl_user_type text default 'Location',
  display_name text,
  is_sandbox boolean default true,
  installed_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (ghl_location_id)
);

create table if not exists llm_parameter_versions (
  id text primary key,
  installation_id uuid references app_installations(id) on delete cascade,
  name text not null,
  version_label text not null default 'v1',
  description text default '',
  source_version_id text,
  is_default boolean default false,
  is_locked boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (installation_id, name, version_label)
);

create table if not exists llm_parameters (
  id text primary key,
  version_id text not null references llm_parameter_versions(id) on delete cascade,
  parameter_key text not null,
  title text not null,
  description_for_llm text not null,
  category text default 'custom',
  success_signal_hints text[] default '{}',
  failure_signal_hints text[] default '{}',
  recommendation_when_missed text default '',
  prompt_or_script_guidance text default '',
  requires_human_review boolean default false,
  use_action_type text default '',
  is_enabled boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (version_id, parameter_key)
);

create table if not exists agent_observability_profiles (
  id text primary key,
  installation_id uuid not null references app_installations(id) on delete cascade,
  ghl_agent_id text not null,
  agent_name_snapshot text,
  parameter_version_id text,
  profile_label text default '',
  configured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (installation_id, ghl_agent_id)
);

create table if not exists webhook_events (
  id text primary key default gen_random_uuid()::text,
  installation_id uuid references app_installations(id) on delete cascade,
  event_type text not null,
  ghl_location_id text,
  ghl_agent_id text,
  ghl_call_id text,
  payload jsonb default '{}'::jsonb,
  received_at timestamptz default now()
);

create table if not exists call_analysis_jobs (
  id text primary key,
  installation_id uuid references app_installations(id) on delete cascade,
  webhook_event_id text references webhook_events(id) on delete set null,
  ghl_location_id text,
  ghl_agent_id text,
  ghl_call_id text not null,
  event_type text default '',
  queued_reason text default 'webhook',
  status text not null default 'queued'
    check (status in ('queued', 'running', 'retrying', 'succeeded', 'failed', 'skipped')),
  stage text default 'analysis_pending',
  attempts integer default 0,
  max_attempts integer default 5,
  next_retry_at timestamptz,
  error_message text default '',
  queued_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists call_analyses (
  id text primary key,
  installation_id uuid not null references app_installations(id) on delete cascade,
  job_key text default '',
  parameter_version_id text,
  ghl_location_id text,
  ghl_agent_id text not null,
  agent_name_snapshot text,
  ghl_call_id text not null,
  call_created_at timestamptz,
  duration_seconds integer,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'retrying', 'succeeded', 'failed', 'skipped')),
  stage text default 'analysis_pending',
  score integer check (score is null or (score >= 0 and score <= 100)),
  outcome text default 'pending'
    check (outcome in ('passed', 'failed', 'pending')),
  summary text default '',
  model text default '',
  error_message text default '',
  analyzed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (installation_id, ghl_call_id)
);

create table if not exists call_parameter_results (
  id text primary key,
  analysis_id text not null references call_analyses(id) on delete cascade,
  parameter_key text not null,
  title text not null,
  status text not null
    check (status in ('passed', 'failed', 'not_applicable', 'unknown')),
  confidence text default 'medium'
    check (confidence in ('high', 'medium', 'low')),
  evidence text default '',
  reasoning_summary text default '',
  created_at timestamptz default now()
);

create table if not exists agent_system_improvements (
  id text primary key,
  installation_id uuid not null references app_installations(id) on delete cascade,
  ghl_agent_id text not null,
  agent_name_snapshot text default '',
  parameter_key text default '',
  title text not null,
  improvement_type text not null
    check (improvement_type in ('prompt_update', 'agent_profile_update', 'script_training', 'parameter_update', 'parameter_create', 'parameter_version_change')),
  reason text default '',
  suggestion text default '',
  evidence_snippet text default '',
  severity text default 'info'
    check (severity in ('critical', 'warning', 'info')),
  target_type text default 'agent_profile'
    check (target_type in ('agent_profile', 'observability_parameter')),
  target_id text default '',
  source_call_ids text[] default '{}',
  source_call_count integer default 0,
  status text default 'open'
    check (status in ('open', 'in_review', 'done', 'dismissed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table call_analyses add column if not exists outcome text default 'pending';
alter table agent_system_improvements add column if not exists source_call_ids text[] default '{}';
alter table agent_system_improvements add column if not exists source_call_count integer default 0;

drop table if exists human_actions;
drop table if exists call_recommendations;

create index if not exists idx_installations_location on app_installations (ghl_location_id);
create index if not exists idx_agent_profiles_agent on agent_observability_profiles (installation_id, ghl_agent_id);
create index if not exists idx_parameters_version on llm_parameters (version_id, sort_order);
create index if not exists idx_jobs_status on call_analysis_jobs (status, next_retry_at);
create index if not exists idx_analyses_agent on call_analyses (installation_id, ghl_agent_id, analyzed_at desc);
create index if not exists idx_analyses_call on call_analyses (installation_id, ghl_call_id);
create index if not exists idx_parameter_results_analysis on call_parameter_results (analysis_id);
create index if not exists idx_system_improvements_agent on agent_system_improvements (installation_id, ghl_agent_id, status, severity);
create index if not exists idx_system_improvements_target on agent_system_improvements (installation_id, target_type, status);

