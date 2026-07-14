'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, Camera, Loader2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar } from '@/components/ui/avatar'

interface EditBioProps {
  username: string
  initialBio: string | null
  initialAvatar: string | null
}

export function EditBio({ username, initialBio, initialAvatar }: EditBioProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [bio, setBio] = useState(initialBio ?? '')
  const [avatar, setAvatar] = useState<string | null>(initialAvatar)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.avatar_url) {
        setAvatar(data.avatar_url)
      } else {
        setError(data.error ?? 'Could not upload that image.')
      }
    } catch {
      setError('Could not upload that image.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio }),
      })
      if (res.ok) {
        setOpen(false)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Could not save. Try again.')
      }
    } catch {
      setError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-semibold bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-light)] transition-all">
          <Pencil size={13} />
          Edit profile
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass rounded-[var(--radius-xl)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Dialog.Title className="font-bold text-base" style={{ fontFamily: 'var(--font-display)' }}>Edit your profile</Dialog.Title>
              <Dialog.Close className="h-8 w-8 rounded-[var(--radius-md)] flex items-center justify-center hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
                <X size={16} />
              </Dialog.Close>
            </div>

            {/* Avatar picker */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative rounded-full group"
                aria-label="Change profile picture"
              >
                <Avatar src={avatar} username={username} size="xl" />
                <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? <Loader2 size={18} className="animate-spin text-white" /> : <Camera size={18} className="text-white" />}
                </span>
              </button>
              <div className="text-sm">
                <p className="font-semibold text-[var(--color-text)]">Profile picture</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-xs text-[var(--color-brand-light)] hover:underline disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : 'Upload new photo'}
                </button>
                <p className="text-xs text-[var(--color-text-dim)] mt-0.5">PNG, JPG, WEBP · max 2 MB</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={onPickFile}
                className="hidden"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="bio-input" className="text-sm font-semibold text-[var(--color-text-muted)]">Bio</label>
              <Textarea
                id="bio-input"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 160))}
                placeholder="Tell everyone what you love to make…"
                className="min-h-24 resize-none"
              />
              <p className="text-xs text-[var(--color-text-dim)] text-right">{bio.length}/160</p>
            </div>

            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="flex-1" loading={saving} onClick={save}>Save</Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
