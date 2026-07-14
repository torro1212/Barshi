-- ═══════════════════════════════════════════════
-- Barshi — Helper Functions Migration
-- ═══════════════════════════════════════════════

-- Atomic play count increment
create or replace function public.increment_play_count(project_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.projects
  set play_count = play_count + 1
  where id = project_id and visibility = 'public';
end;
$$;

-- Atomic like count increment
create or replace function public.increment_like_count(project_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.projects
  set like_count = like_count + 1
  where id = project_id;
end;
$$;

-- Atomic like count decrement (floor at 0)
create or replace function public.decrement_like_count(project_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.projects
  set like_count = greatest(0, like_count - 1)
  where id = project_id;
end;
$$;

-- Atomic remix count increment
create or replace function public.increment_remix_count(project_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.projects
  set remix_count = remix_count + 1
  where id = project_id;
end;
$$;
