-- ═══════════════════════════════════════════════
-- Barshi — Initial Database Migration
-- Run this in Supabase SQL Editor to initialize the schema
-- ═══════════════════════════════════════════════

-- ─── Profiles ───────────────────────────────────
create table public.profiles (
  id                uuid references auth.users primary key,
  username          text unique not null,
  avatar_url        text,
  bio               text,
  account_status    text not null default 'active'
    check (account_status in ('active','warned','restricted','suspended','banned')),
  restriction_until timestamptz,
  created_at        timestamptz not null default now()
);

-- ─── Projects ───────────────────────────────────
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid references public.profiles not null,
  title        text not null,
  description  text,
  type         text not null
    check (type in ('game','website','tool','story','interface','simulation','world')),
  meta_json    jsonb not null default '{}',
  bundle_path  text,
  cover_config jsonb not null default '{}',
  visibility   text not null default 'private'
    check (visibility in ('private','public','removed')),
  remix_of     uuid references public.projects,
  play_count   integer not null default 0,
  like_count   integer not null default 0,
  remix_count  integer not null default 0,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── Project versions (last 5 per project) ──────
create table public.project_versions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects not null,
  bundle_path text not null,
  meta_json   jsonb not null default '{}',
  version_num integer not null,
  created_at  timestamptz not null default now()
);

-- ─── Likes ──────────────────────────────────────
create table public.likes (
  user_id    uuid references public.profiles not null,
  project_id uuid references public.projects not null,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

-- ─── Reports ────────────────────────────────────
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects not null,
  reporter_id uuid references public.profiles not null,
  reason      text not null
    check (reason in ('bullying','inappropriate','personal_info','unsafe','spam','other')),
  status      text not null default 'pending'
    check (status in ('pending','safe','actioned')),
  created_at  timestamptz not null default now()
);

-- ─── Moderation actions (audit log) ─────────────
create table public.moderation_actions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles not null,
  action_type text not null
    check (action_type in ('warning','restrict_publishing','suspend','ban','project_removed')),
  reason      text not null,
  project_id  uuid references public.projects,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- ─── Notifications ──────────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles not null,
  type       text not null
    check (type in ('like','remix','play_milestone','publish_success','moderation')),
  data       jsonb not null default '{}',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════

-- Discover feed — most common query
create index idx_projects_public_feed
  on public.projects (published_at desc)
  where visibility = 'public';

-- Feed by type
create index idx_projects_type_feed
  on public.projects (type, published_at desc)
  where visibility = 'public';

-- Creator profile view
create index idx_projects_creator
  on public.projects (creator_id, created_at desc);

-- Remix lineage
create index idx_projects_remix_of
  on public.projects (remix_of)
  where remix_of is not null;

-- Likes per project
create index idx_likes_project
  on public.likes (project_id);

-- Reports by project
create index idx_reports_project_status
  on public.reports (project_id, status);

-- Notifications for a user (unread first)
create index idx_notifications_user
  on public.notifications (user_id, read, created_at desc);

-- Version history
create index idx_versions_project
  on public.project_versions (project_id, version_num desc);

-- Username lookup (for profile pages)
create index idx_profiles_username
  on public.profiles (username);

-- ═══════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════

alter table public.profiles          enable row level security;
alter table public.projects          enable row level security;
alter table public.project_versions  enable row level security;
alter table public.likes             enable row level security;
alter table public.reports           enable row level security;
alter table public.notifications     enable row level security;
alter table public.moderation_actions enable row level security;

-- Profiles: anyone can read, only self can write
create policy "profiles_select_all"    on public.profiles for select using (true);
create policy "profiles_insert_self"   on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_self"   on public.profiles for update using (auth.uid() = id);

-- Projects: public projects readable by all, private by creator only
create policy "projects_select" on public.projects for select using (
  visibility = 'public' or creator_id = auth.uid()
);
create policy "projects_insert" on public.projects for insert with check (creator_id = auth.uid());
create policy "projects_update" on public.projects for update using (creator_id = auth.uid());
create policy "projects_delete" on public.projects for delete using (creator_id = auth.uid());

-- Project versions: creator only
create policy "versions_creator" on public.project_versions
  for all using (
    project_id in (select id from public.projects where creator_id = auth.uid())
  );

-- Likes: readable by all, writable by self
create policy "likes_select" on public.likes for select using (true);
create policy "likes_self"   on public.likes for all using (user_id = auth.uid());

-- Reports: insert only (never read your own or others' reports)
create policy "reports_insert" on public.reports for insert with check (reporter_id = auth.uid());

-- Notifications: self only
create policy "notifications_self" on public.notifications for all using (user_id = auth.uid());

-- Moderation actions: no direct user access (service role only)
-- (No policy = blocked for all auth.uid() — service role bypasses RLS)

-- ═══════════════════════════════════════════════
-- Auto-update updated_at on projects
-- ═══════════════════════════════════════════════
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

-- ═══════════════════════════════════════════════
-- Auto-create profile after signup
-- ═══════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'creator_' || substr(new.id::text, 1, 6))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
