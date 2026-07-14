'use client'

import { useUserSync } from '@/hooks/useUser'
import { Nav, BottomNav } from './Nav'

/** Wraps authenticated app pages. Syncs auth state. */
export function AppShell({ children }: { children: React.ReactNode }) {
  useUserSync()
  return (
    <>
      <Nav />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <BottomNav />
    </>
  )
}
