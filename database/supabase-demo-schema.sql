create extension if not exists pgcrypto;

create table if not exists app_installations (
  id uuid primary key default gen_random_uuid(),
  ghl_company_id text,
  ghl_location_id text not null,
  ghl_user_type text default 'Location',
  display_name text,
  is_sandbox boolean default true,
  connection_status text default 'connected'
    check (connection_status in ('connected', 'needs_reconnect', 'disabled')),
  connection_error text default '',
  installed_at timestamptz default now(),
  updated_at timestamptz default now(),
  uninstalled_at timestamptz,
  unique (ghl_location_id)
);

create table if not exists oauth_tokens (
  installation_id uuid primary key references app_installations(id) on delete cascade,
  access_token_encrypted text not null,
  refresh_token_encrypted text default '',
  expires_at timestamptz,
  scopes text[] default '{}',
  token_type text default 'Bearer',
  last_refreshed_at timestamptz,
  refresh_error text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
  installation_id uuid references app_installations(id) on delete cascade,
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
  provider text default 'highlevel',
  event_type text not null,
  external_event_id text,
  ghl_company_id text,
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
  installation_id uuid references app_installations(id) on delete cascade,
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

create table if not exists call_recommendations (
  id text primary key,
  analysis_id text not null references call_analyses(id) on delete cascade,
  installation_id uuid not null references app_installations(id) on delete cascade,
  ghl_agent_id text not null,
  ghl_call_id text not null,
  parameter_key text default '',
  title text not null,
  detail text default '',
  severity text default 'info'
    check (severity in ('critical', 'warning', 'info')),
  prompt_patch text default '',
  target_type text not null
    check (target_type in ('agent_profile', 'highlevel_goal', 'observability_parameter')),
  target_action text not null
    check (target_action in ('add', 'update')),
  target_id text default '',
  suggested_change text default '',
  review_status text default 'needs_human_review'
    check (review_status in ('needs_human_review', 'accepted', 'rejected', 'applied')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists human_actions (
  id text primary key,
  analysis_id text not null references call_analyses(id) on delete cascade,
  installation_id uuid not null references app_installations(id) on delete cascade,
  ghl_agent_id text not null,
  ghl_call_id text not null,
  parameter_key text default '',
  title text default '',
  action_type text not null,
  action_category text default 'system'
    check (action_category in ('customer', 'system')),
  reason text default '',
  suggestion text default '',
  transcript_snippet text default '',
  severity text default 'info'
    check (severity in ('critical', 'warning', 'info')),
  target_type text default 'human_follow_up'
    check (target_type in ('agent_profile', 'observability_parameter', 'human_follow_up')),
  target_id text default '',
  status text default 'open'
    check (status in ('open', 'in_review', 'done', 'dismissed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table human_actions add column if not exists title text default '';
alter table human_actions add column if not exists action_category text default 'system';
alter table human_actions add column if not exists suggestion text default '';
alter table human_actions add column if not exists target_type text default 'human_follow_up';
alter table human_actions add column if not exists target_id text default '';
alter table app_installations add column if not exists connection_status text default 'connected';
alter table app_installations add column if not exists connection_error text default '';
alter table app_installations add column if not exists uninstalled_at timestamptz;
alter table llm_parameters add column if not exists installation_id uuid references app_installations(id) on delete cascade;
alter table webhook_events add column if not exists provider text default 'highlevel';
alter table webhook_events add column if not exists external_event_id text;
alter table webhook_events add column if not exists ghl_company_id text;
alter table webhook_events add column if not exists processed_at timestamptz;
alter table webhook_events add column if not exists processing_error text;
alter table call_parameter_results add column if not exists installation_id uuid references app_installations(id) on delete cascade;

update human_actions
set
  title = coalesce(nullif(title, ''), nullif(reason, ''), action_type),
  suggestion = coalesce(nullif(suggestion, ''), ''),
  action_category = case
    when target_type = 'human_follow_up' or action_type = 'follow_up' then 'customer'
    else 'system'
  end
where title = '' or suggestion = '' or action_category is null or action_category = '';

delete from call_recommendations;

create index if not exists idx_installations_location on app_installations (ghl_location_id);
create index if not exists idx_oauth_tokens_installation on oauth_tokens (installation_id);
create index if not exists idx_agent_profiles_agent on agent_observability_profiles (installation_id, ghl_agent_id);
create index if not exists idx_parameters_version on llm_parameters (installation_id, version_id, sort_order);
create index if not exists idx_jobs_status on call_analysis_jobs (status, next_retry_at);
create index if not exists idx_analyses_agent on call_analyses (installation_id, ghl_agent_id, analyzed_at desc);
create index if not exists idx_analyses_call on call_analyses (installation_id, ghl_call_id);
create index if not exists idx_webhook_install_events on webhook_events (provider, external_event_id);
create index if not exists idx_parameter_results_analysis on call_parameter_results (installation_id, analysis_id);
create index if not exists idx_recommendations_agent on call_recommendations (installation_id, ghl_agent_id, review_status);
create index if not exists idx_actions_status on human_actions (installation_id, status, severity);
create index if not exists idx_actions_category on human_actions (installation_id, action_category, status);
