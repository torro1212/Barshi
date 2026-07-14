-- ═══════════════════════════════════════════════
-- Barshi — Play Milestone Notifications
-- Recreates increment_play_count so that crossing a
-- milestone (10 / 100 / 1000 / 10000 plays) notifies
-- the creator. Runs atomically inside the same update.
-- ═══════════════════════════════════════════════

create or replace function public.increment_play_count(project_id uuid)
returns void language plpgsql security definer as $$
declare
  new_count integer;
  v_creator uuid;
  v_title   text;
begin
  update public.projects
  set play_count = play_count + 1
  where id = project_id and visibility = 'public'
  returning play_count, creator_id, title into new_count, v_creator, v_title;

  if new_count is null then
    return; -- project not found or not public
  end if;

  if new_count in (10, 100, 1000, 10000) then
    insert into public.notifications (user_id, type, data)
    values (
      v_creator,
      'play_milestone',
      jsonb_build_object('project_id', project_id, 'title', v_title, 'count', new_count)
    );
  end if;
end;
$$;
