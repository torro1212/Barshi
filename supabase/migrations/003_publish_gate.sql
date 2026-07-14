-- ═══════════════════════════════════════════════
-- Barshi — Publish Gate Migration
-- Closes the RLS escalation where a creator could set
-- visibility='public' directly (via the anon key + RLS update
-- policy) and skip the mandatory pre-publish safety scan.
-- Publishing is only allowed through the service role, i.e.
-- the /api/projects/[id]/publish route that runs the scan.
-- ═══════════════════════════════════════════════

create or replace function public.enforce_publish_gate()
returns trigger language plpgsql as $$
declare
  is_service boolean;
begin
  -- service_role (API routes) and direct admin connections bypass the gate.
  -- security definer RPCs (count increments) run as their owner and also pass.
  is_service := coalesce(auth.role(), '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin', 'service_role');

  if is_service then
    return new;
  end if;

  -- Clients may never publish directly — that skips the safety scan
  if new.visibility = 'public'
     and (tg_op = 'INSERT' or old.visibility is distinct from 'public') then
    raise exception 'Projects can only be published through the publish flow';
  end if;

  -- Clients may never restore a moderation-removed project
  if tg_op = 'UPDATE'
     and old.visibility = 'removed'
     and new.visibility is distinct from 'removed' then
    raise exception 'This project was removed by moderation';
  end if;

  -- Clients may never tamper with counters, publish timestamp, or ownership
  if tg_op = 'UPDATE' then
    new.play_count   := old.play_count;
    new.like_count   := old.like_count;
    new.remix_count  := old.remix_count;
    new.published_at := old.published_at;
    new.creator_id   := old.creator_id;
  else
    new.play_count   := 0;
    new.like_count   := 0;
    new.remix_count  := 0;
    new.published_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists projects_publish_gate on public.projects;
create trigger projects_publish_gate
  before insert or update on public.projects
  for each row execute function public.enforce_publish_gate();
