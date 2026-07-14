import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Heart, Play, Boxes } from 'lucide-react'
import { AppShell } from '@/components/nav/AppShell'
import { Avatar } from '@/components/ui/avatar'
import { ProjectCard } from '@/components/project/ProjectCard'
import { formatCount } from '@/lib/utils'
import { getProfileByUsername } from '@/lib/db/queries/profiles'
import { getProjectsByCreator } from '@/lib/db/queries/projects'
import { createServerClientInstance } from '@/lib/db/server'
import { isLocalMode } from '@/lib/local-mode'
import { EditBio } from './EditBio'

interface Props { params: Promise<{ username: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfileByUsername(username)
  if (!profile) return { title: 'User not found' }
  return {
    title: `${profile.username} — Barshi`,
    description: profile.bio ?? `Check out ${profile.username}'s projects on Barshi`,
  }
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params
  const profile = await getProfileByUsername(username)

  if (!profile) notFound()

  const projects = await getProjectsByCreator(profile.id, false)

  const totalLikes = projects.reduce((sum, p) => sum + p.like_count, 0)
  const totalPlays = projects.reduce((sum, p) => sum + p.play_count, 0)

  // Is the viewer looking at their own profile?
  let isOwner = false
  if (!isLocalMode()) {
    const supabase = await createServerClientInstance()
    const { data: { user } } = await supabase.auth.getUser()
    isOwner = user?.id === profile.id
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-10 space-y-8">
        {/* Profile header */}
        <div className="relative rounded-[var(--radius-xl)] overflow-hidden">
          {/* Banner gradient */}
          <div className="h-28 sm:h-36 w-full"
            style={{ background: 'linear-gradient(135deg, #3b1f8c 0%, #1a1a3a 50%, #0f1a3a 100%)' }}>
            <div className="absolute inset-0 opacity-30"
              style={{ backgroundImage: 'radial-gradient(rgba(139,92,246,0.6) 1.5px, transparent 1.5px)', backgroundSize: '18px 18px' }} />
          </div>

          {/* Profile info */}
          <div className="px-5 pb-5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-b-[var(--radius-xl)]">
            <div className="flex items-end justify-between -mt-8 mb-4">
              <div className="ring-4 ring-[var(--color-surface-2)] rounded-full">
                <Avatar src={profile.avatar_url} username={profile.username} size="xl" />
              </div>
              {isOwner && <EditBio username={profile.username} initialBio={profile.bio} initialAvatar={profile.avatar_url} />}
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {profile.username}
              </h1>
              {profile.bio && (
                <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">{profile.bio}</p>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-5 mt-4 pt-4 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-2 text-sm">
                <Boxes size={14} className="text-[var(--color-brand)]" />
                <span className="font-bold">{projects.length}</span>
                <span className="text-[var(--color-text-dim)]">{projects.length === 1 ? 'project' : 'projects'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Heart size={14} className="text-[var(--color-danger)]" />
                <span className="font-bold">{formatCount(totalLikes)}</span>
                <span className="text-[var(--color-text-dim)]">likes</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Play size={14} className="text-[var(--color-success)]" />
                <span className="font-bold">{formatCount(totalPlays)}</span>
                <span className="text-[var(--color-text-dim)]">plays</span>
              </div>
            </div>
          </div>
        </div>

        {/* Projects grid */}
        {projects.length > 0 ? (
          <div className="space-y-4">
            <h2 className="font-bold text-sm text-[var(--color-text-dim)] uppercase tracking-wider">Projects</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--color-surface-3)] border border-[var(--color-border)] flex items-center justify-center">
              <Boxes size={26} className="text-[var(--color-text-muted)]" />
            </div>
            <p className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>No public projects yet</p>
            <p className="text-sm text-[var(--color-text-dim)]">Check back soon!</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
