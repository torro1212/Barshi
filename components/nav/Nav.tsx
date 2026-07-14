'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Plus, FolderOpen, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsAuthenticated, useProfile } from '@/hooks/useUser'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { NotificationBell } from './NotificationBell'

export function Nav() {
  const isAuth = useIsAuthenticated()
  const profile = useProfile()

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="gradient-text">barshi</span>
          </span>
          <span className="hidden sm:inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand-light)] border border-[var(--color-brand)]/25 uppercase tracking-widest">
            beta
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="primary" className="hidden sm:flex gap-1.5 glow-sm">
            <Link href="/create">
              <Plus size={14} />
              Create
            </Link>
          </Button>

          {isAuth && profile ? (
            <>
              <NotificationBell />
              <Link
                href={`/u/${profile.username}`}
                className="ring-2 ring-transparent hover:ring-[var(--color-brand)]/50 rounded-full transition-all"
              >
                <Avatar src={profile.avatar_url} username={profile.username} size="sm" />
              </Link>
            </>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

/** Mobile bottom nav — shown on small screens */
export function BottomNav() {
  const pathname = usePathname()
  const isAuth = useIsAuthenticated()
  const profile = useProfile()

  const items = [
    { href: '/',         label: 'Discover', icon: Compass },
    { href: '/create',   label: 'Create',   icon: Plus,       highlight: true },
    { href: '/projects', label: 'Projects', icon: FolderOpen },
    {
      href: isAuth && profile ? `/u/${profile.username}` : '/login',
      label: 'Profile',
      icon: User,
    },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe" style={{ background: 'rgba(6,6,15,0.92)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="grid grid-cols-4 h-16">
        {items.map(({ href, label, icon: Icon, highlight }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))

          if (highlight) {
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center gap-1"
              >
                <div className={cn(
                  'w-10 h-10 rounded-2xl flex items-center justify-center transition-all',
                  active
                    ? 'bg-[var(--color-brand)] glow-sm'
                    : 'bg-[var(--color-brand)]/20 border border-[var(--color-brand)]/30'
                )}>
                  <Icon size={20} className={active ? 'text-white' : 'text-[var(--color-brand-light)]'} />
                </div>
              </Link>
            )
          }

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide uppercase transition-colors',
                active
                  ? 'text-[var(--color-brand-light)]'
                  : 'text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)]'
              )}
            >
              <div className="relative">
                <Icon size={20} />
                {active && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-brand)]" />
                )}
              </div>
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
