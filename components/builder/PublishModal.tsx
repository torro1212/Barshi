'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Globe, Rocket, Share2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useBuilderStore } from '@/stores/builderStore'

interface PublishModalProps {
  open: boolean
  onClose: () => void
}

export function PublishModal({ open, onClose }: PublishModalProps) {
  const router = useRouter()
  const { projectId } = useBuilderStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = projectId && typeof window !== 'undefined'
    ? `${window.location.origin}/p/${projectId}`
    : ''

  async function copyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore clipboard errors */
    }
  }

  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator

  async function nativeShare() {
    if (!shareUrl || !canNativeShare) return copyLink()
    try {
      await navigator.share({
        title: title.trim() || 'Check out what I built on Barshi',
        text: 'I built this on Barshi — come play!',
        url: shareUrl,
      })
    } catch {
      /* user cancelled or share failed — fall back to copy */
    }
  }

  async function handlePublish() {
    if (!projectId || !title.trim()) return
    setIsPublishing(true)
    setError(null)

    const res = await fetch(`/api/projects/${projectId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Something went wrong. Try again.')
      setIsPublishing(false)
      return
    }

    setIsPublishing(false)
    setDone(true)
  }

  function handleView() {
    router.push(`/p/${projectId}`)
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 space-y-5">
            {done ? (
              // Success state
              <div className="text-center space-y-5 py-2">
                <div className="text-5xl">🎉</div>
                <div className="space-y-1">
                  <Dialog.Title className="text-xl font-bold">You&apos;re live! Amazing!</Dialog.Title>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Share this link — anyone with it can play your project.
                  </p>
                </div>

                {/* Share link — big and prominent */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-dim)] text-left">Your link</p>
                  <div className="flex items-stretch gap-0 rounded-[var(--radius-md)] border border-[var(--color-brand)]/40 bg-[var(--color-surface-3)] overflow-hidden shadow-[0_0_0_1px_var(--color-brand)/10]">
                    <div className="flex-1 px-3 py-3 text-left text-sm font-mono text-[var(--color-text)] truncate select-all">
                      {shareUrl}
                    </div>
                    <button
                      type="button"
                      onClick={copyLink}
                      className={`px-4 flex items-center gap-1.5 text-xs font-semibold transition-colors border-l border-[var(--color-border)] ${
                        copied
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-4)]'
                      }`}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Share with friends — primary action */}
                {canNativeShare && (
                  <Button size="lg" className="w-full gap-2 glow-sm" onClick={nativeShare}>
                    <Share2 size={16} />
                    Share with friends
                  </Button>
                )}

                <div className="flex gap-2">
                  <Button variant="secondary" size="md" className="flex-1" onClick={onClose}>
                    Keep building
                  </Button>
                  <Button size="md" variant={canNativeShare ? 'secondary' : 'primary'} className="flex-1" onClick={handleView}>
                    View it live
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-bold flex items-center gap-2">
                    <Rocket size={18} className="text-[var(--color-brand)]" />
                    Publish your project
                  </Dialog.Title>
                  <Dialog.Close className="p-1.5 hover:bg-[var(--color-surface-3)] rounded-[var(--radius-md)] transition-colors text-[var(--color-text-muted)]">
                    ✕
                  </Dialog.Close>
                </div>

                <Input
                  label="Title"
                  placeholder="Zombie Survival 3000"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  hint="What's your project called?"
                />

                <Textarea
                  label="Description (optional)"
                  placeholder="A fun zombie survival game with 3 levels..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-16 resize-none"
                />

                <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-3)] border border-[var(--color-border)]">
                  <Globe size={15} className="text-[var(--color-brand)] flex-shrink-0" />
                  <span className="text-sm text-[var(--color-text-muted)]">
                    Everyone can find, play, and remix this
                  </span>
                </div>

                {error && (
                  <p className="text-sm text-[var(--color-danger)] text-center">{error}</p>
                )}

                <div className="flex gap-2">
                  <Button variant="secondary" size="md" className="flex-1" onClick={onClose}>
                    Not yet
                  </Button>
                  <Button
                    size="md"
                    className="flex-1 gap-1.5"
                    disabled={!title.trim()}
                    loading={isPublishing}
                    onClick={handlePublish}
                  >
                    <Rocket size={15} />
                    Publish
                  </Button>
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
