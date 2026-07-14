'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, Play, GitFork, Flag, X, Sparkles, Share2, Check, Copy } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { CoverCard } from '@/components/project/CoverCard'
import { ProjectCard } from '@/components/project/ProjectCard'
import { TypeBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatCount } from '@/lib/utils'
import { useIsAuthenticated } from '@/hooks/useUser'
import { track, EVENTS } from '@/lib/posthog'
import type { ProjectWithCreator, ReportReason } from '@/types'

const REPORT_REASONS: { value: ReportReason; label: string; emoji: string }[] = [
  { value: 'bullying',      label: 'Bullying or being mean',       emoji: '🚫' },
  { value: 'inappropriate', label: 'Bad or mature content',        emoji: '⚠️' },
  { value: 'personal_info', label: "Has someone's private info",   emoji: '🔒' },
  { value: 'unsafe',        label: 'Feels wrong or unsafe',        emoji: '⛔' },
  { value: 'spam',          label: 'Spam or fake',                 emoji: '📢' },
  { value: 'other',         label: 'Something else',               emoji: '💬' },
]

interface Props {
  project: ProjectWithCreator
  related: ProjectWithCreator[]
}

export function ProjectPageClient({ project, related }: Props) {
  const router = useRouter()
  const isAuth = useIsAuthenticated()
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(project.like_count)
  const [playOpen, setPlayOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReason | null>(null)
  const [reportSent, setReportSent] = useState(false)
  const [remixing, setRemixing] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/${project.id}` : ''
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator

  async function copyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  async function shareProject() {
    if (canNativeShare && shareUrl) {
      try {
        await navigator.share({
          title: project.title,
          text: project.description || `Check out "${project.title}" on Barshi`,
          url: shareUrl,
        })
        return
      } catch { /* fallthrough to copy */ }
    }
    copyLink()
  }

  useEffect(() => {
    if (playOpen) {
      fetch(`/api/projects/${project.id}/play`, { method: 'POST' }).catch(() => null)
      track(EVENTS.PROJECT_PLAYED, { project_id: project.id, type: project.type })
    }
  }, [playOpen, project.id, project.type])

  async function toggleLike() {
    if (!isAuth) { router.push('/login'); return }
    const next = !liked
    setLiked(next)
    setLikeCount((c) => liked ? c - 1 : c + 1)
    if (next) track(EVENTS.LIKE_CLICKED, { project_id: project.id })
    await fetch(`/api/projects/${project.id}/like`, { method: 'POST' })
  }

  async function handleRemix() {
    if (!isAuth) { router.push('/login'); return }
    setRemixing(true)
    track(EVENTS.REMIX_CLICKED, { project_id: project.id, type: project.type })
    const res = await fetch(`/api/projects/${project.id}/remix`, { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push(`/build/${data.id}`)
    else setRemixing(false)
  }

  async function submitReport() {
    if (!reportReason) return
    track(EVENTS.REPORT_SUBMITTED, { project_id: project.id, reason: reportReason })
    await fetch('/api/moderation/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, reason: reportReason }),
    })
    setReportSent(true)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-8 space-y-8">
      <div className="grid md:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Left: Info */}
        <div className="space-y-5 order-2 md:order-1">
          {/* Type + remix source */}
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type={project.type} showEmoji />
            {project.remix_of && (
              <Link href={`/p/${project.remix_of}`} className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] transition-colors flex items-center gap-1">
                <GitFork size={10} />
                remixed
              </Link>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-black leading-tight tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}>
            {project.title}
          </h1>

          {project.description && (
            <p className="text-[var(--color-text-muted)] leading-relaxed">{project.description}</p>
          )}

          {/* Creator */}
          <Link href={`/u/${project.creator.username}`} className="inline-flex items-center gap-3 glass rounded-[var(--radius-lg)] px-4 py-3 hover:border-[var(--color-border-light)] transition-all w-auto">
            <Avatar src={project.creator.avatar_url} username={project.creator.username} size="md" />
            <div>
              <p className="text-sm font-bold">{project.creator.username}</p>
              <p className="text-xs text-[var(--color-text-dim)]">creator</p>
            </div>
          </Link>

          {/* Stats */}
          <div className="flex items-center gap-5 text-sm text-[var(--color-text-dim)]">
            <span className="flex items-center gap-1.5">
              <Heart size={14} className={liked ? 'fill-[var(--color-danger)] text-[var(--color-danger)]' : ''} />
              <span className="font-semibold text-[var(--color-text-muted)]">{formatCount(likeCount)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Play size={14} />
              <span className="font-semibold text-[var(--color-text-muted)]">{formatCount(project.play_count)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <GitFork size={14} />
              <span className="font-semibold text-[var(--color-text-muted)]">{formatCount(project.remix_count)}</span>
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button size="lg" className="gap-2 glow-sm flex-1 sm:flex-none" onClick={() => setPlayOpen(true)}>
              <Play size={16} className="fill-current" />
              Play
            </Button>
            <Button size="lg" variant="secondary" className="gap-2" onClick={toggleLike}>
              <Heart size={16} className={liked ? 'fill-current text-[var(--color-danger)]' : ''} />
              {liked ? 'Liked' : 'Like'}
            </Button>
            <Button size="lg" variant="secondary" className="gap-2" onClick={handleRemix} loading={remixing} title="Make your own version of this project">
              <GitFork size={16} />
              Remix it
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="gap-2"
              onClick={shareProject}
              title={canNativeShare ? 'Share with friends' : 'Copy link'}
            >
              {copied ? <Check size={16} className="text-green-400" /> : canNativeShare ? <Share2 size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Share'}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-[var(--color-text-dim)]"
              onClick={() => setReportOpen(true)}
            >
              <Flag size={14} />
            </Button>
          </div>
        </div>

        {/* Right: Cover */}
        <div className="order-1 md:order-2">
          <button
            onClick={() => setPlayOpen(true)}
            className="block w-full group relative rounded-[var(--radius-xl)] overflow-hidden"
          >
            <CoverCard cover={project.cover_config} type={project.type} title={project.title} size="lg" className="rounded-[var(--radius-xl)]" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 scale-90 group-hover:scale-100 transition-transform duration-200">
                <Play size={28} className="text-white fill-white ml-1" />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[var(--color-brand)]" />
            <h2 className="font-bold text-sm text-[var(--color-text-muted)] uppercase tracking-wider">More like this</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {related.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        </div>
      )}

      {/* Play modal */}
      <Dialog.Root open={playOpen} onOpenChange={setPlayOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/90 z-50 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-3 sm:inset-6 z-50 flex flex-col bg-[var(--color-surface-2)] rounded-[var(--radius-xl)] overflow-hidden border border-[var(--color-border)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <TypeBadge type={project.type} />
                <Dialog.Title className="font-bold text-sm">{project.title}</Dialog.Title>
              </div>
              <Dialog.Close className="h-8 w-8 rounded-[var(--radius-md)] flex items-center justify-center hover:bg-[var(--color-surface-3)] transition-colors text-[var(--color-text-muted)]">
                <X size={16} />
              </Dialog.Close>
            </div>
            <div className="flex-1 min-h-0">
              {playOpen && (
                <iframe
                  src={`/api/projects/${project.id}/html`}
                  sandbox="allow-scripts"
                  className="sandbox-frame"
                  title={project.title}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Report modal */}
      <Dialog.Root open={reportOpen} onOpenChange={setReportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-sm glass rounded-[var(--radius-xl)] p-5 space-y-4">
              {reportSent ? (
                <div className="text-center space-y-3 py-4">
                  <p className="text-4xl">🙏</p>
                  <Dialog.Title className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Thanks for keeping Barshi safe</Dialog.Title>
                  <p className="text-sm text-[var(--color-text-muted)]">We&apos;ll review this shortly.</p>
                  <Button size="sm" variant="secondary" className="w-full" onClick={() => { setReportOpen(false); setReportSent(false) }}>
                    Close
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Dialog.Title className="font-bold text-base" style={{ fontFamily: 'var(--font-display)' }}>Something wrong? Let us know 🙋</Dialog.Title>
                    <p className="text-xs text-[var(--color-text-dim)] mt-0.5">What&apos;s the problem?</p>
                  </div>
                  <div className="space-y-2">
                    {REPORT_REASONS.map(({ value, label, emoji }) => (
                      <button
                        key={value}
                        onClick={() => setReportReason(value)}
                        className={`w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] text-sm border transition-all flex items-center gap-2 ${
                          reportReason === value
                            ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-text)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-light)] hover:bg-[var(--color-surface-3)]'
                        }`}
                      >
                        <span>{emoji}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => setReportOpen(false)}>Cancel</Button>
                    <Button size="sm" className="flex-1" disabled={!reportReason} onClick={submitReport}>Submit</Button>
                  </div>
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
