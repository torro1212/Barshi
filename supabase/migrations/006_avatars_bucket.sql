-- ═══════════════════════════════════════════════
-- Barshi — Avatars Storage Bucket
-- Public-read bucket for profile pictures. Writes go
-- through the service role (the /api/profile/avatar route
-- validates type + size), so no user-facing insert policy
-- is required. Public read lets <img> tags load avatars.
-- ═══════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Anyone can read avatar files (they're public profile images)
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');
