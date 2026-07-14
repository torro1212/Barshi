import { notFound } from 'next/navigation'
import { AppShell } from '@/components/nav/AppShell'
import { requireAdmin } from '@/lib/admin'
import { isLocalMode } from '@/lib/local-mode'
import { ModerationDashboard } from './ModerationDashboard'

export const metadata = { title: 'Moderation — Barshi', robots: { index: false } }

export default async function ModerationPage() {
  // Admin-only. In local mode there's no auth, so keep it hidden entirely.
  if (isLocalMode() || !(await requireAdmin())) notFound()

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-8">
        <ModerationDashboard />
      </div>
    </AppShell>
  )
}
