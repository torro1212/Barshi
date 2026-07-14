-- ═══════════════════════════════════════════════
-- Barshi — Version Snapshots Migration
-- Adds an HTML column to project_versions and an atomic
-- "snapshot" RPC that keeps only the latest 5 versions
-- per project. Called by the builder before each save so
-- kids can roll back a change that broke their project.
-- ═══════════════════════════════════════════════

alter table public.project_versions
  add column if not exists html text;

-- bundle_path is no longer required (we store inline HTML snapshots)
alter table public.project_versions
  alter column bundle_path drop not null;

create or replace function public.snapshot_version(p_project_id uuid, p_html text)
returns void language plpgsql security definer as $$
declare
  next_num integer;
begin
  if p_html is null or length(p_html) = 0 then
    return;
  end if;

  select coalesce(max(version_num), 0) + 1 into next_num
  from public.project_versions
  where project_id = p_project_id;

  insert into public.project_versions (project_id, html, version_num, bundle_path)
  values (p_project_id, p_html, next_num, null);

  -- Keep only the 5 most recent versions
  delete from public.project_versions
  where project_id = p_project_id
    and version_num <= next_num - 5;
end;
$$;
