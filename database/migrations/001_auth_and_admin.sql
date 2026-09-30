-- Accounts, sessions and admin console data.
-- Run once in the Supabase SQL editor. Safe to re-run: every change is guarded.

-- ---------------------------------------------------------------- accounts

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null unique,
    password_hash text not null,
    role text not null default 'student' check (role in ('student', 'admin')),
    created_at timestamptz not null default now(),
    last_login_at timestamptz
);

-- Only a hash of each session token is stored, so a leaked table cannot log anyone in.
create table if not exists auth_sessions (
    token_hash text primary key,
    user_id uuid not null references users (id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
);
create index if not exists auth_sessions_user_idx on auth_sessions (user_id);

-- --------------------------------------------------------------- documents

alter table documents add column if not exists status text not null default 'ready';
alter table documents add column if not exists error text;
alter table documents add column if not exists file_size bigint;

do $$ begin
    alter table documents add constraint documents_status_check
        check (status in ('ready', 'processing', 'failed'));
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------ questions and chats

alter table query_logs add column if not exists user_id uuid references users (id) on delete set null;
alter table query_logs add column if not exists student_email text;
alter table query_logs add column if not exists status text;
alter table query_logs add column if not exists latency_ms integer;
alter table query_logs add column if not exists top_source text;
alter table query_logs add column if not exists cited_document_ids uuid[];
create index if not exists query_logs_created_idx on query_logs (created_at desc);

-- Questions logged before this migration were all answered by the model.
update query_logs set status = 'answered' where status is null;

alter table conversations add column if not exists user_id uuid references users (id) on delete cascade;
create index if not exists conversations_user_idx on conversations (user_id);

-- ------------------------------------------------------------ admin activity

create table if not exists activity_log (
    id uuid primary key default gen_random_uuid(),
    label text not null,
    tone text not null default 'info' check (tone in ('info', 'success', 'warn')),
    created_at timestamptz not null default now()
);
create index if not exists activity_log_created_idx on activity_log (created_at desc);

-- ------------------------------------------------------------------ access

-- The API uses the service key, which bypasses row level security. Enabling it
-- with no policies keeps these tables closed to the public (anon) key.
alter table users enable row level security;
alter table auth_sessions enable row level security;
alter table activity_log enable row level security;
