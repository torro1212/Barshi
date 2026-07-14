'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Globe, Lock, Sparkles, Trash2, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { AppShell } from '@/components/nav/AppShell'
import { CoverCard } from '@/components/project/CoverCard'
import { TypeBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { formatCount } from '@/lib/utils'
import { useIsAuthenticated, useProfile } from '@/hooks/useUser'
import type { ProjectWithCreator } from '@/types'

type Tab = 'all' | 'published' | 'drafts'

export default function MyProjectsPage() {
  const router = useRouter()
  const isAuth = useIsAuthenticated()
  const profile = useProfile()

  const [projects, setProjects] = useState<ProjectWithCreator[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithCreator | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id))
        setDeleteTarget(null)
      }
    } catch { /* ignore */ } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (isAuth === false) router.push('/login')
  }, [isAuth, router])

  useEffect(() => {
    if (!isAuth) return
    async function load() {
      setLoading(true)
      const res = await fetch('/api/projects/mine')
      if (res.ok) setProjects(await res.json())
      setLoading(false)
    }
    load()
  }, [isAuth])

  const filtered = projects.filter((p) => {
    if (tab === 'published') return p.visibility === 'public'
    if (tab === 'drafts') return p.visibility === 'private'
    return true
  })

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all',       label: 'All',       count: projects.length },
    { id: 'published', label: 'Published', count: projects.filter((p) => p.visibility === 'public').length },
    { id: 'drafts',    label: 'Private',   count: projects.filter((p) => p.visibility === 'private').length },
  ]

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile && <Avatar src={profile.avatar_url} username={profile.username} size="md" />}
            <div>
              <h1 className="text-xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                My Projects
              </h1>
              {profile && <p className="text-xs text-[var(--color-text-dim)]">@{profile.username}</p>}
            </div>
          </div>
          <Button asChild size="sm" className="gap-1.5 glow-sm">
            <Link href="/create">
              <Plus size={14} />
              New
            </Link>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--color-border)]">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all ${
                tab === id
                  ? 'border-[var(--color-brand)] text-[var(--color-brand-light)]'
                  : 'border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)]'
              }`}
            >
              {label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                tab === id ? 'bg-[var(--color-brand)]/20 text-[var(--color-brand-light)]' : 'bg-[var(--color-surface-3)] text-[var(--color-text-dim)]'
              }`}>{count}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-[var(--radius-xl)] overflow-hidden">
                <div className="aspect-[4/3] bg-[var(--color-surface-3)] animate-pulse" />
                <div className="p-3 space-y-2 bg-[var(--color-surface-2)]">
                  <div className="h-3 w-3/4 rounded-full bg-[var(--color-surface-3)] animate-pulse" />
                  <div className="h-3 w-1/2 rounded-full bg-[var(--color-surface-3)] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            {tab === 'all' ? (
              <>
                <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--color-brand)]/12 border border-[var(--color-brand)]/25 flex items-center justify-center">
                  <Sparkles size={30} className="text-[var(--color-brand-light)]" />
                </div>
                <p className="font-black text-xl" style={{ fontFamily: 'var(--font-display)' }}>No projects yet</p>
                <p className="text-sm text-[var(--color-text-dim)]">Create your first project and get seen by everyone!</p>
                <Button asChild size="md" className="gap-2 glow-sm mt-2">
                  <Link href="/create">
                    <Sparkles size={15} />
                    Create something
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--color-surface-3)] border border-[var(--color-border)] flex items-center justify-center">
                  {tab === 'published'
                    ? <Globe size={26} className="text-[var(--color-text-muted)]" />
                    : <Lock size={26} className="text-[var(--color-text-muted)]" />}
                </div>
                <p className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>No {tab === 'drafts' ? 'private' : tab} projects</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map((project) => (
              <ProjectRow key={project.id} project={project} onDelete={() => setDeleteTarget(project)} />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <Dialog.Root open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm glass rounded-[var(--radius-xl)] p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Dialog.Title className="font-bold text-base" style={{ fontFamily: 'var(--font-display)' }}>Delete this project?</Dialog.Title>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    <strong className="text-[var(--color-text)]">{deleteTarget?.title}</strong> will be gone for good. This can&apos;t be undone.
                  </p>
                </div>
                <Dialog.Close className="h-8 w-8 rounded-[var(--radius-md)] flex items-center justify-center hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] flex-shrink-0">
                  <X size={16} />
                </Dialog.Close>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setDeleteTarget(null)}>Keep it</Button>
                <Button variant="danger" size="sm" className="flex-1 gap-1.5" loading={deleting} onClick={confirmDelete}>
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AppShell>
  )
}

function ProjectRow({ project, onDelete }: { project: ProjectWithCreator; onDelete: () => void }) {
  return (
    <Link href={`/build/${project.id}`} className="group block">
      <article className="rounded-[var(--radius-xl)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] transition-all duration-300 hover:border-[var(--color-border-light)] hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
        <div className="relative">
          <CoverCard cover={project.cover_config} type={project.type} title={project.title} size="sm" className="rounded-none" />
          {/* Visibility pill */}
          <div className="absolute top-2 right-2">
            {project.visibility === 'public' ? (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-[var(--color-success)]/20 text-[var(--color-success)] border border-[var(--color-success)]/30 backdrop-blur-sm">
                <Globe size={8} />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-black/40 text-[var(--color-text-dim)] border border-white/10 backdrop-blur-sm">
                <Lock size={8} />
                Only me
              </span>
            )}
          </div>
          {/* Delete button — appears on hover, doesn't trigger the card link */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete() }}
            aria-label={`Delete ${project.title}`}
            className="absolute top-2 left-2 h-7 w-7 rounded-full flex items-center justify-center bg-black/50 text-white/80 border border-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-[var(--color-danger)] hover:text-white transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <div className="p-3 space-y-1.5">
          <p className="text-sm font-bold truncate leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {project.title}
          </p>
          <div className="flex items-center justify-between">
            <TypeBadge type={project.type} />
            <span className="text-[10px] text-[var(--color-text-dim)]">
              {formatCount(project.like_count)}❤️ · {formatCount(project.play_count)}▶
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
