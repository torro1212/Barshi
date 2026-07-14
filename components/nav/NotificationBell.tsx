'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Heart, GitFork, Rocket, ShieldAlert, PartyPopper } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import type { Notification, NotificationType } from '@/types'

const ICONS: Record<NotificationType, React.ReactNode> = {
  like:            <Heart size={14} className="text-[var(--color-danger)]" />,
  remix:           <GitFork size={14} className="text-[var(--color-brand-light)]" />,
  publish_success: <Rocket size={14} className="text-[var(--color-brand-light)]" />,
  play_milestone:  <PartyPopper size={14} className="text-amber-400" />,
  moderation:      <ShieldAlert size={14} className="text-orange-400" />,
}

function messageFor(n: Notification): { text: string; href: string } {
  const data = n.data as { project_id?: string; title?: string; count?: number }
  const title = data.title ? `"${data.title}"` : 'your project'
  const href = data.project_id ? `/p/${data.project_id}` : '/projects'
  switch (n.type) {
    case 'like':            return { text: `Someone liked ${title}`, href }
    case 'remix':           return { text: `Someone remixed ${title}`, href }
    case 'publish_success': return { text: `${title} is live! 🎉`, href }
    case 'play_milestone':  return { text: `${title} hit ${data.count ?? 'more'} plays!`, href }
    case 'moderation':      return { text: `Update about ${title}`, href }
    default:                return { text: 'You have a new update', href }
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setItems(data.notifications ?? [])
      setUnread(data.unread ?? 0)
    } catch { /* offline — ignore */ }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setUnread(0)
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
      await fetch('/api/notifications', { method: 'PUT' }).catch(() => null)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative h-9 w-9 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)] transition-colors"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--color-danger)] text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <p className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)' }}>Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center space-y-2">
                <p className="text-2xl">🔔</p>
                <p className="text-sm text-[var(--color-text-muted)]">No notifications yet</p>
                <p className="text-xs text-[var(--color-text-dim)]">Likes and remixes will show up here</p>
              </div>
            ) : (
              items.map((n) => {
                const { text, href } = messageFor(n)
                return (
                  <Link
                    key={n.id}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-[var(--color-border)]/50 last:border-0 hover:bg-[var(--color-surface-3)] transition-colors ${
                      n.read ? '' : 'bg-[var(--color-brand)]/5'
                    }`}
                  >
                    <span className="mt-0.5 flex-shrink-0">{ICONS[n.type] ?? <Bell size={14} />}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-[var(--color-text)] leading-snug">{text}</span>
                      <span className="block text-xs text-[var(--color-text-dim)] mt-0.5">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-[var(--color-brand)] flex-shrink-0" />}
                  </Link>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
